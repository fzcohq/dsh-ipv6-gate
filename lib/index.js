// dsh-ipv6-gate —— Cordis 插件胶水层
// 约定：name / inject / apply 三个导出（缺 apply 会被静默跳过——前人踩过的坑）
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { createGateManager } from './gate-manager.js';
import { loadCert, needsRenewal, issueCertificate } from './acme.js';
import { createDuckDnsProvider } from './providers/duckdns.js';
import { createDdnsUpdater } from './ddns.js';

export const name = 'dsh-ipv6-gate';

export const inject = ['webServer', 'connection'];

function resolveUpstream(ctx, config, log) {
  if (config.upstreamPort) return config.upstreamPort;
  let ws;
  try { ws = ctx.webServer ?? (typeof ctx.get === 'function' ? ctx.get('webServer') : null); } catch { ws = null; }
  const port = ws?.port ?? (() => { try { return ws?.address?.()?.port; } catch { return null; } })();
  if (port) return port;
  log.warn('upstreamPort unresolved; defaulting to 3080');
  return 3080;
}

export function apply(ctx, config = {}) {
  let log;
  try {
    log = ctx.logger('dsh-ipv6-gate');
  } catch {
    log = { info() {}, warn() {} };
  }

  try {
    const merged = { ...config };
    const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
    const stateDir = path.join(home, 'dsh-ipv6-gate');
    const upstreamPort = resolveUpstream(ctx, merged, log);

    function getLaunchToken() {
      try {
        const svc = ctx.connection ?? (typeof ctx.get === 'function' ? ctx.get('connection') : null);
        const auth = svc?.connection ?? svc;
        const url = auth?.authenticatedUrl?.(`http://127.0.0.1:${upstreamPort}/`);
        return url ? new URL(url).searchParams.get('token') : null;
      } catch { return null; }
    }

    // ---- 网关管理器（双通道：HTTP + HTTPS）----
    const manager = createGateManager({
      stateDir,
      upstreamPort,
      getLaunchToken,
      log: (m) => { try { log.info(m); } catch {} },
    });

    // 旧配置兼容：如果 cordis.patch.yml 里有 port，作为 HTTPS 端口
    if (merged.port && merged.port !== 8443) {
      const s = manager.getSettings();
      if (s.https.port !== merged.port) {
        // manager 没有 setPort 方法，暂时只影响显示；用户可通过配置改
      }
    }

    ctx.on('dispose', () => { try { manager.dispose(); } catch {} });

    // ---- TLS 证书管理 → 喂给 manager ----
    const tlsCfg = merged.tls && merged.tls.domain ? merged.tls : null;
    if (tlsCfg) {
      const certDir = tlsCfg.certDir || path.join(stateDir, 'certs');
      const provider = createDuckDnsProvider({ token: tlsCfg.token });

      const applyCert = async () => {
        try {
          // 1) 先用磁盘上的现有证书立即启动 HTTPS（不等续期）
          const existing = loadCert(certDir);
          if (existing) {
            manager.setTlsCert(existing);
            manager.setDomainStatus('ok');
            log.info(`cert: TLS ready (existing) for ${tlsCfg.domain}`);
          }
          // 2) 需要续期才后台续（不阻塞启动）
          if (!existing || needsRenewal(existing)) {
            const res = await issueCertificate({
              domain: tlsCfg.domain,
              email: tlsCfg.email || '',
              provider,
              certDir,
              propagationDelayMs: tlsCfg.propagationDelayMs ?? 15000,
              log: (m) => { try { log.info(`cert: ${m}`); } catch {} },
            });
            if (res) {
              manager.setTlsCert(res);
              manager.setDomainStatus('ok');
              log.info(`cert: TLS renewed for ${tlsCfg.domain}`);
            }
          }
        } catch (e) {
          // 续期失败不影响已有的证书（如果 existing 已加载，HTTPS 继续跑）
          const saved = manager.getSettings();
          if (saved.domain.status !== 'ok') {
            manager.setDomainStatus('error', e?.message || String(e));
          }
          log.warn(`cert: ${e?.message || e}`);
        }
      };

      // 非阻塞签发/加载
      Promise.resolve().then(applyCert);
      const certTimer = setInterval(applyCert, 24 * 3600 * 1000);
      if (typeof certTimer.unref === 'function') certTimer.unref();
      ctx.on('dispose', () => clearInterval(certTimer));
    } else {
      // 没有 cordis.patch.yml 的 TLS 配置，但 settings.json 里可能通过 API 设置过域名
      // → 启动时从磁盘加载已有证书
      const saved = manager.getSettings();
      if (saved.domain.name && saved.domain.status === 'ok') {
        const certDir = path.join(stateDir, 'certs');
        const cert = loadCert(certDir);
        if (cert) {
          manager.setTlsCert(cert);
          log.info(`cert: loaded existing certificate for ${saved.domain.name}`);
        }
      }
    }

    // ---- DDNS ----
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

    // ---- 配置 API（同源，客户端设置页用）----
    const qrCache = new Map();
    async function makeQr(payload) {
      if (!payload) return '';
      if (qrCache.has(payload)) return qrCache.get(payload);
      try {
        const QRCode = (await import('qrcode')).default;
        const dataUrl = await QRCode.toDataURL(payload, { width: 240, margin: 2 });
        if (qrCache.size > 20) qrCache.clear();
        qrCache.set(payload, dataUrl);
        return dataUrl;
      } catch { return ''; }
    }

    try {
      const dispose = ctx.webServer.register({
        kind: 'exact',
        path: '/__gate-config',
        handler: (req, res) => {
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.setHeader('cache-control', 'no-store');

          if (req.method === 'GET') {
            (async () => {
              const status = await manager.getStatus();
              const [httpQr, httpsQr] = await Promise.all([
                status.http.url ? makeQr(`${status.http.url}/?key=${status.http.password}`) : '',
                status.https.url ? makeQr(`${status.https.url}/?key=${status.https.password}`) : '',
              ]);
              res.end(JSON.stringify({ ...status, httpQr, httpsQr }));
            })().catch(() => {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'status failed' }));
            });
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', (c) => { body += c; if (body.length > 4096) req.destroy(); });
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                let result;

                if (data.action === 'toggleHttp') {
                  result = manager.toggleHttp(data.enabled);
                } else if (data.action === 'toggleHttps') {
                  result = manager.toggleHttps(data.enabled);
                } else if (data.action === 'setHttpPassword') {
                  result = manager.setHttpPassword(data.password);
                } else if (data.action === 'setHttpsPassword') {
                  result = manager.setHttpsPassword(data.password);
                } else if (data.action === 'setDomain') {
                  const current = manager.getSettings().domain;
                  const unchanged = current.name === data.name && current.token === data.token && current.status === 'ok';
                  if (unchanged) {
                    // 域名和 Token 没变，且已配置成功 → 跳过重新签发
                    result = { ok: true, skipped: true };
                  } else {
                    result = manager.setDomain(data.name, data.token);
                    if (data.name && data.token) {
                      const prov = createDuckDnsProvider({ token: data.token });
                      issueCertificate({
                        domain: data.name.includes('.') ? data.name : `${data.name}.duckdns.org`,
                        email: '',
                        provider: prov,
                        certDir: path.join(stateDir, 'certs'),
                        log: (m) => { try { log.info(`cert: ${m}`); } catch {} },
                      }).then((cert) => {
                        manager.setTlsCert(cert);
                        manager.setDomainStatus('ok');
                        log.info(`domain provisioning complete`);
                      }).catch((e) => {
                        manager.setDomainStatus('error', e?.message || String(e));
                        log.warn(`domain provisioning failed: ${e?.message || e}`);
                      });
                    }
                  }
                } else if (data.action === 'recheckIpv6') {
                  // 强制重新探测（清缓存由 getStatus 内部处理）
                  result = { ok: true };
                } else {
                  result = { ok: false, error: 'unknown action' };
                }

                res.end(JSON.stringify(result));
              } catch {
                res.statusCode = 400;
                res.end(JSON.stringify({ ok: false, error: 'bad json' }));
              }
            });
            return;
          }

          res.statusCode = 405;
          res.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
        },
      });
      if (typeof dispose === 'function') ctx.on('dispose', dispose);
      log.info('config API registered at /__gate-config');
    } catch (e) {
      log.warn(`config API registration failed: ${e?.message || e}`);
    }
  } catch (e) {
    try { log.warn(`dsh-ipv6-gate apply failed (ignored): ${e?.message || e}`); } catch {}
  }
}
