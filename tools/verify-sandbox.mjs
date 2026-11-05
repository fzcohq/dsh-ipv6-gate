const base = 'http://127.0.0.1:3090';
const token = process.argv[2];

const authRes = await fetch(base + '/?token=' + token, { redirect: 'manual' });
const cookie = (authRes.headers.get('set-cookie') || '').split(';')[0];

// 1) /__gate-config API
const cfgRes = await fetch(base + '/__gate-config', { headers: { cookie } });
const cfg = await cfgRes.json();
console.log('API:', cfgRes.status, '| ipv6:', cfg.ipv6 || '(none)', '| valid:', /^2/.test(cfg.ipv6 || '') ? 'YES' : 'NO');

// 2) boot payload 有 dsh-ipv6-gate
const pageRes = await fetch(base + '/', { headers: { cookie } });
const html = await pageRes.text();
console.log('boot payload has gate:', html.includes('dsh-ipv6-gate') ? 'YES' : 'NO');

// 3) 找到 combo script src 并验证内容
const srcMatch = html.match(/src="(plugins\/\?\?[^"]*dsh-ipv6-gate[^"]*)"/);
if (srcMatch) {
  const src = srcMatch[1].replaceAll('&amp;', '&');
  const r = await fetch(base + '/' + src, { headers: { cookie } });
  const t = await r.text();
  console.log('combo:', r.status, '| has IPv6 title:', t.includes('手机 IPv6 远程访问') ? 'YES' : 'NO',
    '| has loading:', t.includes('正在获取 IPv6 地址') ? 'YES' : 'NO',
    '| inject slots:', t.includes("inject: ['slots']") ? 'YES' : 'NO',
    '| old port editor gone:', !t.includes('输入新端口号') ? 'YES' : 'NO');
} else {
  console.log('combo: not found in script tags');
}

console.log(cfg.ipv6 && cfgRes.status === 200 ? '\n结论: 沙箱验证通过' : '\n结论: 有问题');
