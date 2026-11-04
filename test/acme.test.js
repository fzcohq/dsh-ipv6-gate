import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import selfsigned from 'selfsigned';
import { certDaysLeft, needsRenewal, loadCert, saveCert, issueCertificate } from '../lib/acme.js';

// selfsigned v5 是 async-only，且只支持 notAfterDate（没有 days 选项）
async function genCert(days) {
  return selfsigned.generate([{ name: 'commonName', value: 'test.local' }], {
    keyType: 'rsa',
    keySize: 2048,
    notAfterDate: new Date(Date.now() + days * 86400000),
  });
}

test('certDaysLeft / needsRenewal：短命证必续，长命证不续，垃圾输入视为需续', async () => {
  const short = await genCert(1);
  const long = await genCert(90);
  assert.ok(needsRenewal(short.cert));
  assert.equal(needsRenewal(long.cert), false);
  assert.ok(certDaysLeft(short.cert) <= 1);
  assert.equal(needsRenewal('garbage'), true);
  assert.equal(needsRenewal(''), true);
});

test('saveCert/loadCert 原子落盘并回读', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-cert-'));
  const pems = await genCert(90);
  saveCert(dir, pems.cert, pems.private);
  const got = loadCert(dir);
  assert.equal(got.cert, pems.cert);
  assert.equal(got.key, pems.private);
  assert.equal(loadCert(path.join(dir, 'nope')), null);
});

test('issueCertificate：DNS-01 流程（TXT 写入 → 清理 → 落盘）', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-acme-'));
  const updates = [];
  const provider = {
    name: 'fake',
    async update({ domain, value }) { updates.push({ domain, value }); },
    async clear() {},
  };
  const pems = await genCert(90);
  const fakeMod = {
    directory: { letsencrypt: { production: 'https://example.invalid/dir' } },
    forge: {
      async createPrivateKey() { return '-----BEGIN ACCOUNT KEY-----'; },
      async createCsr() { return ['-----BEGIN KEY-----', '-----BEGIN CSR-----']; },
    },
    Client: class {
      async createAccount() { return {}; }
      async auto(opts) {
        const authz = { identifier: { value: 'test.local' } };
        await opts.challengeCreateFn(authz, {}, 'txt-value-123');
        await opts.challengeRemoveFn(authz, {}, 'txt-value-123');
        return pems.cert;
      }
    },
  };
  const res = await issueCertificate({
    domain: 'test.local', provider, certDir: dir, acme: fakeMod,
    wait: async () => {}, attempts: 1,
  });
  assert.equal(res.cert, pems.cert);
  assert.equal(res.key, '-----BEGIN KEY-----');
  assert.deepEqual(updates, [{ domain: 'test.local', value: 'txt-value-123' }]);
  assert.ok(fs.existsSync(path.join(dir, 'fullchain.pem')));
  assert.ok(fs.existsSync(path.join(dir, 'key.pem')));
  assert.ok(fs.existsSync(path.join(dir, 'account.key')));
});

test('issueCertificate：失败会重试并在用尽后抛出', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-acme-fail-'));
  const provider = { name: 'fake', async update() {}, async clear() {} };
  let calls = 0;
  const fakeMod = {
    directory: { letsencrypt: { production: 'https://example.invalid/dir' } },
    forge: {
      async createPrivateKey() { return 'KEY'; },
      async createCsr() { return ['KEY', 'CSR']; },
    },
    Client: class {
      async createAccount() {}
      async auto() { calls += 1; throw new Error('dns timeout'); }
    },
  };
  await assert.rejects(
    () => issueCertificate({ domain: 'x.local', provider, certDir: dir, acme: fakeMod, wait: async () => {}, attempts: 2 }),
    /dns timeout/,
  );
  assert.equal(calls, 2);
});
