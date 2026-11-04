// 可行性探针二：ALPN 分流 —— 同一 TLS 端口，h2 走 http2 服务器，h1 走 http 服务器（WS 升级可用）
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import http2 from 'node:http2';
import fs from 'node:fs';
import { connect as h2connect } from 'node:http2';

const key = fs.readFileSync('C:/Users/HalsM/.dsh/ipv6-direct/certs/key.pem');
const cert = fs.readFileSync('C:/Users/HalsM/.dsh/ipv6-direct/certs/fullchain.pem');

const h2 = http2.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end(`h2 proto=${req.httpVersion}`);
});
const h1 = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end(`h1 proto=${req.httpVersion}`);
});
let wsSeen = false;
console.log('[srv] h1 listeners ready');
h1.on('request', (req) => console.log('[srv] h1 request', req.url));
h1.on('upgrade', (req, socket) => {
  console.log('[srv] h1 upgrade', req.url);
  wsSeen = true;
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
  
});

const tlsServer = tls.createServer({ key, cert, ALPNProtocols: ['h2', 'http/1.1'] }, (socket) => {
  if (socket.alpnProtocol === 'h2') h2.emit('connection', socket);
  else h1.emit('connection', socket);
});

async function main() {
  await new Promise((r) => tlsServer.listen(8457, '127.0.0.1', r));
  let pass = 0;

  // 1) h2 请求
  await new Promise((resolve, reject) => {
    const c = h2connect('https://127.0.0.1:8457', { rejectUnauthorized: false });
    c.on('connect', () => {
      const r = c.request({ ':path': '/' });
      r.on('response', (headers) => {
        let body = '';
        r.on('data', (d) => { body += d; });
        r.on('end', () => {
          console.log(`h2: alpn=${c.alpnProtocol} status=${headers[':status']} body=${body}`);
          if (c.alpnProtocol === 'h2' && body.startsWith('h2')) pass++;
          c.close(); resolve();
        });
      });
      r.end();
    });
    c.on('error', reject);
    setTimeout(() => reject(new Error('h2 timeout')), 4000);
  });

  // 2) h1 普通请求
  await new Promise((resolve, reject) => {
    const req = https.request({ host: '127.0.0.1', port: 8457, path: '/', rejectUnauthorized: false });
    req.on('response', (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        console.log(`h1: status=${res.statusCode} body=${body}`);
        if (body.startsWith('h1')) pass++;
        resolve();
      });
    });
    req.on('error', reject);
    req.end();
  });

  // 3) h1 WebSocket 升级
  await new Promise((resolve) => {
    const req = https.request({
      host: '127.0.0.1',
      port: 8457,
      rejectUnauthorized: false,
      path: '/ws',
      headers: { connection: 'Upgrade', upgrade: 'websocket' },
    });
    req.on('upgrade', () => {
      console.log('h1 upgrade: 101 OK');
      if (wsSeen) pass++;
      resolve();
    });
    req.on('error', (e) => { console.log('[cli] ws error', e.code || e.message); resolve(); });
    req.on('response', (res) => { console.log('[cli] ws got response', res.statusCode); resolve(); });
    req.end();
  });

  console.log(pass === 3 ? 'PASS: ALPN 分流可行（h2 + h1 + WS 同端口）' : `FAIL: 仅 ${pass}/3 通过`);
  tlsServer.close();
  process.exit(pass === 3 ? 0 : 1);
}
main();

