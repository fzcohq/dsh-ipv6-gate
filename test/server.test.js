// 集成测试：起假上游 + 起网关，走完整认证/反代流程（node 内建 fetch）
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createGate } from '../lib/server.js';

function startUpstream() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      host: req.headers.host,
      origin: req.headers.origin || null,
      path: req.url,
    }));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, port: server.address().port }),
    );
  });
}

async function startGate(upstreamPort, opts = {}) {
  const { server, auth } = createGate({ pin: 'test1234', port: 0, upstreamPort, ...opts });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, auth, base: `http://127.0.0.1:${server.address().port}` };
}

const FORM = { 'content-type': 'application/x-www-form-urlencoded' };

test('完整流程：登录页 → 错 PIN 403 → 对 PIN 303+Cookie → 带 Cookie 反代且 Host 已改写', async () => {
  const up = await startUpstream();
  const gate = await startGate(up.port);
  try {
    // 1) 未认证 → 登录页
    let res = await fetch(`${gate.base}/`);
    let body = await res.text();
    assert.equal(res.status, 200);
    assert.match(body, /dsh-ipv6-gate/);

    // 2) 错误 PIN → 403 且返回登录页
    res = await fetch(`${gate.base}/__gate/login`, {
      method: 'POST', body: 'pin=wrong1', headers: FORM, redirect: 'manual',
    });
    assert.equal(res.status, 403);

    // 3) 正确 PIN → 303 + Set-Cookie
    res = await fetch(`${gate.base}/__gate/login`, {
      method: 'POST', body: 'pin=test1234', headers: FORM, redirect: 'manual',
    });
    assert.equal(res.status, 303);
    const setCookie = res.headers.getSetCookie()[0];
    assert.match(setCookie, /gate_token=/);
    assert.match(setCookie, /HttpOnly/);
    const cookie = setCookie.split(';')[0];

    // 4) 带 Cookie + 跨域 Origin → 反代，Host/Origin 改写为回环，路径与查询串保留
    res = await fetch(`${gate.base}/api/echo?a=1`, {
      headers: { cookie, origin: 'https://cheese-house.duckdns.org:8443' },
    });
    const data = await res.json();
    assert.equal(data.host, `127.0.0.1:${up.port}`);
    assert.equal(data.origin, `http://127.0.0.1:${up.port}`);
    assert.equal(data.path, '/api/echo?a=1');

    // 5) 连续错误触发锁定 → 429
    for (let i = 0; i < 5; i++) {
      await fetch(`${gate.base}/__gate/login`, {
        method: 'POST', body: 'pin=bad', headers: FORM, redirect: 'manual',
      });
    }
    res = await fetch(`${gate.base}/__gate/login`, {
      method: 'POST', body: 'pin=bad', headers: FORM, redirect: 'manual',
    });
    assert.equal(res.status, 429);
  } finally {
    gate.server.close();
    up.server.close();
  }
});

test('锁定期间非登录路径也返回 429', async () => {
  const up = await startUpstream();
  const gate = await startGate(up.port, { maxFails: 2, lockMs: 60_000 });
  try {
    for (let i = 0; i < 2; i++) {
      await fetch(`${gate.base}/__gate/login`, {
        method: 'POST', body: 'pin=nope', headers: FORM, redirect: 'manual',
      });
    }
    const res = await fetch(`${gate.base}/`);
    assert.equal(res.status, 429);
  } finally {
    gate.server.close();
    up.server.close();
  }
});

test('DSH 启动令牌对接：PIN 成功后重定向 /?token=…，由上游铸 Cookie', async () => {
  const up = await startUpstream();
  const gate = await startGate(up.port, { getLaunchToken: () => 'LAUNCH123' });
  try {
    const res = await fetch(`${gate.base}/__gate/login`, {
      method: 'POST', body: 'pin=test1234', headers: FORM, redirect: 'manual',
    });
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), '/?token=LAUNCH123');
    // gate Cookie 也同时下发
    assert.match(res.headers.getSetCookie()[0], /gate_token=/);
  } finally {
    gate.server.close();
    up.server.close();
  }
});

test('透明续登：上游 401 且为文档导航时 303 到 token URL（且不循环）', async () => {
  // 模拟 DSH 浏览器认证：无凭据 GET / → 401；带 ?token=LAUNCH123 → 303 './' + set-cookie
  const dsh = http.createServer((req, res) => {
    if (req.url.startsWith('/?token=LAUNCH123')) {
      res.writeHead(303, { location: './', 'set-cookie': 'dsh-auth-x=signed; Path=/; HttpOnly' });
      return res.end();
    }
    res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('dsh web authentication required; reopen the URL printed by dsh web.\n');
  });
  await new Promise((r) => dsh.listen(0, '127.0.0.1', r));
  const gate = await startGate(dsh.address().port, { getLaunchToken: () => 'LAUNCH123' });
  try {
    // 1) 已过 gate 认证的文档请求遇到上游 401 → 303 到 token URL
    let res = await fetch(`${gate.base}/`, {
      headers: { cookie: `gate_token=${gate.auth.cookieValue()}`, accept: 'text/html' },
      redirect: 'manual',
    });
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), '/?token=LAUNCH123');
    // 2) 该 token 请求经反代：模拟 DSH 铸 Cookie 后 303 './'（透传 set-cookie 给浏览器）
    res = await fetch(`${gate.base}/?token=LAUNCH123`, {
      headers: { cookie: `gate_token=${gate.auth.cookieValue()}`, accept: 'text/html' },
      redirect: 'manual',
    });
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), './');
    assert.match(res.headers.getSetCookie()[0], /dsh-auth-x=/);
  } finally {
    gate.server.close();
    dsh.close();
  }
});

test('上游不可达 → 502', async () => {
  // 占一个空闲端口然后关掉，保证不可达
  const holder = http.createServer(() => {});
  await new Promise((r) => holder.listen(0, '127.0.0.1', r));
  const deadPort = holder.address().port;
  await new Promise((r) => holder.close(r));

  const gate = await startGate(deadPort);
  try {
    const { server, auth } = gate;
    const res = await fetch(`${gate.base}/`, {
      headers: { cookie: `gate_token=${auth.cookieValue()}` },
    });
    assert.equal(res.status, 502);
    server.close();
  } finally {
    try { gate.server.close(); } catch {}
  }
});
