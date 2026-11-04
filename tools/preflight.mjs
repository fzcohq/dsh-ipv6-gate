// 启动预检：用假 ctx 在真实 Node 进程里跑 apply，专抓"装进宿主就崩"的问题
// 1) index.js 可导入、apply 不抛异常、网关能监听并返回登录页
// 2) client.js 必须是 __ModuleLoader__ 包装的普通脚本（不能是 ESM export）
import { readFileSync } from 'node:fs';
import { apply } from '../lib/index.js';

const UPSTREAM = Number(process.argv[2] || 62764);
const PORT = Number(process.argv[3] || 8446);

const ctx = {
  logger: () => ({
    info: (m) => console.log('[info]', m),
    warn: (m) => console.warn('[warn]', m),
  }),
  on: () => {},
  webServer: { port: UPSTREAM },
  connection: undefined,
};

apply(ctx, { port: PORT, host: '127.0.0.1', upstreamPort: UPSTREAM });
await new Promise((r) => setTimeout(r, 1500));

let ok = false;
try {
  const res = await fetch(`http://127.0.0.1:${PORT}/`);
  const body = await res.text();
  ok = res.status === 200 && body.includes('dsh-ipv6-gate');
  console.log(ok ? 'PASS: apply 可运行，登录页 200' : `FAIL: status=${res.status}`);
} catch (e) {
  console.log('FAIL: 请求网关异常', e?.message);
}

const client = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
const clientOk = client.includes('__ModuleLoader__.load') && !/^\s*export\s/m.test(client);
console.log(clientOk ? 'PASS: client.js 是 ModuleLoader 普通脚本' : 'FAIL: client.js 格式不对');

process.exit(ok && clientOk ? 0 : 1);
