// 通过 gate 完整认证并获取页面 HTML（正确处理 401→303→303→200 链路）
const HOST = 'cheese-house.duckdns.org';
const PIN = 'yrq4weus38yv';
const BASE = `https://${HOST}:8787`;

const cookies = [];
async function step(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { cookie: cookies.join('; '), ...opts.headers },
    redirect: 'manual',
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookies.push(sc.split(';')[0]);
  return res;
}

// 1) PIN 认证
let res = await step(`${BASE}/?key=${PIN}`);
console.log('1) auth:', res.status, '| location:', (res.headers.get('location') || '').replace(/token=[^&]+/, 'token=***'));

// 2) 跟随到带 token 的 URL
let next = res.headers.get('location') || '/';
if (next.startsWith('/')) next = BASE + next;
res = await step(next);
console.log('2) token exchange:', res.status, '| location:', (res.headers.get('location') || '').replace(/token=[^&]+/, 'token=***'));

// 3) 跟随到最终页面
next = res.headers.get('location') || '/';
if (next.startsWith('.')) next = BASE + '/' + next.replace(/^\.\/?/, '');
if (next.startsWith('/')) next = BASE + next;
if (!next.startsWith('http')) next = BASE + '/';
res = await step(next);
console.log('3) page:', res.status, '| location:', (res.headers.get('location') || '').replace(/token=[^&]+/, 'token=***'));

let html = await res.text();
if (html.length < 100 && res.headers.get('location')) {
  next = res.headers.get('location');
  if (next.startsWith('.')) next = BASE + '/' + next.replace(/^\.\/?/, '');
  if (next.startsWith('/')) next = BASE + next;
  res = await step(next);
  console.log('4) follow:', res.status);
  html = await res.text();
}

console.log('\nHTML:', html.length, 'bytes');
console.log('cookies:', cookies.length);

if (html.length > 1000) {
  const fs = await import('node:fs');
  fs.writeFileSync('C:/Users/HalsM/OneDrive/Documents/deepseek-harness/default-workspace/dsh-ipv6-gate/tools/page-dump.html', html);
  console.log('saved');

  const ref = html.match(/file-upload[^"']{0,120}/);
  if (ref) console.log('\nfile-upload ref:', ref[0]);
  const urls = [...html.matchAll(/"url":"([^"]+)"/g)].map(x => x[1]).filter(u => u.includes('client.js'));
  console.log('\nboot URLs (first 5):');
  urls.slice(0, 5).forEach(u => console.log(' ', u.substring(0, 120)));
  const localRefs = [...html.matchAll(/127\.0\.0\.1[^"'<\s]{0,40}/g)].slice(0, 5).map(x => x[0]);
  if (localRefs.length) { console.log('\n127.0.0.1 in HTML:'); localRefs.forEach(r => console.log(' ', r)); }
  else console.log('\nno 127.0.0.1 in HTML');

  const apiBase = html.match(/"apiBase":"([^"]+)"/) || html.match(/"baseUrl":"([^"]+)"/) || html.match(/"origin":"([^"]+)"/);
  console.log('\nAPI base:', apiBase ? apiBase[1] : '(not found)');
}
