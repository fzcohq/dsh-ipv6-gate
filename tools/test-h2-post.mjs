// 测试 HTTP/2 POST body 转发（手机浏览器用的协议）
import http2 from 'node:http2';
import fs from 'node:fs';

const HOST = 'cheese-house.duckdns.org';
const PIN = 'yrq4weus38yv';

// 1) 先用 HTTP/1.1 认证拿 cookie
const authRes = await fetch(`https://${HOST}:8787/?key=${PIN}`, { redirect: 'manual' });
const cookie = (authRes.headers.get('set-cookie') || '').split(';')[0];
console.log('auth:', authRes.status, '| cookie OK:', Boolean(cookie));

// 2) 用 HTTP/2 连接 gate
const h2session = http2.connect(`https://${HOST}:8787`, {
  rejectUnauthorized: false,
});
h2session.on('error', (err) => console.error('h2 session error:', err.message));

// 3) 发送小 POST body
const smallReq = h2session.request({
  ':method': 'POST',
  ':path': '/api/session/attachment',
  'content-type': 'application/json',
  'origin': `https://${HOST}:8787`,
  cookie,
});
const smallBody = JSON.stringify({ test: 'h2-small' });
smallReq.end(smallBody);

const smallRes = await new Promise((resolve) => {
  smallReq.on('response', (headers) => {
    const chunks = [];
    smallReq.on('data', (c) => chunks.push(c));
    smallReq.on('end', () => resolve({ status: headers[':status'], body: Buffer.concat(chunks).toString() }));
  });
});
console.log('h2 small POST:', smallRes.status, '|', smallRes.body.substring(0, 100));

// 4) 发送大 POST body（1MB，模拟 base64 文件）
const bigBody = JSON.stringify({ test: 'x'.repeat(1024 * 1024) });
const bigReq = h2session.request({
  ':method': 'POST',
  ':path': '/api/session/attachment',
  'content-type': 'application/json',
  'origin': `https://${HOST}:8787`,
  cookie,
});
bigReq.end(bigBody);

const bigRes = await new Promise((resolve) => {
  bigReq.on('response', (headers) => {
    const chunks = [];
    bigReq.on('data', (c) => chunks.push(c));
    bigReq.on('end', () => resolve({ status: headers[':status'], body: Buffer.concat(chunks).toString() }));
  });
  bigReq.on('error', (err) => resolve({ status: 'ERROR', body: err.message }));
});
console.log('h2 1MB POST:', bigRes.status, '|', bigRes.body.substring(0, 100));

// 5) 发送带 content-length 的大 POST（更接近浏览器行为）
const bigBody2 = JSON.stringify({ test: 'y'.repeat(1024 * 1024) });
const bigReq2 = h2session.request({
  ':method': 'POST',
  ':path': '/api/session/attachment',
  'content-type': 'application/json',
  'origin': `https://${HOST}:8787`,
  cookie,
  'content-length': String(Buffer.byteLength(bigBody2)),
});
bigReq2.end(bigBody2);

const bigRes2 = await new Promise((resolve) => {
  bigReq2.on('response', (headers) => {
    const chunks = [];
    bigReq2.on('data', (c) => chunks.push(c));
    bigReq2.on('end', () => resolve({ status: headers[':status'], body: Buffer.concat(chunks).toString() }));
  });
  bigReq2.on('error', (err) => resolve({ status: 'ERROR', body: err.message }));
});
console.log('h2 1MB POST (with content-length):', bigRes2.status, '|', bigRes2.body.substring(0, 100));

h2session.close();
console.log('\n=== 结论 ===');
console.log('所有请求都应返回 401（没有 DSH 会话）');
console.log('如果任何一个返回 ERROR 或超时 → h2 body 转发有 bug');
