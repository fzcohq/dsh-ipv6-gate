import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createAuth, randomPin } from '../lib/auth.js';

test('cookie 值 = sha256(pin:sessionKey)', () => {
  const a = createAuth({ pin: 'abcd2345', sessionKey: 'k'.repeat(32) });
  const expect = createHash('sha256').update(`abcd2345:${'k'.repeat(32)}`).digest('hex');
  assert.equal(a.cookieValue(), expect);
});

test('isAuthenticated：正确 cookie 通过，错误/缺失拒绝', () => {
  const a = createAuth({ pin: 'abcd2345' });
  const good = { headers: { cookie: `gate_token=${a.cookieValue()}` } };
  const bad = { headers: { cookie: 'gate_token=deadbeef' } };
  const none = { headers: {} };
  assert.equal(a.isAuthenticated(good), true);
  assert.equal(a.isAuthenticated(bad), false);
  assert.equal(a.isAuthenticated(none), false);
});

test('checkPin：常量时间比较，空串拒绝', () => {
  const a = createAuth({ pin: 'abcd2345' });
  assert.equal(a.checkPin('abcd2345'), true);
  assert.equal(a.checkPin('abcd2346'), false);
  assert.equal(a.checkPin(''), false);
  assert.equal(a.checkPin(null), false);
});

test('失败锁定：连续错 maxFails 次锁 lockMs，过期自动解除，成功重置计数', () => {
  let t = 1000;
  const a = createAuth({ pin: 'abcd2345', maxFails: 3, lockMs: 60_000, now: () => t });
  assert.equal(a.isLocked('::1'), false);
  a.registerFailure('::1');
  a.registerFailure('::1');
  assert.equal(a.isLocked('::1'), false); // 还没到 3 次
  a.registerFailure('::1'); // 第 3 次 → 锁定
  assert.equal(a.isLocked('::1'), true);
  t += 61_000;
  assert.equal(a.isLocked('::1'), false); // 锁过期清除
  // 成功会重置：2 次失败 + 1 次成功 + 2 次失败 → 不锁
  a.registerFailure('x');
  a.registerFailure('x');
  a.registerSuccess('x');
  a.registerFailure('x');
  a.registerFailure('x');
  assert.equal(a.isLocked('x'), false);
});

test('进程重启（换 sessionKey）后旧 cookie 失效', () => {
  const a1 = createAuth({ pin: 'abcd2345', sessionKey: 'a'.repeat(32) });
  const a2 = createAuth({ pin: 'abcd2345', sessionKey: 'b'.repeat(32) });
  const oldCookie = { headers: { cookie: `gate_token=${a1.cookieValue()}` } };
  assert.equal(a2.isAuthenticated(oldCookie), false);
});

test('cookieHeader 含安全属性', () => {
  const a = createAuth({ pin: 'abcd2345' });
  const h = a.cookieHeader({ secure: true });
  assert.match(h, /gate_token=/);
  assert.match(h, /HttpOnly/);
  assert.match(h, /SameSite=Lax/);
  assert.match(h, /Secure/);
  assert.match(h, /Max-Age=/);
});

test('randomPin：长度与字母表', () => {
  const pin = randomPin(10);
  assert.equal(pin.length, 10);
  assert.match(pin, /^[a-z2-9]+$/);
});
