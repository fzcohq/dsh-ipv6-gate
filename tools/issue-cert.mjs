// CLI：用插件的 ACME 模块真实签发/续期证书（生产 Let's Encrypt + DNS-01）
// 用法：node tools/issue-cert.mjs <domain> <duckdns-token> [email] [--staging]
import path from 'node:path';
import os from 'node:os';
import { issueCertificate } from '../lib/acme.js';
import { createDuckDnsProvider } from '../lib/providers/duckdns.js';

const args = process.argv.slice(2).filter((a) => a !== '--staging');
const [domain, token, email] = args;
const staging = process.argv.includes('--staging');

if (!domain || !token) {
  console.error('用法: node tools/issue-cert.mjs <domain> <duckdns-token> [email] [--staging]');
  process.exit(2);
}

const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const certDir = path.join(home, 'dsh-ipv6-gate', 'certs');

console.log(`[issue] domain=${domain} certDir=${certDir}${staging ? ' (staging)' : ''}`);

let acme = null;
if (staging) {
  const mod = await import('acme-client');
  acme = {
    ...mod,
    directory: { ...mod.directory, letsencrypt: mod.directory.letsencrypt },
    Client: class extends mod.Client {
      constructor(opts) {
        super({ ...opts, directoryUrl: mod.directory.letsencrypt.staging });
      }
    },
  };
}

const started = Date.now();
try {
  const res = await issueCertificate({
    domain,
    provider: createDuckDnsProvider({ token }),
    certDir,
    email,
    acme,
    propagationDelayMs: 15000,
    attempts: 3,
    log: (m) => console.log(`[issue] ${m}`),
  });
  const { X509Certificate } = await import('node:crypto');
  const x = new X509Certificate(res.cert);
  console.log(`[done] ${((Date.now() - started) / 1000).toFixed(0)}s`);
  console.log(`[done] subject=${x.subject} validTo=${x.validToDate.toISOString()}`);
  console.log(`[done] cert saved to ${path.join(certDir, 'fullchain.pem')}`);
} catch (e) {
  console.error(`[fail] ${e?.message || e}`);
  process.exit(1);
}
