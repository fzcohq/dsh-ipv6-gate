import test from 'node:test';
import assert from 'node:assert/strict';
import { createDdnsService, fullDomain } from '../lib/ddns-service.js';

function fakeUpdaterFactory(record) {
  return (opts) => {
    record.push({ domain: opts.domain, stateFile: opts.stateFile });
    return {
      started: 0,
      stopped: 0,
      start() { this.started += 1; },
      stop() { this.stopped += 1; },
      tick: async () => null,
      readState: () => null,
    };
  };
}

test('fullDomain: 子域名补全，完整域名原样返回', () => {
  assert.equal(fullDomain('myhome'), 'myhome.duckdns.org');
  assert.equal(fullDomain('myhome.duckdns.org'), 'myhome.duckdns.org');
  assert.equal(fullDomain('  '), '');
  assert.equal(fullDomain(null), '');
});

test('start: 启动更新器并把子域名补全为完整域名', () => {
  const created = [];
  const tokens = [];
  const svc = createDdnsService({
    stateDir: 'C:/tmp/gate',
    updaterFactory: fakeUpdaterFactory(created),
    providerFactory: ({ token }) => { tokens.push(token); return { updateAAAA: async () => {} }; },
  });
  assert.equal(svc.start('myhome', 'tok-1'), true);
  assert.equal(svc.running, true);
  assert.equal(svc.domain, 'myhome.duckdns.org');
  assert.equal(created.length, 1);
  assert.equal(created[0].domain, 'myhome.duckdns.org');
  assert.deepEqual(tokens, ['tok-1']);
  svc.stop();
  assert.equal(svc.running, false);
});

test('start: 相同域名与 Token 幂等，不重复创建', () => {
  const created = [];
  const svc = createDdnsService({ stateDir: 'C:/tmp/gate', updaterFactory: fakeUpdaterFactory(created), providerFactory: () => ({}) });
  svc.start('myhome', 'tok-1');
  svc.start('myhome.duckdns.org', 'tok-1');
  assert.equal(created.length, 1);
  svc.stop();
});

test('start: Token 变化时重启更新器', () => {
  const created = [];
  const svc = createDdnsService({ stateDir: 'C:/tmp/gate', updaterFactory: fakeUpdaterFactory(created), providerFactory: () => ({}) });
  svc.start('myhome', 'tok-1');
  svc.start('myhome', 'tok-2');
  assert.equal(created.length, 2);
  assert.equal(svc.running, true);
  svc.stop();
});

test('start: 缺域名或 Token 返回 false 且不启动', () => {
  const created = [];
  const svc = createDdnsService({ stateDir: 'C:/tmp/gate', updaterFactory: fakeUpdaterFactory(created), providerFactory: () => ({}) });
  assert.equal(svc.start('', 'tok'), false);
  assert.equal(svc.start('myhome', ''), false);
  assert.equal(svc.start('myhome', undefined), false);
  assert.equal(created.length, 0);
  assert.equal(svc.running, false);
});

test('start: 更新器构造抛错时不崩溃，返回 false', () => {
  const svc = createDdnsService({
    stateDir: 'C:/tmp/gate',
    updaterFactory: () => { throw new Error('boom'); },
    providerFactory: () => ({}),
    log: () => {},
  });
  assert.equal(svc.start('myhome', 'tok-1'), false);
  assert.equal(svc.running, false);
});
