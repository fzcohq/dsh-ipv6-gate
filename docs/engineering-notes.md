# 工程笔记：验证记录与崩溃复盘（2026-11-04）

本文记录 `dsh-ipv6-gate` 在真实 DSH Desktop 0.2.1-rc.5 上从「装不上」到「手机可访问」过程中
验证出的机制与踩过的坑。每条都对应一次真实崩溃或 401，修复均已进入代码与测试。

## 1. 已验证的架构（真机）

```
手机(蜂窝 v6) ──HTTP/WS──> [::]:8445 dsh-ipv6-gate
                             ├─ PIN 登录页（cookie=sha256(pin:sessionKey)）
                             ├─ Host/Origin/Referer → 127.0.0.1:<DSH端口>
                             ├─ WS upgrade 透传（含 method/path！）
                             └─ 反代 → DSH webserver（端口从 ctx.webServer 自动获取）
```

- **DSH 端口每次启动随机变**：resolveUpstream 读取宿主服务，网关自动跟随（已实测跟随 55338→54498→62607→64598 等）。
- **DSH 浏览器认证**（0.2.x 新增）：`dsh web` 打印的 URL 带 `?token=`（进程内存随机，不落盘）；
  GET `/?token=` 校验通过后铸 Cookie（`dsh-auth-<sha256(Host authority)>`，HttpOnly，30 天，绑定 Host）。
  本插件经 **官方 `connection` 服务** 的 `authenticatedUrl()` 取令牌，PIN 通过后重定向 `/?token=…` 让 DSH 替手机铸 Cookie；DSH 重启换令牌时检测 401 透明续登（带防循环护栏）。
- **验证方法**：手机蜂窝直连 → 输 PIN → 连续两次 303 → 200 完整界面；WS `/api/remote.mux` 101 建立。

## 2. 崩溃复盘（三个，都被真实日志证实）

### #1 客户端 bundle 是 ESM → `SyntaxError: Unexpected token 'export'`
- 日志：`...logs/crash-...-web-boot.log`：「web boot: 1 entry did not activate / dsh-ipv6-gate: import failed」
- 原因：`lib/client.js` 写成 `export default {}`，而宿主客户端模块加载器要求
  `window.__ModuleLoader__.load({ id, factory })` 的**普通脚本**（对照 dshmarket 的真实格式）。
- 修复：v0.1.1 起彻底**去客户端化**（服务端-only）——移除 `dsh.client` 字段与 `lib/client.js`。
- 教训：桌面端崩溃发生在**渲染进程激活 client 条目**，CLI/假 ctx 测试永远测不到；需看 `%APPDATA%\@deepseek-ai\dsh-desktop\logs\crash-*-web-boot.log`。

### #2 client factory 返回空对象 → `invalid plugin, expect function or object with an "apply" method`
- 原因：语法修好后 factory 返回 `{}`，客户端插件加载器要求返回**带 apply 的插件对象**；
  渲染端 `bootFailed` → 主进程 `reportFatal("web-boot")` → 整机退出。
- 修复：同 #1（服务端-only）；若未来加设置页，factory 必须返回 `{ apply() {} }`。

### #3 未 inject 的服务访问 → 令牌永远取不到 → 手机见 `dsh web authentication required`
- 原因：`getLaunchToken()` 中 `ctx.connection` 未声明在 `inject`，Cordis 直接抛
  `cannot get property "connection" without inject`，被 catch 吞掉 → `token=null` → 重定向 `/` → DSH 401。
- 修复：`inject: ['webServer', 'connection']`（服务依赖必须显式声明，软取不成立）。

### #4（真机反馈）WS 一直重连 → 升级请求漏了路径
- 原因：`onUpgrade` 里 `http.request({host, port, headers})` 默认 **GET `/`**，所有 WS 升级打到根路径 → 400 → 前端无限重连。
- 修复：传入 `method` 与 `path: req.url`；新增两条 WS 回归测试 + `tools/wsprobe.mjs` 探针。
- 验证：对真实 DSH，直连与经网关均 **101 + Sec-WebSocket-Accept**；无 Cookie 401。

## 3. 验证工具链（可复用）

| 工具 | 用途 |
|---|---|
| `npm test`（node:test，25 项） | auth/rewrite/addr/login-page/server（含 WS 回归） |
| `node tools/preflight.mjs <上游端口> <本地端口>` | 假 ctx 真跑 apply；断言登录页 200 + 服务端-only |
| `node tools/wsprobe.mjs <端口> "<cookie>" [path]` | 完整 WS 握手探针（101/401/400） |
| `node smoke.mjs --tls --port 8445 --host ::` | 指向真实 DSH 的独立冒烟网关 |
| crashlab（`~\.dsh-crashlab` + `dsh --profile crashlab`） | 隔离 DSH_HOME 复现真实宿主组合；**desktop profile 被 Electron 独占，CLI 无法直接 boot** |

## 4. 待办提醒

- P2：`acme-client` + DNS-01（DuckDNS/dynv6），证书放 `$DSH_HOME/dsh-ipv6-gate/certs`，续期内建定时器；
  届时网关可直接 HTTPS，替代手搭的 Caddy/acme.sh。
- P3：DDNS 定时器复用 `lib/addr.js`（已含真实 ipconfig fixture 测试）。
- P4：设置页 client bundle（factory 返回 `{ apply() {} }`），二维码、PIN 轮换；移动样式从 dsh-web-mobile(MIT) 引入。
- 当前 8445 是 **HTTP dev 模式**；生产 8443 仍是手搭 Caddy 栈，两者并存。

## 5. P2 验收记录（2026-11-04，ALL PASS）

`node tools/verify-p2.mjs` 对 `https://cheese-house.duckdns.org:8445` 逐项检查：

| 项 | 结果 | 说明 |
|---|---|---|
| ALPN | h2 | 74 个 client bundle 走单连接多路复用 |
| 证书 | 与磁盘一致，CN=cheese-house | `$DSH_HOME\dsh-ipv6-gate\certs` |
| 剩余天数 | 90 | <30 天自动续期 + setSecureContext 热更新 |
| 登录链路 | 200→303(token)→303(dsh-auth)→200 首页 | 与 P1.5 相同 |
| 缓存头 | `public, max-age=31536000, immutable` | 带哈希 assets 与 /plugins/*/client.js |
| 压缩 | gzip | 上游压缩透传 |
| h2 请求 | 200 | http2 客户端 |
| WS 升级 | 101 | 走 h1 分支 |

ACME 真实签发耗时 51s（DNS-01 + DuckDNS），证书有效期 90 天。

**验收脚本自身踩的坑**（已修复，留档）：资源路径 `./assets/…` 需归一化为 `/assets/…`；WS 探针必须带 `Sec-WebSocket-Key`/`Sec-WebSocket-Version`，否则真实 WS 服务器回 400。

## 6. P2.5 手感对比与移动层（2026-11-04）

**测量**（同一 3MB JSON `/dsh-market/registry`，两端均为 gzip 3,043,579 字节）：

| 入口 | 耗时（本机回环） |
|---|---|
| 8443（Caddy + dsh-pocket） | 5.13s |
| 8445（dsh-ipv6-gate 单进程） | **2.20s** |

结论：网络层插件栈更快（少一跳、无 Caddy 二次转发）；压缩方式相同（均 gzip，未使用 brotli）。

**差异根因**：8443 的"跟手"来自 pocket 注入的 dsh-web-mobile 移动端适配层（窄屏布局/触控/输入框防缩放），而 8445 当时是桌面布局。

**处置**：`dsh plugin --profile desktop add dsh-web-mobile`（MIT，⭐178，independently maintained），作为普通 profile 插件对**所有入口**生效（8443 与 8445 同用）。安装后用户实测：两者顺滑度基本无差异。

**结论**：插件栈在性能与体验上与手搭栈持平或更优；剩余差异仅为 pocket 的 transport shim（可选，未复刻）。

## 7. P3 验收记录（2026-11-04）

- `lib/ddns.js`：探测稳定 IPv6（win32 用 ipconfig + 已测试的 parseStableIpv6；Linux 走 `ip -6 addr` 兜底）→ 与 `ddns-state.json` 比对 → 有变化才调 DuckDNS AAAA 接口；失败只记日志与状态，绝不抛。
- `node tools/ddns-update.mjs <domain> <token> --force` 实测：`240e:b8f:423:7500:32e9:4c9f:d2bb:381c` 探测正确、AAAA 更新成功、DNS 解析即刻一致。
- 插件内默认随 TLS 配置启用（复用同一 DuckDNS token），每小时检查一次；`ctx.on('dispose')` 清理定时器。
- 43/43 单测通过（新增 5 项 DDNS：首次更新/无变化跳过/force/探测失败/API 失败不抛出）。
