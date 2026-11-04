import test from 'node:test';
import assert from 'node:assert/strict';
import { createDuckDnsProvider } from '../lib/providers/duckdns.js';

function fakeFetch(record, { ok = true, body = 'OK' } = {}) {
  return async (url) => {
    record.push(url);
    return { ok, status: ok ? 200 : 500, text: async () => body };
  };
}

test('update：TXT 写入参数正确（domains=子域, token, txt=值）', async () => {
  const calls = [];
  const p = createDuckDnsProvider({ token: 'tok123', fetchImpl: fakeFetch(calls) });
  await p.update({ domain: 'cheese-house.duckdns.org', value: 'abcDEF_-123' });
  assert.equal(calls.length, 1);
  const u = new URL(calls[0]);
  assert.equal(u.hostname, 'www.duckdns.org');
  assert.equal(u.pathname, '/update');
  assert.equal(u.searchParams.get('domains'), 'cheese-house');
  assert.equal(u.searchParams.get('token'), 'tok123');
  assert.equal(u.searchParams.get('txt'), 'abcDEF_-123');
});

test('clear：txt 为空 + clear=true', async () => {
  const calls = [];
  const p = createDuckDnsProvider({ token: 'tok123', fetchImpl: fakeFetch(calls) });
  await p.clear({ domain: 'cheese-house.duckdns.org' });
  const u = new URL(calls[0]);
  assert.equal(u.searchParams.get('txt'), '');
  assert.equal(u.searchParams.get('clear'), 'true');
});

test('非 duckdns 域名直接报错；API 返回 KO 抛错', async () => {
  const p = createDuckDnsProvider({ token: 'tok123', fetchImpl: fakeFetch([]) });
  await assert.rejects(() => p.update({ domain: 'example.com', value: 'x' }), /not a duckdns domain/);

  const bad = createDuckDnsProvider({ token: 't', fetchImpl: fakeFetch([], { body: 'KO' }) });
  await assert.rejects(() => bad.update({ domain: 'a.duckdns.org', value: 'x' }), /duckdns: HTTP 200 KO/);
});

test('缺 token 抛错', () => {
  assert.throws(() => createDuckDnsProvider({ token: '' }), /token is required/);
});
