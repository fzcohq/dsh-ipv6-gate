import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDdnsUpdater } from '../lib/ddns.js';

function tmpState() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-ddns-'));
  return path.join(dir, 'ddns-state.json');
}

test('首次运行：探测地址 → 更新 AAAA → 落盘状态', async () => {
  const updates = [];
  const provider = { async updateAAAA(a) { updates.push(a); } };
  const state = tmpState();
  const u = createDdnsUpdater({ provider, domain: 'x.duckdns.org', stateFile: state, detect: async () => '240e:1:2:3::4' });
  const addr = await u.tick();
  assert.equal(addr, '240e:1:2:3::4');
  assert.deepEqual(updates, [{ domain: 'x.duckdns.org', address: '240e:1:2:3::4' }]);
  const saved = JSON.parse(fs.readFileSync(state, 'utf8'));
  assert.equal(saved.address, '240e:1:2:3::4');
  assert.equal(saved.error, null);
});

test('地址未变化：跳过 API 调用；变化时再次更新', async () => {
  const updates = [];
  const provider = { async updateAAAA(a) { updates.push(a.address); } };
  const state = tmpState();
  let current = '240e:1:2:3::4';
  const u = createDdnsUpdater({ provider, domain: 'x.duckdns.org', stateFile: state, detect: async () => current });
  await u.tick();
  await u.tick(); // 无变化
  assert.deepEqual(updates, ['240e:1:2:3::4']);
  current = '240e:1:2:3::5';
  await u.tick();
  assert.deepEqual(updates, ['240e:1:2:3::4', '240e:1:2:3::5']);
});

test('force 强制更新（忽略无变化）', async () => {
  const updates = [];
  const provider = { async updateAAAA(a) { updates.push(a.address); } };
  const state = tmpState();
  const u = createDdnsUpdater({ provider, domain: 'x.duckdns.org', stateFile: state, detect: async () => '240e::1' });
  await u.tick();
  await u.tick(true);
  assert.equal(updates.length, 2);
});

test('探测不到地址：记录错误，不调用 API', async () => {
  const updates = [];
  const provider = { async updateAAAA(a) { updates.push(a); } };
  const state = tmpState();
  const u = createDdnsUpdater({ provider, domain: 'x.duckdns.org', stateFile: state, detect: async () => null });
  assert.equal(await u.tick(), null);
  assert.deepEqual(updates, []);
  const saved = JSON.parse(fs.readFileSync(state, 'utf8'));
  assert.match(saved.error, /no stable global IPv6/);
});

test('API 失败：记录错误但不抛出（启动安全）', async () => {
  const provider = { async updateAAAA() { throw new Error('duckdns: HTTP 500 KO'); } };
  const state = tmpState();
  const u = createDdnsUpdater({ provider, domain: 'x.duckdns.org', stateFile: state, detect: async () => '240e::2' });
  const r = await u.tick();
  assert.equal(r, null);
  const saved = JSON.parse(fs.readFileSync(state, 'utf8'));
  assert.match(saved.error, /HTTP 500/);
});
