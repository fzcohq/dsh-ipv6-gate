// DuckDNS TXT 记录提供方（DNS-01 验证用）
// API 事实来源：acme.sh dnsapi/dns_duckdns.sh（GET https://www.duckdns.org/update?domains=&token=&txt=）
// 注意：DuckDNS 每个域名只有一条 TXT 记录，所有子域共享。
export function createDuckDnsProvider({ token, fetchImpl = globalThis.fetch, api = 'https://www.duckdns.org/update' } = {}) {
  if (!token) throw new Error('duckdns: token is required');

  function subdomainOf(domain) {
    const m = String(domain || '').toLowerCase().match(/([a-z0-9-]+)\.duckdns\.org$/);
    if (!m) throw new Error(`duckdns: not a duckdns domain: ${domain}`);
    return m[1];
  }

  async function call({ domains, txt, clear }) {
    const qs = new URLSearchParams({ domains, token });
    if (txt !== undefined) qs.set('txt', txt);
    if (clear) qs.set('clear', 'true');
    const res = await fetchImpl(`${api}?${qs.toString()}`);
    const body = (await res.text()).trim();
    if (!res.ok || !body.startsWith('OK')) throw new Error(`duckdns: HTTP ${res.status} ${body}`);
    return body;
  }

  return {
    name: 'duckdns',
    async update({ domain, value }) {
      await call({ domains: subdomainOf(domain), txt: value });
    },
    async clear({ domain }) {
      await call({ domains: subdomainOf(domain), txt: '', clear: true });
    },
  };
}
