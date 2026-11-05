// 网关管理器：统一管理 HTTP / HTTPS 双通道
// 每个通道有独立的端口、密码、开关；设置持久化到 settings.json
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createGate } from './server.js';
import { detectStableIpv6 } from './ddns.js';

const PW_RE = /^[A-Za-z0-9_-]{8,24}$/;

function generatePassword() {
  // 生成 12 位友好密码（小写字母+数字）
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  const bytes = crypto.randomBytes(12);
  for (let i = 0; i < 12; i++) pw += chars[bytes[i] % chars.length];
  return pw;
}

export function createGateManager({ stateDir, upstreamPort, getLaunchToken, log = () => {} }) {
  const settingsFile = path.join(stateDir, 'settings.json');

  // ---- 设置读写 ----
  let settings = loadSettings();

  function loadSettings() {
    const defaults = {
      http: { enabled: false, port: 8788, password: generatePassword() },
      https: { enabled: false, port: 8443, password: generatePassword() },
      domain: { name: '', token: '', status: '', error: '' },
    };
    try {
      const raw = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      return {
        http: { ...defaults.http, ...raw.http },
        https: { ...defaults.https, ...raw.https },
        domain: { ...defaults.domain, ...raw.domain },
      };
    } catch {
      return defaults;
    }
  }

  function saveSettings() {
    try {
      fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
      fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), { mode: 0o600 });
    } catch (e) {
      log(`settings save failed: ${e?.message || e}`);
    }
  }

  // ---- 网关实例 ----
  let httpGate = null;
  let httpsGate = null;
  let tlsCert = null; // { key, cert } 或 null

  function startHttp() {
    if (httpGate) return;
    try {
      httpGate = createGate({
        pin: settings.http.password,
        host: '::',
        port: settings.http.port,
        upstreamPort,
        tls: null,
        getLaunchToken,
        log: (m) => log(`[http] ${m}`),
      });
      httpGate.server.on('error', (e) => {
        log(`[http] server error: ${e?.code || e?.message || e}`);
        httpGate = null;
      });
      httpGate.server.listen(settings.http.port, '::', () => {
        log(`[http] listening [::]:${settings.http.port} (plaintext)`);
      });
    } catch (e) {
      log(`[http] start failed: ${e?.message || e}`);
      httpGate = null;
    }
  }

  function stopHttp() {
    if (!httpGate) return;
    try { httpGate.close(); } catch {}
    httpGate = null;
    log('[http] stopped');
  }

  function startHttps() {
    if (httpsGate) return;
    if (!tlsCert) { log('[https] no TLS certificate, cannot start'); return; }
    try {
      httpsGate = createGate({
        pin: settings.https.password,
        host: '::',
        port: settings.https.port,
        upstreamPort,
        tls: tlsCert,
        getLaunchToken,
        log: (m) => log(`[https] ${m}`),
      });
      httpsGate.server.on('error', (e) => {
        log(`[https] server error: ${e?.code || e?.message || e}`);
        httpsGate = null;
      });
      httpsGate.server.listen(settings.https.port, '::', () => {
        log(`[https] listening [::]:${settings.https.port} (TLS)`);
      });
    } catch (e) {
      log(`[https] start failed: ${e?.message || e}`);
      httpsGate = null;
    }
  }

  function stopHttps() {
    if (!httpsGate) return;
    try { httpsGate.close(); } catch {}
    httpsGate = null;
    log('[https] stopped');
  }

  // ---- 初始化：按设置启动 ----
  if (settings.http.enabled) startHttp();
  // HTTPS 需要证书，由 index.js 在证书就绪后调用 startHttps
  if (settings.https.enabled && tlsCert) startHttps();

  // ---- 公开 API ----
  return {
    getSettings() { return JSON.parse(JSON.stringify(settings)); },

    setTlsCert(cert) {
      tlsCert = cert;
      // 如果 HTTPS 已启用且未运行，启动它
      if (settings.https.enabled && !httpsGate && cert) {
        startHttps();
      }
    },

    toggleHttp(on) {
      settings.http.enabled = Boolean(on);
      saveSettings();
      if (on) startHttp(); else stopHttp();
      log(`[http] ${on ? 'enabled' : 'disabled'}`);
      return { ok: true, enabled: settings.http.enabled };
    },

    toggleHttps(on) {
      settings.https.enabled = Boolean(on);
      saveSettings();
      if (on) {
        if (!tlsCert) return { ok: false, error: 'TLS certificate not ready' };
        startHttps();
      } else {
        stopHttps();
      }
      log(`[https] ${on ? 'enabled' : 'disabled'}`);
      return { ok: true, enabled: settings.https.enabled };
    },

    setHttpPassword(pw) {
      if (!PW_RE.test(pw || '')) return { ok: false, error: '密码需 8-24 位字母数字-_ ' };
      settings.http.password = pw;
      saveSettings();
      // 热更新：如果网关在跑，直接换 auth 的 pin
      if (httpGate && httpGate.setPin) httpGate.setPin(pw);
      log('[http] password updated');
      return { ok: true };
    },

    setHttpsPassword(pw) {
      if (!PW_RE.test(pw || '')) return { ok: false, error: '密码需 8-24 位字母数字-_' };
      settings.https.password = pw;
      saveSettings();
      if (httpsGate && httpsGate.setPin) httpsGate.setPin(pw);
      log('[https] password updated');
      return { ok: true };
    },

    setDomain(name, token) {
      settings.domain = { name: name || '', token: token || '', status: 'configuring', error: '' };
      saveSettings();
      return { ok: true };
    },

    setDomainStatus(status, error = '') {
      settings.domain.status = status;
      settings.domain.error = error;
      saveSettings();
    },

    async getStatus() {
      const ipv6 = await detectStableIpv6().catch(() => null);
      const httpUrl = ipv6 ? `http://[${ipv6}]:${settings.http.port}` : '';
      const httpsUrl = (ipv6 && settings.domain.name) ? `https://${settings.domain.name}:${settings.https.port}` : '';
      return {
        ipv6: ipv6 || '',
        ipv6Error: ipv6 ? '' : '本机无可用 IPv6 全球地址',
        http: {
          enabled: settings.http.enabled,
          port: settings.http.port,
          password: settings.http.password,
          url: httpUrl,
          running: Boolean(httpGate),
        },
        https: {
          enabled: settings.https.enabled,
          port: settings.https.port,
          password: settings.https.password,
          url: httpsUrl,
          running: Boolean(httpsGate),
          hasCert: Boolean(tlsCert),
        },
        domain: { ...settings.domain },
      };
    },

    dispose() {
      stopHttp();
      stopHttps();
    },
  };
}
