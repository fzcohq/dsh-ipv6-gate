import test from 'node:test';
import assert from 'node:assert/strict';
import { loginPageHtml, LOGIN_PATH } from '../lib/login-page.js';

test('PIN 输入框不得强制数字键盘（PIN 含字母，2026-11-04 真机踩坑）', () => {
  const html = loginPageHtml();
  assert.ok(!html.includes('inputmode="numeric"'), '不允许 inputmode=numeric');
  assert.ok(!html.includes('inputmode="tel"'), '不允许 inputmode=tel');
});

test('输入框是密码类型且关闭自动大写/纠错（PIN 全小写）', () => {
  const html = loginPageHtml();
  assert.match(html, /type="password"/);
  assert.match(html, /autocapitalize="off"/);
  assert.match(html, /autocorrect="off"/);
});

test('表单提交到 LOGIN_PATH，错误消息被转义', () => {
  const html = loginPageHtml('<script>alert(1)</script>');
  assert.ok(html.includes(`action="${LOGIN_PATH}"`));
  assert.ok(!html.includes('<script>alert(1)</script>'), '错误消息必须转义');
});
