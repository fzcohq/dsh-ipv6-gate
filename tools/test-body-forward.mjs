// 测试 gate 的 POST body 转发（验证反代管道是否截断大请求体）
const HOST = 'cheese-house.duckdns.org';
const PIN = 'yrq4weus38yv';

async function test() {
  // 1) 认证
  const authRes = await fetch(`https://${HOST}:8787/?key=${PIN}`, { redirect: 'manual' });
  const cookie = (authRes.headers.get('set-cookie') || '').split(';')[0];
  console.log('auth:', authRes.status, '| cookie OK:', Boolean(cookie));
  if (!cookie) return;

  // 2) POST 小 body（1KB）
  const smallBody = JSON.stringify({ test: 'x'.repeat(1024) });
  const r1 = await fetch(`https://${HOST}:8787/api/session/attachment`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json', origin: `https://${HOST}:8787` },
    body: smallBody,
  });
  console.log('POST 1KB:', r1.status, await r1.text().then(t => t.substring(0, 100)));

  // 3) POST 大 body（5MB，模拟 PDF base64）
  const bigBody = JSON.stringify({ test: 'x'.repeat(5 * 1024 * 1024) });
  const startTime = Date.now();
  const r2 = await fetch(`https://${HOST}:8787/api/session/attachment`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json', origin: `https://${HOST}:8787` },
    body: bigBody,
  });
  const elapsed = Date.now() - startTime;
  const r2text = await r2.text();
  console.log(`POST 5MB: ${r2.status} (${elapsed}ms) |`, r2text.substring(0, 100));

  // 4) 20MB（超过常见 PDF base64 大小）
  const hugeBody = JSON.stringify({ test: 'x'.repeat(20 * 1024 * 1024) });
  const start2 = Date.now();
  const r3 = await fetch(`https://${HOST}:8787/api/session/attachment`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json', origin: `https://${HOST}:8787` },
    body: hugeBody,
  });
  const elapsed2 = Date.now() - start2;
  const r3text = await r3.text();
  console.log(`POST 20MB: ${r3.status} (${elapsed2}ms) |`, r3text.substring(0, 100));
}

test().catch(e => console.error('test failed:', e.message));
