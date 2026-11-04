// dsh-ipv6-gate —— Cordis 插件胶水层
// 约定：name / inject / apply 三个导出（缺 apply 会被静默跳过——前人踩过的坑）
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { createGate } from './server.js';
import { randomPin } from './auth.js';
import { loadCert, needsRenewal, issueCertificate } from './acme.js';
import { createDuckDnsProvider } from './providers/duckdns.js';
import { createDdnsUpdater, detectStableIpv6 } from './ddns.js';

export const name = 'dsh-ipv6-gate';

// 等 webServer / connection 服务发布后才调用 apply（compose 期 ctx.get 拿到的是 undefined）
// connection 必须声明：Cordis 禁止未 inject 的服务访问（"cannot get property without inject"），
// 拿不到它会直接抛错导致令牌取不到、手机撞 DSH 401（2026-11-04 真机验证发现）
export const inject = ['webServer', 'connection'];

function loadOrCreatePin(dir, log) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'pin');
    if (fs.existsSync(file)) {
      const saved = fs.readFileSync(file, 'utf8').trim();
      if (saved) return saved;
    }
    const pin = randomPin();
    fs.writeFileSync(file, pin, { encoding: 'utf8', mode: 0o600 });
    log.info(`generated new pin, stored at ${file}`);
    return pin;
  } catch (e) {
    log.warn(`pin init failed (${e.message}); using in-memory pin`);
    return randomPin();
  }
}

function resolveUpstream(ctx, config, log) {
  if (config.upstreamPort) return config.upstreamPort;
  // 宿主 webServer 服务若暴露端口则自动跟随（桌面版端口每次启动随机）
  let ws;
  try { ws = ctx.webServer ?? (typeof ctx.get === 'function' ? ctx.get('webServer') : null); } catch { ws = null; }
  const port = ws?.port ?? (() => { try { return ws?.address?.()?.port; } catch { return null; } })();
  if (port) return port;
  log.warn('upstreamPort unresolved; defaulting to 3080 — set config.upstreamPort if wrong');
  return 3080;
}

export function apply(ctx, config = {}) {
  // 启动安全加固：apply 内任何异常都只记日志，绝不冒泡（DSH 启动全有全无，一个插件炸整机）
  let log;
  try {
    log = ctx.logger('dsh-ipv6-gate');
  } catch {
    log = { info() {}, warn() {} };
  }

  try {
    const merged = { port: 8445, host: '::', ...config };
    const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
    const stateDir = path.join(home, 'dsh-ipv6-gate');
    const pin = merged.pin || loadOrCreatePin(stateDir, log);
    const upstreamPort = resolveUpstream(ctx, merged, log);

    const tlsCfg = merged.tls && merged.tls.domain ? merged.tls : null;
    const certDir = tlsCfg?.certDir || path.join(stateDir, 'certs');
    let certState = tlsCfg ? loadCert(certDir) : null;

    // 经官方 connection 服务取 DSH 浏览器认证的进程启动令牌（进程内存随机值，仅此途径）
    // 服务形态兼容两种：{ connection: { authenticatedUrl } } 与 { authenticatedUrl }
    function getLaunchToken() {
      try {
        const svc = ctx.connection ?? (typeof ctx.get === 'function' ? ctx.get('connection') : null);
        const auth = svc?.connection ?? svc;
        const url = auth?.authenticatedUrl?.(`http://127.0.0.1:${upstreamPort}/`);
        return url ? new URL(url).searchParams.get('token') : null;
      } catch {
        return null;
      }
    }

    const gateOptions = () => ({
      pin,
      host: merged.host,
      port: merged.port,
      upstreamPort,
      tls: certState,
      getLaunchToken,
      log: (m) => { try { log.warn(m); } catch {} },
    });

    let gate = createGate(gateOptions());
    gate.server.on('error', (e) => {
      try { log.warn(`gate server error: ${e?.code || e?.message || e}`); } catch {}
    });
    gate.server.listen(merged.port, merged.host, () => {
      try {
        log.info(
          `listening [${merged.host}]:${merged.port} -> 127.0.0.1:${upstreamPort}` +
          ` (${gate.secure ? 'TLS+h2' : 'HTTP — dev only'}, dsh-launch-token: ${getLaunchToken() !== null ? 'ok' : 'unavailable'})`,
        );
      } catch {}
    });

    ctx.on('dispose', () => { try { gate.close(); } catch {} });

    // ---- 配置 API（同源，客户端设置页用；在 webServer 上注册避免 CORS）----
    let cachedIpv6 = { address: null, at: 0 };
    try {
      const configRoute = (req, res) => {
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.setHeader('cache-control', 'no-store');
        if (req.method === 'GET') {
          // IPv6 地址探测（缓存 30 秒，避免频繁 spawn ipconfig）
          const detectIpv6 = async () => {
            const now = Date.now();
            if (cachedIpv6.address && now - cachedIpv6.at < 30000) return cachedIpv6.address;
            try {
              const addr = await detectStableIpv6();
              cachedIpv6 = { address: addr, at: now };
              return addr;
            } catch {
              cachedIpv6 = { address: null, at: now };
              return null;
            }
          };
          detectIpv6().then((ipv6) => {
            res.end(JSON.stringify({
              ipv6: ipv6 || '',
              ipv6Error: ipv6 ? '' : '本机无可用 IPv6 全球地址',
              port: merged.port,
              tlsDomain: tlsCfg?.domain || '',
              gateRunning: true,
              gateSecure: gate.secure,
            }));
          }).catch(() => {
            res.end(JSON.stringify({ ipv6: '', ipv6Error: '探测失败', gateRunning: true }));
          });
          return;
        }
        res.statusCode = 405;
        res.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
      };
      ctx.webServer.register?.({ kind: 'exact', path: '/__gate-config' }, configRoute);
      log.info('config API registered at /__gate-config');
    } catch (e) {
      log.warn(`config API registration failed: ${e?.message || e}`);
    }

    // ---- TLS 证书管理（异步，绝不阻塞启动）----
    if (tlsCfg) {
      const provider = createDuckDnsProvider({ token: tlsCfg.token });
      const switchToTls = async () => {
        try {
          await new Promise((r) => { gate.close(); r(); });
          const next = await new Promise((resolve, reject) => {
            let attempts = 0;
            const tryListen = () => {
              const candidate = createGate(gateOptions());
              candidate.server.once('error', (e) => {
                attempts += 1;
                if (attempts >= 5) return reject(e);
                setTimeout(tryListen, 2000);
              });
              candidate.server.listen(merged.port, merged.host, () => resolve(candidate));
            };
            tryListen();
          });
          gate = next;
          log.info('cert: switched to TLS (HTTP listener replaced)');
        } catch (e) {
          log.warn(`cert: TLS switch failed: ${e?.message || e}`);
        }
      };

      const refresh = async () => {
        try {
          if (certState && !needsRenewal(certState.cert)) return;
          log.info('cert: issuing/renewing via DNS-01');
          const res = await issueCertificate({
            domain: tlsCfg.domain,
            provider,
            certDir,
            email: tlsCfg.email,
            propagationDelayMs: tlsCfg.propagationDelayMs ?? 15000,
            log: (m) => { try { log.info(`cert: ${m}`); } catch {} },
          });
          certState = res;
          if (gate.secure) {
            gate.setCertificate(res);
            log.info('cert: hot-swapped into running TLS server');
          } else {
            await switchToTls();
          }
        } catch (e) {
          log.warn(`cert: ${e?.message || e}`);
        }
      };

      // 非阻塞：先跑 HTTP，证书就绪后切 TLS；已有有效证书则直接 TLS
      Promise.resolve().then(refresh);
      const timer = setInterval(refresh, 24 * 3600 * 1000);
      if (typeof timer.unref === 'function') timer.unref();
      ctx.on('dispose', () => clearInterval(timer));
    }

    // ---- DDNS：默认随 TLS 配置启用（同一 DuckDNS token），每小时检查 AAAA ----
    const ddnsCfg = merged.ddns;
    const ddnsEnabled = ddnsCfg !== false && Boolean(ddnsCfg || tlsCfg);
    if (ddnsEnabled) {
      const ddnsDomain = (ddnsCfg && ddnsCfg.domain) || tlsCfg?.domain;
      const ddnsToken = (ddnsCfg && ddnsCfg.token) || tlsCfg?.token;
      if (ddnsDomain && ddnsToken) {
        try {
          const updater = createDdnsUpdater({
            provider: createDuckDnsProvider({ token: ddnsToken }),
            domain: ddnsDomain,
            stateFile: path.join(stateDir, 'ddns-state.json'),
            intervalMs: (ddnsCfg && ddnsCfg.intervalMs) || 3600_000,
            log: (m) => { try { log.info(m); } catch {} },
          });
          updater.start();
          ctx.on('dispose', () => updater.stop());
          log.info(`ddns: updater started for ${ddnsDomain}`);
        } catch (e) {
          log.warn(`ddns: init failed: ${e?.message || e}`);
        }
      }
    }
  } catch (e) {
    try { log.warn(`dsh-ipv6-gate apply failed (ignored): ${e?.message || e}`); } catch {}
  }
}
