# dsh-ipv6-gate

**手机 IPv6 远程访问 DeepSeek Harness**——零中继、零费用、零系统配置。

把 DSH 通过家庭宽带的 IPv6 直接暴露到公网：手机蜂窝网络直连家中电脑，数据不经任何第三方。

## 它做什么

```
手机（蜂窝/WiFi） ──HTTPS──> 你的域名.duckdns.org:8787 ──> 家中电脑 DSH
                          ↑ Let's Encrypt 免费证书
                          ↑ DuckDNS 免费域名（自动 DDNS）
                          ↑ PIN 认证 + 密码保护
```

| 功能 | 说明 |
|---|---|
| **HTTPS 远程访问** | Let's Encrypt 证书自动签发/续期（DNS-01 via DuckDNS） |
| **DDNS** | 检测本机 IPv6 变化 → 自动更新 DNS AAAA 记录（每小时） |
| **设置页 UI** | DSH 设置里出现「手机 IPv6 远程访问」页签 |
| **二维码扫码** | 扫码直达（密码编入 URL，自动认证，不留浏览器历史） |
| **双通道** | HTTPS（加密）+ HTTP（明文，默认关），独立密码/开关 |
| **安全** | PIN 认证 + Cookie + 失败锁定 + IP 限速 |

## 安装

在终端执行：

```sh
dsh plugin add github:fzcohq/dsh-ipv6-gate
```

> **桌面版用户**：如果上面命令安装后设置页没出现插件，改用：
> ```sh
> dsh plugin --profile desktop add github:fzcohq/dsh-ipv6-gate
> ```
> 然后重启桌面端。

安装后重启 DSH，设置里会出现 **「手机 IPv6 远程访问」** 页签。

## 配置（三步）

### 1. 注册 DuckDNS（免费）

1. 打开 [duckdns.org](https://www.duckdns.org)，用 GitHub 账号登录
2. 输入一个子域名（如 `myhome`）→ Add Domain
3. 复制页面右上角的 Token（36 位 UUID）

### 2. 在设置页配置

1. DSH → 设置 → **手机 IPv6 远程访问**
2. 确认 IPv6 地址显示绿色（检测通过）
3. 域名区域 → **配置** → 填入子域名 + Token → 保存
4. 等待「正在配置域名…」完成（自动 DDNS + 证书签发，约 30 秒）

### 3. 开启 HTTPS

1. HTTPS 连接 → 打开开关
2. 展开面板 → 手机扫描二维码 → 直达 DSH

## 使用

| 操作 | 方式 |
|---|---|
| 手机访问 | 扫设置页二维码，或直接打开 `https://<子域名>.duckdns.org:8787` |
| 改密码 | 设置页 → 展开 HTTP/HTTPS → 「自定义」密码（即时生效） |
| 关闭远程访问 | 设置页关闭对应开关（端口停止监听，外部不可达） |
| 临时测试 | 开启 HTTP 连接（明文，仅建议局域网调试） |

## 技术架构

```
┌─────────────────────────────────────────────┐
│  DSH 设置页「手机 IPv6 远程访问」              │
│  ├─ IPv6 地址检测（排除 Temporary 地址）       │
│  ├─ HTTP 连接（端口 8788，默认关）            │
│  ├─ DuckDNS 域名管理（子域名 + Token）        │
│  └─ HTTPS 连接（端口 8787，TLS 证书自动管理）  │
├─────────────────────────────────────────────┤
│  gate-manager（双通道生命周期 + 持久化）       │
├─────────────────────────────────────────────┤
│  反代层：Host 改写 + PIN 认证 + WS 透传       │
│  + ?key= 扫码自动认证 + HTTP/2 ALPN 分流     │
├─────────────────────────────────────────────┤
│  ACME DNS-01（DuckDNS API）+ 证书续期        │
│  DDNS 定时器（稳定地址 → AAAA 记录，每小时）   │
└─────────────────────────────────────────────┘
```

零外部二进制（无 Caddy/cloudflared）、零系统级配置（无计划任务/Run 键），卸载即净。

## 前提条件

| 条件 | 说明 |
|---|---|
| 电脑有公网 IPv6 | 国内电信/移动/联通家宽普遍已分配；Windows / Linux / macOS 均可自动探测 |
| 手机有 IPv6 | 4G/5G 蜂窝网络默认支持；WiFi 需路由器开启 IPv6 |
| 路由器防火墙 | 需放行入站 TCP 8787（HTTPS）/ 8788（HTTP） |
| DuckDNS 账户 | 免费子域名 + Token（DNS-01 证书验证与 DDNS 共用） |

> **自动更新 AAAA**：无论域名是在设置页填写，还是在 `cordis.patch.yml` 里通过 `ddns` / `tls` 配置，插件都会启动 DDNS 定时器（每小时检查，地址变化才调用 API）。

## 开发

```sh
npm install
npm test                          # 52 tests
node tools/preflight.mjs <port>   # 部署预检
```

## 许可证

MIT
