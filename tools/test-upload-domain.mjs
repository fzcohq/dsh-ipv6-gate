// 通过域名测试上传（证书匹配）
const GATE = 'https://cheese-house.duckdns.org:8787';
const PIN = 'yrq4weus38yv';

// 1) 认证
const authRes = await fetch(`${GATE}/?key=${PIN}`, { redirect: 'manual' });
const cookie = (authRes.headers.get('set-cookie') || '').split(';')[0];
console.log('auth:', authRes.status, '| cookie OK:', Boolean(cookie));

// 2) 加载主页（建立 DSH 会话）
const pageRes = await fetch(`${GATE}/`, { redirect: 'follow', headers: { cookie } });
console.log('page:', pageRes.status);

// 3) 收集所有 cookie
const dshCookie = (pageRes.headers.get('set-cookie') || '').split(';')[0];
const allCookies = [cookie, dshCookie].filter(Boolean).join('; ');

// 4) POST JSON（测 body 转发）
try {
  const jsonRes = await fetch(`${GATE}/api/session/attachment`, {
    method: 'POST',
    headers: { cookie: allCookies, 'content-type': 'application/json', origin: GATE },
    body: JSON.stringify({ test: 'body-forwarding-check' }),
  });
  const jsonBody = await jsonRes.text();
  console.log('\nJSON POST:', jsonRes.status, '|', jsonBody.substring(0, 150));
} catch (e) {
  console.log('\nJSON POST failed:', e.message);
}

// 5) POST multipart（模拟文件上传）
try {
  const fd = new FormData();
  fd.append('file', new Blob(['test pdf content for gate upload'], { type: 'application/pdf' }), 'test.pdf');
  const upRes = await fetch(`${GATE}/upload`, {
    method: 'POST',
    headers: { cookie: allCookies, origin: GATE },
    body: fd,
  });
  const upBody = await upRes.text();
  console.log('multipart POST /upload:', upRes.status, '|', upBody.substring(0, 150));
} catch (e) {
  console.log('multipart POST failed:', e.message);
}

// 6) 大 body 测试（1MB，测管道是否截断）
try {
  const bigBody = 'x'.repeat(1024 * 1024); // 1MB
  const bigRes = await fetch(`${GATE}/api/session/attachment`, {
    method: 'POST',
    headers: { cookie: allCookies, 'content-type': 'application/json', origin: GATE },
    body: JSON.stringify({ data: bigBody.substring(0, 100) + '...[1MB total]' }),
  });
  console.log('\n1MB body POST:', bigRes.status, '|', (await bigRes.text()).substring(0, 100));
} catch (e) {
  console.log('\n1MB body POST failed:', e.message);
}
