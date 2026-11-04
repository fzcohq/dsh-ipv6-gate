const base = 'http://127.0.0.1:3090';
const token = process.argv[2];

const authRes = await fetch(base + '/?token=' + token, { redirect: 'manual' });
const cookie = (authRes.headers.get('set-cookie') || '').split(';')[0];

const urls = [
  '/plugins/??dsh-ipv6-gate/client.js',
  '/plugins/??dsh-client-connection/client.js',
  '/plugins/??dsh-client-modules/client.js',
];
for (const u of urls) {
  const r = await fetch(base + u, { headers: { cookie } });
  const t = await r.text();
  console.log(u.substring(11, 50).padEnd(40), r.status, 'len:', t.length,
    t.length > 0 ? 'has gate log: ' + t.includes('[gate]') : '');
}
