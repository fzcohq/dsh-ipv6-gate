// 调试脚本：模拟浏览器请求链，检查 client.js 的完整 serving 链路
const base = 'http://127.0.0.1:3090';
const token = process.argv[2] || '';

// 1) 认证（token 换 cookie）
const authRes = await fetch(base + '/?token=' + token, { redirect: 'manual' });
const setCookie = authRes.headers.get('set-cookie') || '';
console.log('auth:', authRes.status, 'location:', authRes.headers.get('location'));
console.log('set-cookie:', setCookie.split(';')[0]);
const cookie = setCookie.split(';')[0];

// 2) 获取首页 HTML
const pageRes = await fetch(base + '/', { headers: { cookie } });
const html = await pageRes.text();
console.log('page:', pageRes.status, 'length:', html.length);

// 3) boot 载荷中 ipv6-gate 的引用
const gateRefs = html.match(/dsh-ipv6-gate[^\s"']*/g);
console.log('gate refs in HTML:', gateRefs ? gateRefs.slice(0, 5) : '(none)');

// 4) 直接获取 client.js
const clientRes = await fetch(base + '/plugins/dsh-ipv6-gate/client.js', { headers: { cookie } });
const clientText = await clientRes.text();
console.log('client.js direct:', clientRes.status, 'len:', clientText.length,
  'head:', clientText.substring(0, 60).replace(/\n/g, '\\n'));

// 5) combo URL 检查
const comboMatch = html.match(/\/plugins\?\?([^"'\s]+)/);
if (comboMatch) {
  const comboUrl = base + '/plugins??' + decodeURIComponent(comboMatch[1]).split('&')[0];
  console.log('combo first entry:', comboUrl.replace(base, ''));
  const comboRes = await fetch(comboUrl, { headers: { cookie } });
  const comboText = await comboRes.text();
  console.log('combo:', comboRes.status, 'len:', comboText.length);
}
