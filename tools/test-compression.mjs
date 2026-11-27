// 测压缩场景下 gate 的 HTML 注入是否生效
import https from 'node:https';
import zlib from 'node:zlib';

const HOST = 'cheese-house.duckdns.org';
const PIN = 'yrq4weus38yv';
const BASE = `https://${HOST}:8787`;
const agent = new https.Agent({ rejectUnauthorized: false });

const cookies = [];
async function step(url, headers = {}) {
  const r = await fetch(url, { headers: { cookie: cookies.join('; '), ...headers }, redirect: 'manual', agent });
  const sc = r.headers.get('set-cookie');
  if (sc) cookies.push(sc.split(';')[0]);
  return r;
}

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
console.log('无压缩: html', html.length, '| 注入:', html.includes('__DSH_FILE_UPLOAD__'), '| boot:', html.includes('__DSH_BOOT__'));

// 带 accept-encoding 再请求一次（模拟手机）
r = await step(`${BASE}/`, { 'accept-encoding': 'gzip, deflate, br' });
const enc = r.headers.get('content-encoding');
const raw = Buffer.from(await r.arrayBuffer());
console.log('\n带压缩: status', r.status, '| content-encoding:', enc, '| 原始字节:', raw.length);
let decoded = raw;
try {
  if (enc === 'gzip') decoded = zlib.gunzipSync(raw);
  else if (enc === 'br') decoded = zlib.brotliDecompressSync(raw);
  else if (enc === 'deflate') decoded = zlib.inflateSync(raw);
} catch (e) { console.log('解压失败:', e.message); }
const text = decoded.toString('utf8');
console.log('解压后:', text.length, '| 注入:', text.includes('__DSH_FILE_UPLOAD__'), '| boot:', text.includes('__DSH_BOOT__'));
