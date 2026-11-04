# dsh-v6-gate

**IPv6 直连网关插件**：DDNS + ACME HTTPS + 认证反代，把 DeepSeek Harness 零中继暴露给公网 IPv6。

## 为什么做这个

- 免费（全程 0 元：DuckDNS/dynv6 免费子域 + Let's Encrypt 免费证书）
- **零第三方经手数据**（对比 cloudflared：TLS 在 CF 边缘终止）
- 完整功能（Host 改写回环保住 DSH 特权 API）
- 国内现实可行（电信/移动/联通家宽+蜂窝普遍双栈，已实测手机蜂窝 → 家宽直连全链路打通）
- 市场空白：截至 2026-11-04 检索 8655 个插件，无成熟 IPv6 直连方案

## 架构

```
手机 ──HTTPS(LE证书)──> [::]:8443 插件内置 HTTPS 服务
                         ├─ PIN 认证（Cookie+失败锁定+进程绑定）
                         ├─ Host/Origin/Referer → 127.0.0.1:<DSH端口>
                         └─ 反代 + WS 透传 → DSH webserver（端口从宿主服务获取，自动跟随）
插件另含：DDNS 定时器（稳定地址筛选）｜ACME DNS-01 签发续期｜设置页+二维码
```

零外部二进制（无 Caddy/cloudflared）、零系统级配置（无计划任务/Run 键），装上插件即用，卸载即净。

## 路线图

| 阶段 | 内容 | 状态 |
|---|---|---|
| Phase 0 | 骨架（本目录） | ✅ |
| Phase 1 | 反代 + Host 改写 + PIN 认证 + WS 透传（自签证书本机验证） | ⬜ |
| Phase 2 | ACME DNS-01 真证书（acme-client + DuckDNS/dynv6） | ⬜ |
| Phase 3 | DDNS 定时器（ipconfig 稳定地址解析，已在外部栈验证） | ⬜ |
| Phase 4 | 设置页 + 二维码 + dsh-web-mobile(MIT) 移动样式 | ⬜ |
| Phase 5 | 可选：transport shim 干净重写 / TOTP | ⬜ |

## 许可证纪律（重要）

- 本项目 **MIT**。
- **禁止**从 dsh-pocket（GPL-2.0）复制代码——Host 改写 / PIN+Cookie / 限速均为通用技术，独立实现。
- 移动端样式从 **dsh-web-mobile（MIT）** 上游取得并保留署名（dsh-pocket 当年同源移植）。
- transport shim 如需实现，按行为描述干净重写；先实测 0.2.x 宿主是否真的需要。

## 验证参照

手搭生产栈（Caddy + acme.sh + DuckDNS + dsh-pocket）作为行为参照与回退方案，全记录见《../ipv6-direct-plan.md》。

## 开发

```sh
npm install        # 暂无依赖
# 本地试装：dsh plugin --profile desktop add <本目录绝对路径>
```
