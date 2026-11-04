// 登录页（独立实现的最小 PIN 页面）
export const LOGIN_PATH = '/__gate/login';

export function loginPageHtml(message = '') {
  const notice = message ? `<p class="err">${escapeHtml(message)}</p>` : '';
  return `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>dsh-ipv6-gate</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#101828;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}
.card{background:#fff;border-radius:12px;padding:28px 24px;max-width:320px;width:calc(100% - 48px);text-align:center}
h1{font-size:16px;margin:0 0 4px;color:#111827}
p.sub{font-size:13px;color:#6b7280;margin:0 0 16px}
p.err{font-size:13px;color:#dc2626;margin:0 0 12px}
input{width:100%;box-sizing:border-box;padding:10px;font-size:18px;letter-spacing:4px;text-align:center;border:1px solid #d1d5db;border-radius:8px;outline:none;margin-bottom:12px}
input:focus{border-color:#2563eb;box-shadow:0 0 0 1px #2563eb}
button{width:100%;padding:10px;font-size:15px;border:0;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer}
</style>
</head>
<body>
<div class="card">
<h1>dsh-ipv6-gate</h1>
<p class="sub">访问验证 · enter PIN</p>
${notice}
<form method="post" action="${LOGIN_PATH}">
<input name="pin" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" minlength="6" maxlength="64" autofocus required>
<button type="submit">解锁</button>
</form>
</div>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
