import test from 'node:test';
import assert from 'node:assert/strict';

// ?key= 自动认证在 server.test.js 的集成层测；这里测 auth.checkPin 的行为
import { createAuth } from '../lib/auth.js';

test('createAuth: checkPin 正确匹配', () => {
  const auth = createAuth({ pin: 'mysecret123' });
  assert.equal(auth.checkPin('mysecret123'), true);
  assert.equal(auth.checkPin('wrong'), false);
  assert.equal(auth.checkPin(''), false);
});

test('createAuth: isAuthenticated 需要正确 cookie', () => {
  const auth = createAuth({ pin: 'test1234' });
  const fakeReqNoCookie = { headers: {} };
  assert.equal(auth.isAuthenticated(fakeReqNoCookie), false);
});

test('QR payload 格式：url + ?key= 密码', () => {
  const ipv6 = '240e:b8f:423:7500::1';
  const port = 8445;
  const pin = 'abc12345';
  const payload = `http://[${ipv6}]:${port}/?key=${pin}`;
  assert.match(payload, /^http:\/\/\[240e:.*\]:8445\/\?key=abc12345$/);
});
