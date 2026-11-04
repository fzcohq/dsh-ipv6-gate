// 地址探测模块（Phase 3 提前实现：纯函数，先行测试）
// 从 ipconfig 输出解析"稳定"的全球单播 IPv6 —— 排除 Temporary（隐私扩展，会轮换）与链路本地
// 这是手搭栈 update-ddns.ps1 已验证逻辑的 JS 移植（PowerShell 版见 ~/.dsh/ipv6-direct/）
export function parseStableIpv6(ipconfigText) {
  for (const raw of String(ipconfigText || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!/IPv6/i.test(line)) continue;
    if (/Temporary|临时/i.test(line)) continue;
    const m = line.match(/([0-9a-f]{1,4}(?::[0-9a-f]{0,4}){2,7})/i);
    if (!m) continue;
    const addr = m[1].toLowerCase();
    // 全球单播 2000::/3：首十六进制位为 2 或 3（排除 fe80 链路本地、fd00 ULA 等）
    if (!/^[23][0-9a-f]/.test(addr)) continue;
    return addr;
  }
  return null;
}
