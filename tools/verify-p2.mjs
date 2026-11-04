// P2 验收脚本：对 https://<domain>:8445 逐项检查
// 1) ALPN 协商 h2  2) 服务端证书与磁盘一致  3) 剩余天数
// 4) PIN 登录链路（303 令牌 → 313 dsh cookie → 200 首页）
// 5) 静态资源缓存头 immutable + 压缩  6) WebSocket 升级 101
import tls from 'node:tls';
import https from 'node:https';
import http2 from 'node:http2';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { X509Certificate, randomBytes } from 'node:crypto';

const host = process.argv[2] || 'cheese-house.duckdns.org';
const port = Number(process.argv[3] || 8445);
const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const certDir = path.join(home, 'dsh-ipv6-gate', 'certs');
const pin = (process.argv[4] || fs.readFileSync(path.join(home, 'dsh-ipv6-gate', 'pin'), 'utf8')).trim();

const results = [];
const ok = (name, detail = '') => results.push({ ok: true, name, detail });
const bad = (name, detail = '') => results.push({ ok: false, name, detail });

function req(opts, body) {
  return new Promise((resolve, reject) => {
    const r = https.request({ host, port, servername: host, rejectUnauthorized: false, ...opts }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

async function main() {
  // 1) ALPN + 证书
  const seen = await new Promise((resolve, reject) => {
    const s = tls.connect({ host, port, servername: host, ALPNProtocols: ['h2', 'http/1.1'] }, () => resolve(s));
    s.on('error', reject);
    setTimeout(() => reject(new Error('tls timeout')), 8000);
  });
  const alpn = seen.alpnProtocol;
  const peer = seen.getPeerCertificate();
  seen.destroy();
  alpn === 'h2' ? ok('ALPN', 'h2') : bad('ALPN', String(alpn));

  const fileCert = new X509Certificate(fs.readFileSync(path.join(certDir, 'fullchain.pem')));
  const same = fileCert.fingerprint256 === peer.fingerprint256;
  same ? ok('证书一致', String(peer.subject?.CN || '')) : bad('证书一致', `server=${String(peer.fingerprint256).slice(0, 16)}`);
  const days = (fileCert.validToDate.getTime() - Date.now()) / 86400000;
  ok('剩余天数', days.toFixed(1));

  // 2) 未认证首页
  const loginPage = await req({ path: '/', headers: { accept: 'text/html' } });
  loginPage.status === 200 && loginPage.body.toString().includes('dsh-ipv6-gate')
    ? ok('登录页', '200')
    : bad('登录页', `status=${loginPage.status}`);

  // 3) PIN 登录 → 303 令牌
  const login = await req(
    { method: 'POST', path: '/__gate/login', headers: { 'content-type': 'application/x-www-form-urlencoded' } },
    `pin=${encodeURIComponent(pin)}`,
  );
  const gateCookie = String(login.headers['set-cookie'] || '').split(';')[0];
  const location = login.headers.location || '';
  login.status === 303 && location.includes('token=')
    ? ok('PIN→令牌', '303 + token')
    : bad('PIN→令牌', `status=${login.status} loc=${location}`);

  // 4) 令牌 → 铸 DSH cookie
  const mint = await req({ path: location, headers: { cookie: gateCookie, accept: 'text/html' } });
  const dshCookie = String(mint.headers['set-cookie'] || '').split(';')[0];
  mint.status === 303 && dshCookie.startsWith('dsh-auth-')
    ? ok('DSH Cookie', '303')
    : bad('DSH Cookie', `status=${mint.status} cookie=${dshCookie.slice(0, 12)}`);

  const cookie = `${gateCookie}; ${dshCookie}`;

  // 5) 首页 + 资源缓存头
  const home_ = await req({ path: '/', headers: { cookie, accept: 'text/html' } });
  home_.status === 200 && home_.body.toString().includes('__ModuleLoader__')
    ? ok('完整首页', '200')
    : bad('完整首页', `status=${home_.status}`);

  const asset = String(home_.body).match(/src="([^"]+\.js)"/)?.[1];
  if (asset) {
    const assetPath = asset.replace(/^\.\//, '/');
    const a = await req({ path: assetPath, headers: { cookie, 'accept-encoding': 'gzip, br' } });
    const cc = String(a.headers['cache-control'] || '');
    cc.includes('immutable') ? ok('缓存头', 'immutable') : bad('缓存头', cc || '(none)');
    a.headers['content-encoding'] ? ok('压缩', a.headers['content-encoding']) : bad('压缩', 'none');
  }

  // 6) h2 请求（用 http2 客户端）
  const h2ok = await new Promise((resolve) => {
    const c = http2.connect(`https://${host}:${port}`, { rejectUnauthorized: false });
    c.on('error', () => resolve(false));
    const r = c.request({ ':path': '/', ':method': 'GET', cookie, accept: 'text/html' });
    r.on('response', (h) => { resolve(h[':status'] === 200); c.close(); });
    r.on('error', () => resolve(false));
    r.end();
  });
  h2ok ? ok('h2 请求', '200') : bad('h2 请求', 'failed');

  // 7) WS 升级（h1）
  const ws = await new Promise((resolve) => {
    const r = https.request({
      host, port, servername: host, rejectUnauthorized: false,
      path: '/api/remote.mux',
      headers: {
        connection: 'Upgrade',
        upgrade: 'websocket',
        cookie,
        'sec-websocket-version': '13',
        'sec-websocket-key': Buffer.from(randomBytes(16)).toString('base64'),
      },
    });
    r.on('upgrade', (res) => { resolve(res.statusCode === 101); r.destroy(); });
    r.on('response', (res) => resolve(false));
    r.on('error', () => resolve(false));
    r.end();
  });
  ws ? ok('WS 升级', '101') : bad('WS 升级', 'failed');

  // 输出
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed += 1;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  — ' + r.detail : ''}`);
  }
  console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('FATAL', e?.message || e); process.exit(9); });
