// 测试 uploadFileBinary 端点的认证（模拟浏览器 Worker 的 XHR POST）
const HOST = 'cheese-house.duckdns.org';
const PIN = 'yrq4weus38yv';
const BASE = `https://${HOST}:8787`;

const cookies = [];
async function step(url) {
  const r = await fetch(url, { headers: { cookie: cookies.join('; ') }, redirect: 'manual' });
  const sc = r.headers.get('set-cookie');
  if (sc) cookies.push(sc.split(';')[0]);
  return r;
}

// 完整认证链
let r = await step(`${BASE}/?key=${PIN}`);
let n = r.headers.get('location') || '/';
if (n.startsWith('/')) n = BASE + n;
r = await step(n);
n = r.headers.get('location') || '/';
if (n.startsWith('.')) n = BASE + '/' + n.replace(/^\.\/?/, '');
if (n.startsWith('/')) n = BASE + n;
if (!n.startsWith('http')) n = BASE + '/';
r = await step(n);
let html = await r.text();
if (html.length < 100 && r.headers.get('location')) {
  n = r.headers.get('location');
  if (n.startsWith('.')) n = BASE + '/' + n.replace(/^\.\/?/, '');
  if (n.startsWith('/')) n = BASE + n;
  r = await step(n);
  html = await r.text();
}
console.log('auth done | cookies:', cookies.length, '| html:', html.length);

// 1) 拿 session 列表
const listRes = await fetch(`${BASE}/api/session/list`, {
  method: 'POST',
  headers: { cookie: cookies.join('; '), 'content-type': 'application/json' },
  body: JSON.stringify({}),
});
const listBody = await listRes.json().catch(() => ({}));
console.log('\nsession/list:', listRes.status, JSON.stringify(listBody).substring(0, 200));
const sessions = listBody.sessions || listBody.result?.sessions || [];
const sessionId = sessions[0]?.sessionId || sessions[0]?.id || 'test-session';
console.log('using sessionId:', sessionId);

// 2) POST 到 uploadFileBinary（模拟 Worker XHR）
const blob = new Blob(['%PDF-1.4 test pdf content for upload'], { type: 'application/pdf' });
const uploadUrl = `${BASE}/api/session/uploadFileBinary?sessionId=${encodeURIComponent(sessionId)}&name=test.pdf`;
console.log('\nuploading to:', uploadUrl.replace(BASE, ''));
const upRes = await fetch(uploadUrl, {
  method: 'POST',
  headers: { cookie: cookies.join('; '), 'content-type': 'application/octet-stream' },
  body: blob,
});
const upBody = await upRes.text();
console.log('uploadFileBinary:', upRes.status, '|', upBody.substring(0, 300));

// 3) 也测一下附件端点
const attRes = await fetch(`${BASE}/api/session/attachment`, {
  method: 'POST',
  headers: { cookie: cookies.join('; '), 'content-type': 'application/json' },
  body: JSON.stringify({ sessionId }),
});
console.log('\nattachment:', attRes.status, '|', (await attRes.text()).substring(0, 200));
