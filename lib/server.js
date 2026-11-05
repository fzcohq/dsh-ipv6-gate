// 网关服务器：PIN 认证门 + 头改写反代 + WebSocket 透传 + TLS/ALPN 分流（h2 + h1）
// ALPN 分流：一个 TLS 端口，h2 走 http2 服务器（多路复用 74 个 client bundle），
// h1 走 http 服务器（WebSocket 升级只能走 h1，Node http2 不支持 Upgrade）
import http from 'node:http';
import http2 from 'node:http2';
import tls from 'node:tls';
import fs from 'node:fs';
import { createAuth } from './auth.js';
import { rewriteHeaders } from './rewrite.js';
import { loginPageHtml, LOGIN_PATH } from './login-page.js';
import { isImmutableAsset } from './cache.js';

const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade']);

function stripHopByHop(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    const name = k.toLowerCase();
    if (HOP_BY_HOP.has(name) || k.startsWith(':')) continue;
    out[k] = v;
  }
  return out;
}

function headerValue(headers, name) {
  const v = headers?.[name];
  return Array.isArray(v) ? v.join(', ') : v || '';
}

function certMaterial(value) {
  if (value === undefined || value === null || value === '') return null;
  const s = String(value);
  return s.includes('BEGIN') ? s : fs.readFileSync(s, 'utf8');
}

/**
 * @param {object} options
 * @param {string} options.pin
 * @param {string} [options.host='::']
 * @param {number} [options.port=8445]
 * @param {string} [options.upstreamHost='127.0.0.1']
 * @param {number} options.upstreamPort
 * @param {{cert:string,key:string}|null} [options.tls] PEM 字符串或文件路径；null = 明文 HTTP（仅本机开发）
 * @param {function():string|null} [options.getLaunchToken]
 */
export function createGate(options = {}) {
  const {
    pin,
    host = '::',
    port = 8445,
    upstreamHost = '127.0.0.1',
    upstreamPort,
    tls: tlsOptions = null,
    getLaunchToken = null,
    maxFails,
    lockMs,
    now,
    log = () => {},
  } = options;
  if (!upstreamPort) throw new Error('createGate: upstreamPort is required');

  const auth = createAuth({ pin, maxFails, lockMs, now });
  const authority = `${upstreamHost}:${upstreamPort}`;
  const secure = Boolean(tlsOptions && tlsOptions.cert && tlsOptions.key);

  async function readBody(req, limit = 4096) {
    let size = 0;
    const chunks = [];
    for await (const c of req) {
      size += c.length;
      if (size > limit) throw new Error('body too large');
      chunks.push(c);
    }
    return Buffer.concat(chunks.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(c)))).toString('utf8');
  }

  function sendHtml(res, status, html) {
    res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html);
  }

  function sendText(res, status, text) {
    res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end(text);
  }

  async function handle(req, res) {
    const method = req.headers?.[':method'] || req.method || 'GET';
    const urlPath = req.headers?.[':path'] || req.url || '/';
    const ip = req.socket?.remoteAddress || '?';

    if (auth.isLocked(ip)) return sendText(res, 429, 'too many failed attempts, retry later');

    if (!auth.isAuthenticated(req)) {
      // ?key= 自动认证：QR 码扫码直达（key 匹配 PIN 即设 Cookie 并 302 到干净 URL）
      if (method === 'GET') {
        try {
          const u = new URL(urlPath, 'http://x');
          const key = u.searchParams.get('key');
          if (key && auth.checkPin(key)) {
            auth.registerSuccess(ip);
            const token = typeof getLaunchToken === 'function' ? getLaunchToken() : null;
            const location = token ? `/?token=${encodeURIComponent(token)}` : u.pathname;
            res.writeHead(302, {
              location,
              'set-cookie': auth.cookieHeader({ secure }),
              'cache-control': 'no-store',
            });
            return res.end();
          }
        } catch { /* URL 解析失败走正常登录 */ }
      }
      if (method === 'POST' && urlPath.split('?')[0] === LOGIN_PATH) {
        try {
          const form = new URLSearchParams(await readBody(req));
          const candidate = form.get('pin') || '';
          if (auth.checkPin(candidate)) {
            auth.registerSuccess(ip);
            const token = typeof getLaunchToken === 'function' ? getLaunchToken() : null;
            const location = token ? `/?token=${encodeURIComponent(token)}` : '/';
            res.writeHead(303, {
              location,
              'set-cookie': auth.cookieHeader({ secure }),
              'cache-control': 'no-store',
            });
            return res.end();
          }
          auth.registerFailure(ip);
          return sendHtml(res, 403, loginPageHtml('PIN 不正确'));
        } catch {
          return sendText(res, 400, 'bad request');
        }
      }
      return sendHtml(res, 200, loginPageHtml());
    }

    // ---- 已认证：反代 ----
    const headers = rewriteHeaders(req.headers, authority, { scheme: 'http' });
    for (const k of Object.keys(headers)) if (k.startsWith(':')) delete headers[k];

    const preq = http.request({
      host: upstreamHost,
      port: upstreamPort,
      method,
      path: urlPath,
      headers,
    });
    preq.on('response', (pres) => {
      // 上游 401（DSH 浏览器认证失效）→ 文档导航透明续登一次；已带 token 的不再重定向，防循环
      const isDoc = method === 'GET' &&
        (/text\/html/i.test(headerValue(req.headers, 'accept')) || urlPath.split('?')[0] === '/');
      if (pres.statusCode === 401 && isDoc && typeof getLaunchToken === 'function' &&
          !urlPath.includes('token=')) {
        const token = getLaunchToken();
        if (token) {
          pres.resume();
          res.writeHead(303, { location: `/?token=${encodeURIComponent(token)}`, 'cache-control': 'no-store' });
          return res.end();
        }
      }
      const resHeaders = stripHopByHop(pres.headers);
      if ((method === 'GET' || method === 'HEAD') && pres.statusCode === 200 && isImmutableAsset(urlPath)) {
        resHeaders['cache-control'] = 'public, max-age=31536000, immutable';
      }
      res.writeHead(pres.statusCode, resHeaders);
      pres.pipe(res);
    });
    preq.on('error', (err) => {
      if (!res.headersSent) sendText(res, 502, `upstream error: ${err.code || err.message}`);
      else res.end();
    });
    req.pipe(preq);
  }

  function onUpgrade(req, socket, head) {
    const ip = req.socket?.remoteAddress || '?';
    if (auth.isLocked(ip) || !auth.isAuthenticated(req)) {
      socket.destroy();
      return;
    }
    const headers = rewriteHeaders(req.headers, authority, { scheme: 'http' });
    for (const k of Object.keys(headers)) if (k.startsWith(':')) delete headers[k];
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
      socket.write(`HTTP/1.1 ${pres.statusCode} ${pres.statusMessage || ''}\r\n\r\n`);
      socket.destroy();
    });
    preq.on('error', () => socket.destroy());
    preq.end(head);
  }

  let server;
  let h2Server = null;
  let h1Server = null;

  if (secure) {
    // h2：HTTP 请求（多路复用）
    h2Server = http2.createServer(handle);
    h2Server.on('error', (e) => { try { log(`h2 server error: ${e?.code || e?.message}`); } catch {} });
    // h1：普通 HTTP + WebSocket 升级
    h1Server = http.createServer(handle);
    h1Server.on('error', (e) => { try { log(`h1 server error: ${e?.code || e?.message}`); } catch {} });
    h1Server.on('upgrade', onUpgrade);
    // TLS 入口：按 ALPN 分流
    server = tls.createServer(
      {
        cert: certMaterial(tlsOptions.cert),
        key: certMaterial(tlsOptions.key),
        ALPNProtocols: ['h2', 'http/1.1'],
      },
      (socket) => {
        socket.on('error', () => {});
        if (socket.alpnProtocol === 'h2') h2Server.emit('connection', socket);
        else h1Server.emit('connection', socket);
      },
    );
    server.on('close', () => {
      try { h2Server.close(); } catch {}
      try { h1Server.close(); } catch {}
    });
  } else {
    server = http.createServer(handle);
    server.on('upgrade', onUpgrade);
  }

  return {
    server,
    auth,
    authority,
    secure,
    /** 证书热更新（已有连接不受影响，新连接用新证书） */
    setCertificate({ cert, key }) {
      if (secure && typeof server.setSecureContext === 'function') {
        server.setSecureContext({ cert: certMaterial(cert), key: certMaterial(key) });
      }
    },
    close() {
      try { server.close(); } catch {}
    },
  };
}
