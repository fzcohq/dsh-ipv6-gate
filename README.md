# dsh-ipv6-gate

**IPv6 远程访问网关插件**：双通道 HTTPS/HTTP + DDNS + ACME + 设置页 UI，把 DeepSeek Harness 零中继暴露到公网 IPv6。

## 架构

```
手机 ──HTTPS(LE证书)──> [::]:8787 HTTPS 网关（TLS h2+h1, PIN 认证）
手机 ──HTTP──────────> [::]:8788 HTTP  网关（明文, PIN 认证, 默认关）
                         ├─ 反代 + WS 透传 → DSH webserver
                         ├─ ?key= 扫码自动认证
                         └─ 独立密码/开关，设置页管理

DSH 设置页 →「手机 IPv6 远程访问」
  ├─ IPv6 地址（实时检测, 绿/灰/红）
  ├─ HTTP 连接（开关 + 二维码 + 密码）
  ├─ DuckDNS 域名（子域名 + Token, 自动签发证书）
  └─ HTTPS 连接（开关 + 二维码 + 密码）

插件内部：
  ├─ gate-manager（双通道生命周期 + settings.json 持久化）
  ├─ ACME DNS-01（DuckDNS API, 证书自动续期, 后台非阻塞）
  ├─ DDNS 定时器（稳定 IPv6 探测 → AAAA 更新, 每小时）
  └─ QR 码生成（服务端 qrcode 包 → PNG data URL）
```

零外部二进制、零系统级配置（无计划任务/Run 键/Caddy），装上插件即用，卸载即净。

## 路线图

| 阶段 | 内容 | 状态 |
|---|---|---|
| Phase 0-3 | 反代 + PIN + WS + TLS + ACME + DDNS | ✅ 2026-11-04 |
| Phase 4 | 设置页 UI + 双通道 + 二维码 + 扫码认证 | ✅ 2026-11-05 |
| Phase 5 | 可选：Cloudflare provider / TOTP | ⬜ |

## 端口

| 通道 | 端口 | 默认 | 说明 |
|---|---|---|---|
| HTTPS | 8787 | 关 | TLS 证书自动管理 |
| HTTP | 8788 | 关 | 明文，仅建议局域网调试 |

## 客户端开发要点（踩坑记录）

- client bundle 必须是 `window.__ModuleLoader__.load({id, factory})` 普通脚本（非 ESM）
- factory 返回 `{apply, inject}`，inject 用**短服务名**（`'slots'`），不是包名
- React hooks 必须在所有 early return 之前调用
- 路由注册用 `ctx.webServer.register({kind:'exact', path, handler})`（handler 嵌在对象里）
- `dsh.client.inject` 用完整包名（控制脚本加载顺序）

## 开发

```sh
npm install
npm test             # 47 tests
node tools/preflight.mjs <upstreamPort>  # 部署预检
```

## 许可证

MIT。禁止从 GPL 项目复制代码。
