// DDNS 模块：周期性探测本机稳定 IPv6，变化时更新 AAAA 记录
// - 地址探测复用 lib/addr.js 的 parseStableIpv6（已用真实 ipconfig fixture 测试）
// - 状态落盘 ddns-state.json：无变化时跳过 API 调用；也便于外部验收
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseStableIpv6 } from './addr.js';

const execFileAsync = promisify(execFile);

/** 探测本机"稳定"全球单播 IPv6（排除 Temporary） */
export async function detectStableIpv6({ exec = execFileAsync, platform = process.platform } = {}) {
  if (platform === 'win32') {
    const { stdout } = await exec('ipconfig', [], { encoding: 'utf8', timeout: 15000, windowsHide: true });
    return parseStableIpv6(stdout);
  }
  if (platform === 'darwin') {
    // macOS：ifconfig 的 inet6 行，排除 link-local(fe80) 与 temporary 地址
    try {
      const { stdout } = await exec('ifconfig', [], { encoding: 'utf8', timeout: 15000 });
      for (const line of String(stdout).split('\n')) {
        const m = line.match(/inet6\s+([0-9a-f:]+)/i);
        if (!m) continue;
        const addr = m[1].toLowerCase();
        if (!/^[23][0-9a-f]/.test(addr)) continue;
        if (/temporary/i.test(line)) continue;
        return addr;
      }
      return null;
    } catch {
      return null;
    }
  }
  // Linux：`ip -6 addr` 的 global 范围
  try {
    const { stdout } = await exec('ip', ['-6', 'addr', 'show', 'scope', 'global'], { encoding: 'utf8', timeout: 15000 });
    const m = stdout.match(/inet6\s+([0-9a-f:]+)\/(\d+)/i);
    if (!m) return null;
    const addr = m[1].toLowerCase();
    return /^[23][0-9a-f]/.test(addr) ? addr : null;
  } catch {
    return null;
  }
}

/**
 * @param {object} opts
 * @param {{updateAAAA:Function}} opts.provider  DNS 提供方（duckdns 等）
 * @param {string} opts.domain                   记录域名（如 xxx.duckdns.org）
 * @param {string} [opts.stateFile]              状态文件路径
 * @param {number} [opts.intervalMs=3600000]     周期
 * @param {Function} [opts.detect]               地址探测实现（测试注入）
 * @param {Function} [opts.now]
 * @param {Function} [opts.log]
 */
export function createDdnsUpdater({
  provider,
  domain,
  stateFile,
  intervalMs = 3600_000,
  detect = detectStableIpv6,
  now = () => Date.now(),
  log = () => {},
} = {}) {
  if (!provider || !domain) throw new Error('createDdnsUpdater: provider and domain are required');
  let timer = null;

  function readState() {
    if (!stateFile) return null;
    try {
      return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    } catch {
      return null;
    }
  }

  function writeState(state) {
    if (!stateFile) return;
    try {
      fs.mkdirSync(path.dirname(stateFile), { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
    } catch {}
  }

  /** 单次检查：返回当前地址（未变化时也返回），失败返回 null */
  async function tick(force = false) {
    try {
      const address = await detect();
      if (!address) {
        writeState({ address: null, at: now(), error: 'no stable global IPv6 found' });
        log('ddns: no stable IPv6 found (skipped)');
        return null;
      }
      const prev = readState();
      if (!force && prev && prev.address === address) {
        return address; // 无变化：不打扰 API
      }
      await provider.updateAAAA({ domain, address });
      writeState({ address, at: now(), error: null });
      log(`ddns: AAAA ${domain} -> ${address}`);
      return address;
    } catch (e) {
      writeState({ address: null, at: now(), error: String(e?.message || e) });
      log(`ddns: update failed: ${e?.message || e}`);
      return null;
    }
  }

  function start({ delayMs = 3000 } = {}) {
    const kick = () => { tick().catch(() => {}); };
    if (delayMs > 0) {
      const first = setTimeout(kick, delayMs);
      if (typeof first.unref === 'function') first.unref();
    } else {
      kick();
    }
    timer = setInterval(() => { tick().catch(() => {}); }, intervalMs);
    if (typeof timer.unref === 'function') timer.unref();
    return timer;
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { start, stop, tick, readState };
}
