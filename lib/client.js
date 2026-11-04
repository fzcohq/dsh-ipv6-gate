// dsh-ipv6-gate 浏览器端：宿主客户端 bundle 必须是 __ModuleLoader__.load 的普通脚本（不是 ESM）
// 本插件当前不需要客户端 UI（Phase 4 再填设置页）；空 factory 即可
window.__ModuleLoader__.load({ id: 'dsh-ipv6-gate', factory: (require) => ({}) });
