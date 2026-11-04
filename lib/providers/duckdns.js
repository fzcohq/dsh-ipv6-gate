// DuckDNS 记录提供方
// - TXT（DNS-01 验证）：GET https://www.duckdns.org/update?domains=&token=&txt=
// - AAAA（DDNS）：GET https://www.duckdns.org/update?domains=&token=&ipv6=
// API 事实来源：acme.sh dnsapi/dns_duckdns.sh + 官方 update 接口
// 注意：DuckDNS 每个域名只有一条 TXT 记录，所有子域共享。
export function createDuckDnsProvider({ token, fetchImpl = globalThis.fetch, api = 'https://www.duckdns.org/update' } = {}) {
  if (!token) throw new Error('duckdns: token is required');

  function subdomainOf(domain) {
    const m = String(domain || '').toLowerCase().match(/([a-z0-9-]+)\.duckdns\.org$/);
    if (!m) throw new Error(`duckdns: not a duckdns domain: ${domain}`);
    return m[1];
  }

  async function call({ domains, txt, clear, ipv6 }) {
    const qs = new URLSearchParams({ domains, token });
    if (txt !== undefined) qs.set('txt', txt);
    if (clear) qs.set('clear', 'true');
    if (ipv6 !== undefined) qs.set('ipv6', ipv6);
    const res = await fetchImpl(`${api}?${qs.toString()}`);
    const body = (await res.text()).trim();
    if (!res.ok || !body.startsWith('OK')) throw new Error(`duckdns: HTTP ${res.status} ${body}`);
    return body;
  }

  return {
    name: 'duckdns',
    /** DNS-01：写入 _acme-challenge TXT */
    async update({ domain, value }) {
      await call({ domains: subdomainOf(domain), txt: value });
    },
    /** DNS-01：清理 TXT */
    async clear({ domain }) {
      await call({ domains: subdomainOf(domain), txt: '', clear: true });
    },
    /** DDNS：更新 AAAA 记录 */
    async updateAAAA({ domain, address }) {
      await call({ domains: subdomainOf(domain), ipv6: address });
    },
  };
}
