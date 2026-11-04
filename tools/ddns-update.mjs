// CLI：手动执行一次 DDNS 更新（验证/补录用）
// 用法：node tools/ddns-update.mjs <domain> <token> [--force]
import path from 'node:path';
import os from 'node:os';
import { createDdnsUpdater, detectStableIpv6 } from '../lib/ddns.js';
import { createDuckDnsProvider } from '../lib/providers/duckdns.js';

const args = process.argv.slice(2).filter((a) => a !== '--force');
const [domain, token] = args;
const force = process.argv.includes('--force');
if (!domain || !token) {
  console.error('用法: node tools/ddns-update.mjs <domain> <token> [--force]');
  process.exit(2);
}

const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const stateFile = path.join(home, 'dsh-ipv6-gate', 'ddns-state.json');
const address = await detectStableIpv6();
console.log(`[ddns] detected stable IPv6: ${address || '(none)'}`);
if (!address) process.exit(1);

const updater = createDdnsUpdater({
  provider: createDuckDnsProvider({ token }),
  domain,
  stateFile,
  log: (m) => console.log(`[ddns] ${m}`),
});
const result = await updater.tick(force);
console.log(result ? `[ddns] ok -> ${result}` : '[ddns] failed (see state file)');
console.log(`[ddns] state: ${stateFile}`);
process.exit(result ? 0 : 1);
