// 本地冒烟脚本：不装 profile，直接把网关指向真实 DSH webserver
// 用法：
//   node smoke.mjs                                   # 回环 8446, HTTP, pin=test1234
//   node smoke.mjs --tls --port 8445 --host ::       # 挂真证书、全域监听（手机可测）
import { createGate } from './lib/server.js';

const args = process.argv.slice(2);
function arg(name, dflt) {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : dflt;
}

const pin = arg('pin', 'test1234');
const port = Number(arg('port', 8446));
const host = arg('host', '127.0.0.1');
const upstream = Number(arg('upstream', 55338));
const tls = args.includes('--tls')
  ? {
      cert: 'C:/Users/HalsM/.dsh/ipv6-direct/certs/fullchain.pem',
      key: 'C:/Users/HalsM/.dsh/ipv6-direct/certs/key.pem',
    }
  : null;

const { server } = createGate({
  pin,
  host,
  port,
  upstreamPort: upstream,
  tls,
  // 独立进程拿不到 connection 服务，可用 --dshToken <值> 手动注入测试续登逻辑（真令牌需插件进程内获取）
  getLaunchToken: arg('dshToken', null) ? () => arg('dshToken') : null,
});
server.listen(port, host, () => {
  console.log(`SMOKE gate on http${tls ? 's' : ''}://${host}:${port} -> 127.0.0.1:${upstream} (pin=${pin})`);
});
