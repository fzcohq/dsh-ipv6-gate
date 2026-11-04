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
//

// 客户端 bundle 校验：必须是 __ModuleLoader__ 普通脚本（不能 ESM），factory 必须返回带 apply 的对象
const clientExists = existsSync(new URL('../lib/client.js', import.meta.url));
let clientOk = false;
if (clientExists) {
  const clientSrc = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
  const hasLoader = clientSrc.includes('window.__ModuleLoader__.load');
  const notEsm = !/^\s*(import|export)\s/m.test(clientSrc);
  const hasApply = clientSrc.includes('apply');
  clientOk = hasLoader && notEsm && hasApply;
  console.log(hasLoader ? 'PASS: client.js 使用 __ModuleLoader__.load' : 'FAIL: client.js 缺少 __ModuleLoader__.load');
  console.log(notEsm ? 'PASS: client.js 是普通脚本（非 ESM）' : 'FAIL: client.js 含 ESM 语法');
  console.log(hasApply ? 'PASS: client.js 含 apply 方法' : 'FAIL: client.js 缺少 apply');
} else {
  console.log('SKIP: 无 lib/client.js（纯服务端模式）');
  clientOk = true;
}

// package.json 校验：client 字段与文件一致
const pkgHasClient = Boolean(pkg.dsh?.client);
console.log(pkgHasClient === clientExists
  ? 'PASS: dsh.client 与 lib/client.js 一致'
  : `FAIL: dsh.client=${pkgHasClient} vs client.js=${clientExists}`);

process.exit(ok && clientOk && pkgHasClient === clientExists ? 0 : 1);
