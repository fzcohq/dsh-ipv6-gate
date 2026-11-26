// 测试 gate 的 POST body 转发（模拟文件上传）
import https from 'node:https';
import { URL } from 'node:url';

const GATE = 'https://127.0.0.1:8787';
const PIN = 'yrq4weus38yv';
const agent = new https.Agent({ rejectUnauthorized: false });

// 1) 认证拿 cookie
const authRes = await fetch(`${GATE}/?key=${PIN}`, {
  redirect: 'manual',
  agent,
});
const setCookie = authRes.headers.get('set-cookie') || '';
const cookie = setCookie.split(';')[0];
console.log('auth:', authRes.status, '| cookie:', cookie.substring(0, 30) + '...');

// 2) 加载主页拿 DSH 会话
const pageRes = await fetch(`${GATE}/`, {
  redirect: 'follow',
  headers: { cookie },
  agent,
});
const pageHtml = await pageRes.text();
console.log('page:', pageRes.status, '| html:', pageHtml.length, 'bytes');
const dshCookies = (pageRes.headers.get('set-cookie') || '').split(';')[0];
const allCookies = [cookie, dshCookies].filter(Boolean).join('; ');
console.log('all cookies:', allCookies.length, 'chars');

// 3) POST 一个 JSON body 到一个已知 API（测试 body 转发）
const postRes = await fetch(`${GATE}/api/session/attachment`, {
  method: 'POST',
  headers: {
    cookie: allCookies,
    'content-type': 'application/json',
    origin: GATE,
  },
  body: JSON.stringify({ filename: 'test.pdf', mimeType: 'application/pdf' }),
  agent,
});
const postBody = await postRes.text();
console.log('\nPOST /api/session/attachment (json):', postRes.status, '|', postBody.substring(0, 200));

// 4) POST multipart（模拟文件上传）
const formData = new FormData();
formData.append('file', new Blob(['test pdf content'], { type: 'application/pdf' }), 'test.pdf');
const uploadRes = await fetch(`${GATE}/upload`, {
  method: 'POST',
  headers: {
    cookie: allCookies,
    origin: GATE,
  },
  body: formData,
  agent,
});
const uploadBody = await uploadRes.text();
console.log('\nPOST /upload (multipart):', uploadRes.status, '|', uploadBody.substring(0, 200));

// 5) PUT 到 /upload
const putRes = await fetch(`${GATE}/upload`, {
  method: 'PUT',
  headers: {
    cookie: allCookies,
    'content-type': 'application/octet-stream',
    origin: GATE,
  },
  body: 'test content',
  agent,
});
const putBody = await putRes.text();
console.log('\nPUT /upload (binary):', putRes.status, '|', putBody.substring(0, 200));
