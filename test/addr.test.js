import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStableIpv6 } from '../lib/addr.js';

// 真实 ipconfig 输出片段（2026-11-04 本机捕获）
const REAL_OUTPUT = `Wireless LAN adapter Wi-Fi:

   Connection-specific DNS Suffix  . :
   IPv6 Address. . . . . . . . . . . : 240e:b8f:423:7500:32e9:4c9f:d2bb:381c
   IPv6 Address. . . . . . . . . . . : 240e:b8f:423:7500:a281:aec5:ec68:717
   Temporary IPv6 Address. . . . . . : 240e:b8f:423:7500:1570:cf7a:2aa0:6264
   Link-local IPv6 Address . . . . . : fe80::6b73:3fc6:37c9:c356%19
   IPv4 Address. . . . . . . . . . . : 192.168.71.86`;

test('真实输出：选第一个稳定全球单播（跳过 Temporary 与 fe80）', () => {
  assert.equal(parseStableIpv6(REAL_OUTPUT), '240e:b8f:423:7500:32e9:4c9f:d2bb:381c');
});

test('中文系统文案（IPv6 地址）', () => {
  const zh = `以太网适配器 Wi-Fi:
   IPv6 地址 . . . . . . . . . . . : 2408:123:45:6::1
   临时 IPv6 地址. . . . . . . . . : 2408:123:45:6::2`;
  assert.equal(parseStableIpv6(zh), '2408:123:45:6::1');
});

test('只有 Temporary 时返回 null（不能发布轮换地址）', () => {
  const only = '   Temporary IPv6 Address. . . : 240e:1:2:3::9';
  assert.equal(parseStableIpv6(only), null);
});

test('无 IPv6 行返回 null', () => {
  assert.equal(parseStableIpv6('   IPv4 Address. . . : 1.2.3.4'), null);
  assert.equal(parseStableIpv6(''), null);
  assert.equal(parseStableIpv6(null), null);
});

test('链路本地（fe80）不通过前缀检查', () => {
  const ll = '   IPv6 Address. . . : fe80::1%12';
  assert.equal(parseStableIpv6(ll), null);
});
