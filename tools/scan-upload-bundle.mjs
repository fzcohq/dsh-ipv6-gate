// 获取 file-upload 客户端代码，搜索上传 URL 构造和错误处理
const HOST = 'cheese-house.duckdns.org';
const PIN = 'yrq4weus38yv';
const BASE = `https://${HOST}:8787`;

const cookies = [];
async function step(url) {
  const res = await fetch(url, {
    headers: { cookie: cookies.join('; ') },
    redirect: 'manual',
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookies.push(sc.split(';')[0]);
  return res;
}

// auth chain
let res = await step(`${BASE}/?key=${PIN}`);
let next = res.headers.get('location') || '/';
if (next.startsWith('/')) next = BASE + next;
res = await step(next);
next = res.headers.get('location') || '/';
if (next.startsWith('.')) next = BASE + '/' + next.replace(/^\.\/?/, '');
if (next.startsWith('/')) next = BASE + next;
if (!next.startsWith('http')) next = BASE + '/';
res = await step(next);
let html = await res.text();
if (html.length < 100 && res.headers.get('location')) {
  next = res.headers.get('location');
  if (next.startsWith('.')) next = BASE + '/' + next.replace(/^\.\/?/, '');
  if (next.startsWith('/')) next = BASE + next;
  res = await step(next);
  html = await res.text();
}

// 提取含 file-upload 的 combo URL
const m = html.match(/plugins\/\?\?[^"']*dsh-client-file-upload[^"']*/);
if (!m) { console.log('no combo URL found'); process.exit(1); }
const comboUrl = BASE + '/' + m[0].replace(/&amp;/g, '&');
console.log('combo URL:', m[0].substring(0, 100) + '...');

res = await fetch(comboUrl, { headers: { cookie: cookies.join('; ') } });
const bundle = await res.text();
console.log('bundle:', res.status, bundle.length, 'bytes');

// 搜索 upload 相关的 URL 构造
const patterns = [
  /\/api\/[a-zA-Z-]+\/[a-zA-Z-]*upload[^"'`\s]{0,60}/g,
  /fetch\([^)]{0,120}\)/g,
  /dsh-file-upload|fileUploads\/upload|session\/attachment/g,
  /new WebSocket\([^)]{0,100}\)/g,
];
for (const p of patterns) {
  const found = [...bundle.matchAll(p)].slice(0, 5).map(x => x[0].substring(0, 150));
  if (found.length) {
    console.log('\npattern', p.source.substring(0, 40), '→', found.length, 'matches');
    found.forEach(f => console.log('  ', f));
  }
}

// 搜索错误消息
const errs = [...bundle.matchAll(/[^"'`]{0,60}authentication required[^"'`]{0,60}/g)].slice(0, 3);
if (errs.length) { console.log('\nAUTH ERROR FOUND:'); errs.forEach(e => console.log('  ', e[0])); }
else console.log('\n"authentication required" not in bundle');

// 搜索 upload 附近的代码片段
const idx = bundle.indexOf('upload');
if (idx >= 0) {
  console.log('\n=== first "upload" context ===');
  console.log(bundle.substring(Math.max(0, idx - 300), idx + 500));
}
