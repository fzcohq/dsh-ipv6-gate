// ACME 证书管理：DNS-01（DuckDNS 等）签发、到期判断、落盘、热更新
import { X509Certificate } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const RENEW_BEFORE_DAYS = 30;
const DAY_MS = 86400000;

export function certDaysLeft(certPem, now = Date.now()) {
  try {
    const x = new X509Certificate(certPem);
    return (x.validToDate.getTime() - now) / DAY_MS;
  } catch {
    return -1;
  }
}

export function needsRenewal(certPem, { now = Date.now(), renewBeforeDays = RENEW_BEFORE_DAYS } = {}) {
  if (!certPem) return true;
  return certDaysLeft(certPem, now) < renewBeforeDays;
}

export function loadCert(dir) {
  try {
    return {
      cert: fs.readFileSync(path.join(dir, 'fullchain.pem'), 'utf8'),
      key: fs.readFileSync(path.join(dir, 'key.pem'), 'utf8'),
    };
  } catch {
    return null;
  }
}

export function saveCert(dir, cert, key) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries({ 'fullchain.pem': cert, 'key.pem': key })) {
    const target = path.join(dir, name);
    const tmp = `${target}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, content, { mode: 0o600 });
    fs.renameSync(tmp, target);
  }
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 签发/续期证书。attempts 次重试（DNS 传播可能慢），每次失败后等待更久。
 * @param {object} opts
 * @param {string} opts.domain
 * @param {{update:Function, clear:Function}} opts.provider  DNS 提供方
 * @param {string} opts.certDir
 * @param {string} [opts.email]
 * @param {number} [opts.propagationDelayMs=15000] 设置 TXT 后等待时间
 * @param {number} [opts.attempts=3]
 * @param {object} [opts.acme] 注入 acme-client 模块（测试用）
 * @param {Function} [opts.wait] 注入 sleep（测试用）
 */
export async function issueCertificate({
  domain,
  provider,
  certDir,
  email,
  log = () => {},
  propagationDelayMs = 15000,
  attempts = 3,
  acme = null,
  wait = defaultSleep,
} = {}) {
  const mod = acme ?? (await import('acme-client'));
  fs.mkdirSync(certDir, { recursive: true });

  const accountKeyPath = path.join(certDir, 'account.key');
  let accountKey = null;
  try {
    accountKey = fs.readFileSync(accountKeyPath, 'utf8');
  } catch {}
  if (!accountKey) {
    accountKey = await mod.forge.createPrivateKey();
    fs.writeFileSync(accountKeyPath, accountKey, { mode: 0o600 });
  }

  const [key, csr] = await mod.forge.createCsr({ commonName: domain });
  const client = new mod.Client({
    directoryUrl: mod.directory.letsencrypt.production,
    accountKey,
  });
  await client.createAccount({
    termsOfServiceAgreed: true,
    ...(email ? { contact: [`mailto:${email}`] } : {}),
  });

  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const cert = await client.auto({
        csr,
        email,
        termsOfServiceAgreed: true,
        challengePriority: ['dns-01'],
        challengeCreateFn: async (authz, challenge, keyAuthorization) => {
          await provider.update({ domain: authz.identifier.value, value: keyAuthorization });
          log(`TXT set for ${authz.identifier.value} (attempt ${attempt}), waiting ${propagationDelayMs}ms`);
          await wait(propagationDelayMs);
        },
        challengeRemoveFn: async (authz) => {
          try {
            await provider.clear({ domain: authz.identifier.value });
          } catch {}
        },
      });
      saveCert(certDir, cert, key);
      return { cert, key };
    } catch (e) {
      lastError = e;
      log(`attempt ${attempt} failed: ${e?.message || e}`);
      if (attempt < attempts) await wait(propagationDelayMs);
    }
  }
  throw lastError ?? new Error('acme: issuance failed');
}
