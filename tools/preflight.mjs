// 启动预检：用假 ctx 在真实 Node 进程里跑 apply，专抓"装进宿主就崩"的问题
// 新架构：gate-manager 管理双通道，默认都关闭；预检验证插件加载不崩 + API 正常
import { readFileSync, existsSync } from 'node:fs';
import http from 'node:http';
import { apply } from '../lib/index.js';

const UPSTREAM = Number(process.argv[2] || 62764);

// 假的上游服务器（让网关有东西可以代理）
const upstream = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<html><body>upstream ok</body></html>');
});
await new Promise((r) => upstream.listen(UPSTREAM + 100, '127.0.0.1', r));

let registeredRoutes = [];
const ctx = {
  logger: () => ({
    info: (m) => console.log('[info]', m),
    warn: (m) => console.warn('[warn]', m),
  }),
  on: () => {},
  webServer: {
    port: UPSTREAM + 100,
    register: (route) => {
      registeredRoutes.push(route.path);
      return () => {};
    },
  },
  connection: undefined,
};

try {
  apply(ctx, { upstreamPort: UPSTREAM + 100 });
  await new Promise((r) => setTimeout(r, 1000));
  console.log('PASS: apply 可运行，无异常');
} catch (e) {
  console.log('FAIL: apply 抛出异常:', e?.message);
  process.exit(1);
}

// 验证 API 路由已注册
const hasConfigApi = registeredRoutes.includes('/__gate-config');
console.log(hasConfigApi ? 'PASS: /__gate-config API 已注册' : 'FAIL: API 未注册');

// 客户端 bundle 校验
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const clientPath = new URL('../client/client.js', import.meta.url);
const clientExists = existsSync(clientPath);
let clientOk = false;
if (clientExists) {
  const clientSrc = readFileSync(clientPath, 'utf8');
  const hasLoader = clientSrc.includes('window.__ModuleLoader__.load');
  const notEsm = !/^\s*(import|export)\s/m.test(clientSrc);
  const hasApply = clientSrc.includes('apply');
  const hasInject = clientSrc.includes('inject');
  clientOk = hasLoader && notEsm && hasApply && hasInject;
  console.log(hasLoader ? 'PASS: client.js 使用 __ModuleLoader__.load' : 'FAIL: 缺少 __ModuleLoader__.load');
  console.log(notEsm ? 'PASS: client.js 是普通脚本（非 ESM）' : 'FAIL: 含 ESM 语法');
  console.log(hasApply ? 'PASS: client.js 含 apply 方法' : 'FAIL: 缺少 apply');
  console.log(hasInject ? 'PASS: client.js 含 inject 声明' : 'FAIL: 缺少 inject');
} else {
  console.log('SKIP: 无 client/client.js');
  clientOk = true;
}

const pkgHasClient = Boolean(pkg.dsh?.client);
console.log(pkgHasClient === clientExists ? 'PASS: dsh.client 与文件一致' : 'FAIL: 不一致');

upstream.close();
process.exit(hasConfigApi && clientOk && pkgHasClient === clientExists ? 0 : 1);
