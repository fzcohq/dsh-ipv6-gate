// 启动预检：用假 ctx 在真实 Node 进程里跑 apply，专抓"装进宿主就崩"的问题
// 关键教训（2026-11-04 两次真机崩溃）：
//   桌面端会在渲染进程激活 dsh.client 条目；client.js 必须是 __ModuleLoader__ 脚本，
//   且 factory 返回带 apply 的插件对象——空对象会让整个应用启动失败。
//   本插件是服务端-only：package.json 的 dsh 里不应有 client 字段，lib/client.js 不应存在。
import { readFileSync, existsSync } from 'node:fs';
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

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const serverOnly = !pkg.dsh?.client;
console.log(serverOnly ? 'PASS: 服务端-only（dsh 无 client 字段）' : 'FAIL: package.json 仍声明 dsh.client !');

const clientExists = existsSync(new URL('../lib/client.js', import.meta.url));
console.log(clientExists ? 'FAIL: lib/client.js 仍存在（会触发渲染端激活）' : 'PASS: 无 lib/client.js');

process.exit(ok && serverOnly && !clientExists ? 0 : 1);
