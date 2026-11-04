import test from 'node:test';
import assert from 'node:assert/strict';
import { isImmutableAsset } from '../lib/cache.js';

test('带内容哈希的 assets 可 immutable 缓存', () => {
  assert.equal(isImmutableAsset('/assets/index-BXV-oxvX.js'), true);
  assert.equal(isImmutableAsset('/assets/style-Ab3dEf9.css'), true);
  assert.equal(isImmutableAsset('/assets/logo-1234567890.svg'), true);
});

test('插件 client.js 可 immutable 缓存（路径稳定，rev 在查询串）', () => {
  assert.equal(isImmutableAsset('/plugins/dshmarket/client.js'), true);
  assert.equal(isImmutableAsset('/plugins/@deepseek-ai/dsh-client-ui-chat/client.js?rev=abc'), true);
});

test('普通路径与短哈希不缓存', () => {
  assert.equal(isImmutableAsset('/'), false);
  assert.equal(isImmutableAsset('/api/session'), false);
  assert.equal(isImmutableAsset('/assets/index.js'), false); // 无哈希
  assert.equal(isImmutableAsset('/assets/index-abc.js'), false); // 哈希过短
  assert.equal(isImmutableAsset('/dsh-market/registry'), false);
});
