// WS 探针：验证某端口上的 WebSocket 升级是否成功（完整握手 + 路径 + cookie 透传）
// 用法：node tools/wsprobe.mjs <port> "<cookie>" [path]
import http from 'node:http';
import { randomBytes } from 'node:crypto';

const [, , portArg, cookie = '', pathArg = '/api/remote.mux'] = process.argv;
const port = Number(portArg);
const key = randomBytes(16).toString('base64');

const req = http.request({
  host: '127.0.0.1',
  port,
  path: pathArg,
  headers: {
    connection: 'Upgrade',
    upgrade: 'websocket',
    'sec-websocket-version': '13',
    'sec-websocket-key': key,
    cookie,
  },
});

req.on('upgrade', (res, socket) => {
  const accept = res.headers['sec-websocket-accept'];
  console.log(`UPGRADE path=${pathArg} status=${res.statusCode} accept=${accept ? 'present' : 'MISSING'}`);
  socket.destroy();
  process.exit(0);
});
req.on('response', (res) => {
  let body = '';
  res.on('data', (d) => { body += d; });
  res.on('end', () => {
    console.log(`REFUSED path=${pathArg} status=${res.statusCode} body=${JSON.stringify(body.slice(0, 80))}`);
    process.exit(2);
  });
});
req.on('error', (e) => {
  console.log(`ERROR path=${pathArg} code=${e.code || e.message}`);
  process.exit(3);
});
req.end();
