// 认证模块：PIN → HttpOnly Cookie（sha256(PIN:sessionKey)，绑定进程）+ 按 IP 失败锁定
// 独立实现（行为参考通用方案，未复制任何 GPL 代码）
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const DEFAULT_COOKIE = 'gate_token';
const PIN_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // 去掉易混淆字符

export function randomPin(len = 8) {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += PIN_ALPHABET[bytes[i] % PIN_ALPHABET.length];
  return out;
}

export function randomSessionKey() {
  return randomBytes(16).toString('hex');
}

function sha256hex(s) {
  return createHash('sha256').update(s).digest('hex');
}

/** 定长常量时间比较（hex 字符串）；长度不等/为空直接 false */
function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a ?? ''), 'utf8');
  const bb = Buffer.from(String(b ?? ''), 'utf8');
  if (ba.length === 0 || ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function createAuth(options = {}) {
  let {
    pin,
    sessionKey = randomSessionKey(),
    cookieName = DEFAULT_COOKIE,
    cookieMaxAgeSec = 30 * 24 * 3600,
    maxFails = 5,
    lockMs = 60_000,
    now = () => Date.now(),
  } = options;
  if (!pin) throw new Error('createAuth: pin is required');

  const failures = new Map(); // ip -> { count, lockedUntil }

  function cookieValue() {
    return sha256hex(`${pin}:${sessionKey}`);
  }

  function parseCookies(header) {
    const out = {};
    for (const part of String(header || '').split(';')) {
      const i = part.indexOf('=');
      if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    }
    return out;
  }

  function isAuthenticated(req) {
    const cookies = parseCookies(req.headers?.cookie);
    return safeEqualHex(cookies[cookieName], cookieValue());
  }

  function isLocked(ip) {
    const rec = failures.get(ip);
    if (!rec) return false;
    if (rec.lockedUntil > now()) return true;
    if (rec.lockedUntil && rec.lockedUntil <= now()) failures.delete(ip);
    return false;
  }

  function registerFailure(ip) {
    const rec = failures.get(ip) || { count: 0, lockedUntil: 0 };
    rec.count += 1;
    if (rec.count >= maxFails) {
      rec.lockedUntil = now() + lockMs;
      rec.count = 0;
    }
    failures.set(ip, rec);
  }

  function registerSuccess(ip) {
    failures.delete(ip);
  }

  function checkPin(candidate) {
    return safeEqualHex(candidate, pin);
  }

  function cookieHeader({ secure = false } = {}) {
    const parts = [
      `${cookieName}=${cookieValue()}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${cookieMaxAgeSec}`,
    ];
    if (secure) parts.push('Secure');
    return parts.join('; ');
  }

  return {
    cookieName,
    sessionKey,
    cookieValue,
    isAuthenticated,
    isLocked,
    registerFailure,
    registerSuccess,
    checkPin,
    cookieHeader,
    /** 热更新 PIN：换新 sessionKey（旧 Cookie 全部失效），下一次请求即生效 */
    updatePin(newPin) {
      if (!newPin || typeof newPin !== 'string') return;
      pin = newPin;
      sessionKey = randomSessionKey();
    },
  };
}
