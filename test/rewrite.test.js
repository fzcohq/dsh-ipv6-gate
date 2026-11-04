import test from 'node:test';
import assert from 'node:assert/strict';
import { rewriteHeaders } from '../lib/rewrite.js';

test('Host/Origin/Referer 改写为上游 authority，其余头保留，hop-by-hop 移除', () => {
  const out = rewriteHeaders(
    {
      host: 'cheese-house.duckdns.org:8443',
      origin: 'https://cheese-house.duckdns.org:8443',
      referer: 'https://cheese-house.duckdns.org:8443/some/page',
      'x-custom': 'keep-me',
      accept: '*/*',
      connection: 'keep-alive',
    },
    '127.0.0.1:55338',
  );
  assert.equal(out.host, '127.0.0.1:55338');
  assert.equal(out.origin, 'http://127.0.0.1:55338');
  assert.equal(out.referer, 'http://127.0.0.1:55338/');
  assert.equal(out['x-custom'], 'keep-me');
  assert.equal(out.accept, '*/*');
  assert.equal(out.connection, undefined);
});

test('无 Origin/Referer 时不凭空新增', () => {
  const out = rewriteHeaders({ host: 'a.example' }, '127.0.0.1:1');
  assert.equal(out.origin, undefined);
  assert.equal(out.referer, undefined);
  assert.equal(out.host, '127.0.0.1:1');
});

test('scheme 可切换（WS 上游按 http）', () => {
  const out = rewriteHeaders({ host: 'x', origin: 'https://x' }, '127.0.0.1:9', { scheme: 'http' });
  assert.equal(out.origin, 'http://127.0.0.1:9');
});
