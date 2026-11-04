// 头改写模块：把外部来源改写为回环权威，令 DSH 信任栅栏放行特权 API
// 独立实现（通用反代技术，未复制任何 GPL 代码）
export function rewriteHeaders(headers, authority, { scheme = 'http' } = {}) {
  const h = { ...headers };
  h.host = authority;
  if (h.origin) h.origin = `${scheme}://${authority}`;
  if (h.referer) h.referer = `${scheme}://${authority}/`;
  delete h.connection; // hop-by-hop，由代理层自行决定
  return h;
}
