// 网关服务器：认证门 + 头改写反代 + WebSocket 透传（Phase 1 核心，独立实现）
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import { createAuth } from './auth.js';
import { rewriteHeaders } from './rewrite.js';
import { loginPageHtml, LOGIN_PATH } from './login-page.js';

/**
 * @param {object} options
 * @param {string} options.pin                    访问密码
 * @param {string} [options.host='::']            监听地址
 * @param {number} [options.port=8445]            监听端口
 * @param {string} [options.upstreamHost='127.0.0.1']
 * @param {number} options.upstreamPort           DSH webserver 端口
 * @param {{cert:string,key:string}|null} [options.tls] 证书文件路径；null = 明文 HTTP（仅本机开发）
 * @param {function():string|null} [options.getLaunchToken] 取 DSH 进程启动令牌（经 connection 服务）；
 *        用于替手机完成 DSH 浏览器认证：PIN 通过后重定向 /?token=… 由 DSH 铸 Cookie
 */
export function createGate(options = {}) {
  const {
    pin,
    host = '::',
    port = 8445,
    upstreamHost = '127.0.0.1',
    upstreamPort,
    tls = null,
    getLaunchToken = null,
    maxFails,
    lockMs,
    now,
  } = options;
  if (!upstreamPort) throw new Error('createGate: upstreamPort is required');

  const auth = createAuth({ pin, maxFails, lockMs, now });
  const authority = `${upstreamHost}:${upstreamPort}`;

  async function readBody(req, limit = 4096) {
    let size = 0;
    const chunks = [];
    for await (const c of req) {
      size += c.length;
      if (size > limit) throw new Error('body too large');
      chunks.push(c);
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  async function handle(req, res) {
    const ip = req.socket.remoteAddress || '?';
    if (auth.isLocked(ip)) {
      res.writeHead(429, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      return res.end('too many failed attempts, retry later');
    }
    if (!auth.isAuthenticated(req)) {
      if (req.method === 'POST' && req.url.split('?')[0] === LOGIN_PATH) {
        try {
          const form = new URLSearchParams(await readBody(req));
          const candidate = form.get('pin') || '';
          if (auth.checkPin(candidate)) {
            auth.registerSuccess(ip);
            // 带 DSH 启动令牌重定向：由上游 DSH 铸它自己的 Cookie（手机此后两层 Cookie 齐备）
            const token = typeof getLaunchToken === 'function' ? getLaunchToken() : null;
            const location = token ? `/?token=${encodeURIComponent(token)}` : '/';
            res.writeHead(303, {
              location,
              'set-cookie': auth.cookieHeader({ secure: !!tls }),
              'cache-control': 'no-store',
            });
            return res.end();
          }
          auth.registerFailure(ip);
          res.writeHead(403, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
          return res.end(loginPageHtml('PIN 不正确'));
        } catch {
          res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
          return res.end('bad request');
        }
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(loginPageHtml());
    }

    // ---- 已认证：反代到 DSH ----
    const headers = rewriteHeaders(req.headers, authority, { scheme: 'http' });
    const preq = http.request({
      host: upstreamHost,
      port: upstreamPort,
      method: req.method,
      path: req.url,
      headers,
    });
    preq.on('response', (pres) => {
      // 上游 401（DSH 浏览器认证失效/重启换令牌）→ 对文档导航透明续登一次；
      // 已带 ?token= 的请求不再重定向，防止循环
      const isDoc =
        req.method === 'GET' &&
        (/text\/html/i.test(String(req.headers.accept || '')) ||
          req.url.split('?')[0] === '/');
      if (pres.statusCode === 401 && isDoc && typeof getLaunchToken === 'function' &&
          !req.url.includes('token=')) {
        const token = getLaunchToken();
        if (token) {
          pres.resume();
          res.writeHead(303, {
            location: `/?token=${encodeURIComponent(token)}`,
            'cache-control': 'no-store',
          });
          return res.end();
        }
      }
      res.writeHead(pres.statusCode, pres.headers);
      pres.pipe(res);
    });
    preq.on('error', (err) => {
      if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`upstream error: ${err.code || err.message}`);
    });
    req.pipe(preq);
  }

  function onUpgrade(req, socket, head) {
    const ip = req.socket.remoteAddress || '?';
    if (auth.isLocked(ip) || !auth.isAuthenticated(req)) {
      socket.destroy();
      return;
    }
    const headers = rewriteHeaders(req.headers, authority, { scheme: 'http' });
    headers.connection = 'Upgrade';
    headers.upgrade = req.headers.upgrade;
    // 必须带 method/path：http.request 默认 GET '/'，会把 WS 升级全打到 /
    const preq = http.request({
      host: upstreamHost,
      port: upstreamPort,
      method: req.method,
      path: req.url,
      headers,
    });
    preq.on('upgrade', (pres, psock, phead) => {
      const lines = ['HTTP/1.1 101 Switching Protocols'];
      for (const [k, v] of Object.entries(pres.headers)) lines.push(`${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
      socket.write(lines.join('\r\n') + '\r\n\r\n');
      if (phead && phead.length) socket.write(phead);
      psock.pipe(socket).pipe(psock);
      const kill = () => { try { socket.destroy(); psock.destroy(); } catch {} };
      socket.on('error', kill);
      psock.on('error', kill);
    });
    preq.on('response', (pres) => {
      // 上游拒绝升级：透传状态码后断开
      socket.write(`HTTP/1.1 ${pres.statusCode} ${pres.statusMessage || ''}\r\n\r\n`);
      socket.destroy();
    });
    preq.on('error', () => socket.destroy());
    preq.end(head);
  }

  let server;
  if (tls) {
    server = https.createServer(
      { cert: fs.readFileSync(tls.cert), key: fs.readFileSync(tls.key) },
      handle,
    );
  } else {
    server = http.createServer(handle);
  }
  server.on('upgrade', onUpgrade);
  return { server, auth, authority };
}
