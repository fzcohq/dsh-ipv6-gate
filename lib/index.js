// dsh-ipv6-gate —— Phase 0 骨架
// Cordis 插件约定：name / inject / apply 三个导出（缺 apply 会被静默跳过——v1.0.0 踩过的坑）
export const name = 'dsh-ipv6-gate';

// 等 webServer 服务发布后才调用 apply（compose 期 ctx.get 拿到的是 undefined）
export const inject = ['webServer'];

export function apply(ctx, config = {}) {
  const log = ctx.logger('dsh-ipv6-gate');
  log.info('loaded (phase 0 skeleton)');

  // ---- Phase 1：直连反代（下一里程碑）----
  // [ ] HTTPS 服务器监听 [::]:<port>（默认 8443，进程内 node:https）
  // [ ] Host/Origin/Referer 改写为 127.0.0.1:<DSH webserver 端口>（特权 API 保真的关键，独立实现，勿抄 GPL 代码）
  // [ ] PIN 认证：密码 → HttpOnly Cookie（sha256(PIN:sessionKey)，绑定进程）+ 失败锁定 + 一键换密
  // [ ] WebSocket upgrade 透传（流式输出依赖）
  // ---- Phase 2：证书 ----
  // [ ] acme-client + DNS 提供商 API 做 DNS-01 签发/续期（不依赖入站 80/443）
  // ---- Phase 3：DDNS ----
  // [ ] 定时解析本机"稳定"IPv6（排除 Temporary，spawn ipconfig 法已验证）→ 更新 AAAA
  // ---- Phase 4：体验 ----
  // [ ] 设置页 + 入口二维码；移动端适配 = dsh-web-mobile(MIT) 以 npm 依赖 + cordis.patch.yml 伴随 insert（加载顺序为验证项）
  // ---- Phase 5（可选）----
  // [ ] transport shim 干净重写（先实测 0.2.x 无它是否可行）
}
