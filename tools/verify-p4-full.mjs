// P4 完整沙箱验证：双通道 + 双密码 + API 操作
const base = 'http://127.0.0.1:3090';
const token = process.argv[2];

const authRes = await fetch(base + '/?token=' + token, { redirect: 'manual' });
const cookie = (authRes.headers.get('set-cookie') || '').split(';')[0];

async function api(path, opts = {}) {
  const r = await fetch(base + path, { ...opts, headers: { cookie, 'content-type': 'application/json', ...opts.headers } });
  return { status: r.status, body: await r.json() };
}

console.log('═══ 1) GET /__gate-config（初始状态） ═══');
const s1 = await api('/__gate-config');
console.log('status:', s1.status);
console.log('ipv6:', s1.body.ipv6 || '(none)');
console.log('http.enabled:', s1.body.http?.enabled, '| port:', s1.body.http?.port, '| pw:', s1.body.http?.password ? '***' : '(none)');
console.log('https.enabled:', s1.body.https?.enabled, '| port:', s1.body.https?.port, '| pw:', s1.body.https?.password ? '***' : '(none)');
console.log('domain:', s1.body.domain);
console.log('httpQr:', s1.body.httpQr ? `${Math.round(s1.body.httpQr.length/1024)}KB PNG` : '(empty)');
console.log('httpsQr:', s1.body.httpsQr ? `${Math.round(s1.body.httpsQr.length/1024)}KB PNG` : '(empty)');

console.log('\n═══ 2) 开启 HTTP ═══');
const t1 = await api('/__gate-config', { method: 'POST', body: JSON.stringify({ action: 'toggleHttp', enabled: true }) });
console.log('result:', t1.body);

console.log('\n═══ 3) 改 HTTP 密码 ═══');
const t2 = await api('/__gate-config', { method: 'POST', body: JSON.stringify({ action: 'setHttpPassword', password: 'newpass123' }) });
console.log('result:', t2.body);

console.log('\n═══ 4) 改无效密码（应失败） ═══');
const t3 = await api('/__gate-config', { method: 'POST', body: JSON.stringify({ action: 'setHttpPassword', password: 'short' }) });
console.log('result:', t3.body);

console.log('\n═══ 5) 关闭 HTTP ═══');
const t4 = await api('/__gate-config', { method: 'POST', body: JSON.stringify({ action: 'toggleHttp', enabled: false }) });
console.log('result:', t4.body);

console.log('\n═══ 6) 最终状态 ═══');
const s2 = await api('/__gate-config');
console.log('http.enabled:', s2.body.http?.enabled, '| password:', s2.body.http?.password);

console.log('\n═══ 结论 ═══');
const allPass = s1.status === 200 && t1.body.ok && t2.body.ok && !t3.body.ok && t4.body.ok && s2.body.http?.password === 'newpass123';
console.log(allPass ? '✅ 全部通过' : '❌ 有失败项');
