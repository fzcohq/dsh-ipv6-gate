// P4.1 沙箱验证：?key= 自动认证 + 服务端 QR 生成
const base = 'http://127.0.0.1:3090';
const token = process.argv[2];

const authRes = await fetch(base + '/?token=' + token, { redirect: 'manual' });
const cookie = (authRes.headers.get('set-cookie') || '').split(';')[0];

// 1) /__gate-config 返回 QR 码
const cfgRes = await fetch(base + '/__gate-config', { headers: { cookie } });
const cfg = await cfgRes.json();
console.log('=== /__gate-config ===');
console.log('status:', cfgRes.status);
console.log('ipv6:', cfg.ipv6 || '(none)');
console.log('httpQr:', cfg.httpQr ? `data:image/png (${Math.round(cfg.httpQr.length / 1024)}KB)` : '(empty)');
console.log('httpsQr:', cfg.httpsQr ? `data:image/png (${Math.round(cfg.httpsQr.length / 1024)}KB)` : '(empty)');
console.log('tlsDomain:', cfg.tlsDomain || '(none)');

const hasQr = cfg.httpQr && cfg.httpQr.startsWith('data:image/png;base64,');
console.log('httpQr valid PNG:', hasQr ? 'YES ✓' : 'NO ✗');

// 2) ?key= 自动认证（测 preflight 的 8447 端口上的网关）
console.log('\n=== ?key= 自动认证（通过 preflight 网关 8447）===');
try {
  // 启动 preflight 网关（在 8447）
  const { execSync } = await import('node:child_process');
  // 先看 8447 是否已有网关在跑
  const probe = await fetch('http://127.0.0.1:8447/', { redirect: 'manual' }).catch(() => null);
  if (probe) {
    // 用错误的 key 测——应该 200 返回登录页（不自动认证）
    const wrongKey = await fetch('http://127.0.0.1:8447/?key=wrongpassword', { redirect: 'manual' });
    console.log('wrong key:', wrongKey.status, wrongKey.headers.get('location') ? 'REDIRECT(不应发生)' : 'LOGIN PAGE(正确)');

    // 用正确的 key 测——应该 302 redirect + set-cookie
    // pin 是 preflight 生成的，我们不知道确切值，只测格式
    console.log('(正确 key 测试需要知道 PIN——在 preflight 模式下由 auth.js 处理)');
  } else {
    console.log('preflight 网关 8447 未运行');
  }
} catch (e) {
  console.log('auth test skip:', e.message);
}

console.log('\n=== 结论 ===');
console.log(hasQr ? 'QR 生成 ✓' : 'QR 生成 ✗');
