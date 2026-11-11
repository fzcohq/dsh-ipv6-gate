// DDNS 服务：管理单个 AAAA 更新器实例（可热切换域名/Token）
// - 设置页保存域名、启动时加载配置，两条路径都走这里，保证 DDNS 一定被启动
import path from 'node:path';
import { createDdnsUpdater } from './ddns.js';
import { createDuckDnsProvider } from './providers/duckdns.js';

/** 子域名 → 完整域名（已含点则原样返回） */
export function fullDomain(name) {
  const value = String(name || '').trim();
  if (!value) return '';
  return value.includes('.') ? value : `${value}.duckdns.org`;
}

export function createDdnsService({
  stateDir,
  log = () => {},
  providerFactory = createDuckDnsProvider,
  updaterFactory = createDdnsUpdater,
} = {}) {
  let current = null; // { updater, domain, token }

  function stop() {
    if (!current) return;
    try { current.updater.stop(); } catch {}
    current = null;
  }

  /**
   * 启动或热切换 DDNS 更新器。
   * @returns {boolean} 是否处于运行状态
   */
  function start(name, token, { intervalMs = 3600_000 } = {}) {
    const domain = fullDomain(name);
    const secret = String(token || '').trim();
    if (!domain || !secret) return false;
    if (current && current.domain === domain && current.token === secret) return true;

    stop();
    try {
      const updater = updaterFactory({
        provider: providerFactory({ token: secret }),
        domain,
        stateFile: path.join(stateDir, 'ddns-state.json'),
        intervalMs,
        log,
      });
      updater.start();
      current = { updater, domain, token: secret };
      log(`ddns: updater started for ${domain}`);
      return true;
    } catch (e) {
      log(`ddns: start failed: ${e?.message || e}`);
      current = null;
      return false;
    }
  }

  return {
    start,
    stop,
    /** 当前正在更新的域名（空串 = 未运行） */
    get domain() { return current ? current.domain : ''; },
    get running() { return Boolean(current); },
  };
}
