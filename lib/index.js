// dsh-ipv6-gate —— Cordis 插件胶水层
// 约定：name / inject / apply 三个导出（缺 apply 会被静默跳过——前人踩过的坑）
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { createGate } from './server.js';
import { randomPin } from './auth.js';

export const name = 'dsh-ipv6-gate';

// 等 webServer / connection 服务发布后才调用 apply（compose 期 ctx.get 拿到的是 undefined）
// connection：用于拿 DSH 浏览器认证的进程启动令牌（authenticatedUrl 内含 ?token=…）
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
  const log = ctx.logger('dsh-ipv6-gate');
  const merged = { port: 8445, host: '::', ...config };

  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
  const pin = merged.pin || loadOrCreatePin(path.join(home, 'dsh-ipv6-gate'), log);
  const upstreamPort = resolveUpstream(ctx, merged, log);

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

  const { server } = createGate({
    pin,
    host: merged.host,
    port: merged.port,
    upstreamPort,
    tls: merged.tls || null,
    getLaunchToken,
  });
  server.listen(merged.port, merged.host, () => {
    const tokenOk = getLaunchToken() !== null;
    log.info(
      `listening [${merged.host}]:${merged.port} -> 127.0.0.1:${upstreamPort}` +
      ` (${merged.tls ? 'TLS' : 'HTTP — dev only'}, dsh-launch-token: ${tokenOk ? 'ok' : 'unavailable'})`,
    );
  });
  ctx.on('dispose', () => { server.close(); });
}
