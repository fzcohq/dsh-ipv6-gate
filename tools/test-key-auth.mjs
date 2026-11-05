// 测试 ?key= 自动认证：起一个临时网关在 18445
import { createGate } from '../lib/server.js';

const PIN = 'test-key-123';
const gate = createGate({
  pin: PIN,
  host: '127.0.0.1',
  port: 18445,
  upstreamPort: 3090, // 沙箱 webServer
  tls: null,
  getLaunchToken: () => null,
  log: () => {},
});

gate.server.listen(18445, '127.0.0.1', async () => {
  console.log('test gate on 18445');

  // 1) 无 key：应返回 200 登录页
  const r1 = await fetch('http://127.0.0.1:18445/', { redirect: 'manual' });
  console.log('no key:', r1.status, r1.headers.get('location') ? 'REDIRECT(错)' : 'LOGIN(对)');
  const body1 = await r1.text();
  console.log('  is login page:', body1.includes('enter PIN') ? 'YES' : 'NO');

  // 2) 错误 key：应返回 200 登录页（不自动认证）
  const r2 = await fetch('http://127.0.0.1:18445/?key=wrong', { redirect: 'manual' });
  console.log('wrong key:', r2.status, r2.headers.get('location') ? 'REDIRECT(错)' : 'LOGIN(对)');

  // 3) 正确 key：应返回 302 + set-cookie
  const r3 = await fetch(`http://127.0.0.1:18445/?key=${PIN}`, { redirect: 'manual' });
  const hasCookie = Boolean(r3.headers.get('set-cookie'));
  console.log('correct key:', r3.status, r3.status === 302 ? 'REDIRECT(对)' : 'NOT REDIRECT(错)',
    '| cookie:', hasCookie ? 'SET(对)' : 'MISSING(错)');
  console.log('  redirect to:', r3.headers.get('location'));

  // 4) 用 3) 的 cookie 再访问：应不再需要登录（但会因 upstream 不在而报错，只要不是登录页就算通过）
  const cookie3 = (r3.headers.get('set-cookie') || '').split(';')[0];
  if (cookie3) {
    const r4 = await fetch('http://127.0.0.1:18445/', {
      redirect: 'manual',
      headers: { cookie: cookie3 },
    });
    const body4 = await r4.text();
    const stillLogin = body4.includes('enter PIN');
    console.log('with cookie:', r4.status, stillLogin ? 'STILL LOGIN(错)' : 'PASSED AUTH(对)');
  }

  console.log('\n结论: ?key= 自动认证', r3.status === 302 && hasCookie ? '✓ 通过' : '✗ 失败');
  gate.close();
  process.exit(0);
});
