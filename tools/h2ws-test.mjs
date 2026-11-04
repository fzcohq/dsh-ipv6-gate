// 可行性探针：node:http2 + allowHTTP1 是否仍能把 h1 WebSocket upgrade 交给 'upgrade' 事件
// 若 PASS：P2 可直接用 http2.createSecureServer({allowHTTP1:true}) 同时服务 h2 与 WS
import http2 from 'node:http2';
import fs from 'node:fs';
import http from 'node:http';

const key = fs.readFileSync('C:/Users/HalsM/.dsh/ipv6-direct/certs/key.pem');
const cert = fs.readFileSync('C:/Users/HalsM/.dsh/ipv6-direct/certs/fullchain.pem');

const server = http2.createSecureServer({ key, cert, allowHTTP1: true }, (req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end(`ok proto=${req.httpVersion}`);
});

let upgradeSeen = false;
server.on('upgrade', (req, socket) => {
  upgradeSeen = true;
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
  socket.destroy();
});

server.listen(8456, '127.0.0.1', () => {
  // h1 客户端（https.request 走 ALPN http/1.1）发 Upgrade
  const req = http.request({
    host: '127.0.0.1',
    port: 8456,
    path: '/ws',
    headers: { connection: 'Upgrade', upgrade: 'websocket' },
  });
  req.on('upgrade', () => {
    console.log('PASS: allowHTTP1 下 h1 upgrade 可用（可升 P2）');
    server.close();
    process.exit(0);
  });
  req.on('response', (res) => {
    console.log('FAIL: 收到普通响应', res.statusCode);
    server.close();
    process.exit(1);
  });
  req.on('error', (e) => {
    console.log('FAIL: 连接错误', e.code || e.message);
    server.close();
    process.exit(1);
  });
  req.end();
});
