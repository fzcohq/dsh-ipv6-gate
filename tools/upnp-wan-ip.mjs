// 通过 UPnP IGD 查询路由器 WAN 口 IP（判断公网 IPv4 / CGNAT / 双层 NAT）
import dgram from 'node:dgram';
import http from 'node:http';
import { URL } from 'node:url';

function ssdpDiscover(timeoutMs = 2500) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const found = [];
    const msg = Buffer.from(
      'M-SEARCH * HTTP/1.1\r\n' +
      'HOST: 239.255.255.250:1900\r\n' +
      'MAN: "ssdp:discover"\r\n' +
      'MX: 2\r\n' +
      'ST: urn:schemas-upnp-org:device:InternetGatewayDevice:1\r\n\r\n',
    );
    socket.on('message', (buf) => {
      const text = buf.toString('utf8');
      const m = text.match(/LOCATION:\s*(\S+)/i);
      if (m) found.push(m[1]);
    });
    socket.bind(() => {
      try { socket.setBroadcast(true); } catch {}
      socket.send(msg, 1900, '239.255.255.250');
    });
    setTimeout(() => {
      try { socket.close(); } catch {}
      resolve([...new Set(found)]);
    }, timeoutMs);
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(data));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function soapPost(url, serviceType, action, bodyXml) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const envelope =
      '<?xml version="1.0"?>' +
      '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" ' +
      's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' +
      `<s:Body><u:${action} xmlns:u="${serviceType}">${bodyXml}</u:${action}></s:Body>` +
      '</s:Envelope>';
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname + (u.search || ''),
        method: 'POST',
        timeout: 5000,
        headers: {
          'Content-Type': 'text/xml; charset="utf-8"',
          SOAPAction: `"${serviceType}#${action}"`,
          'Content-Length': Buffer.byteLength(envelope),
        },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { data += c; });
        res.on('end', () => resolve(data));
      },
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end(envelope);
  });
}

const locations = await ssdpDiscover();
console.log('SSDP 响应:', locations.length ? locations.join(', ') : '（无）');
if (!locations.length) {
  console.log('路由器未开启 UPnP 或未响应，无法直接读取 WAN IP。');
  process.exit(0);
}

const location = locations[0];
const desc = await httpGet(location);
const base = new URL(location);

// 找 WANIPConnection / WANPPPConnection 的 controlURL
const services = [...desc.matchAll(/<service>([\s\S]*?)<\/service>/g)].map((m) => m[1]);
const target = services.find((s) => /WAN(IP|PPP)Connection:1/.test(s));
if (!target) {
  console.log('未找到 WAN 连接服务');
  process.exit(0);
}
const type = target.match(/<serviceType>([^<]+)<\/serviceType>/)[1].trim();
const control = target.match(/<controlURL>([^<]+)<\/controlURL>/)[1].trim();
const controlUrl = new URL(control, base).toString();

for (const action of ['GetExternalIPAddress', 'GetStatusInfo']) {
  try {
    const xml = await soapPost(controlUrl, type, action);
    const ip = xml.match(/<NewExternalIPAddress>([^<]*)<\/NewExternalIPAddress>/);
    const status = xml.match(/<NewConnectionStatus>([^<]*)<\/NewConnectionStatus>/);
    if (ip) console.log(`UPnP ${action}: WAN IP = ${ip[1]}`);
    if (status) console.log(`UPnP ${action}: 连接状态 = ${status[1]}`);
  } catch (e) {
    console.log(`UPnP ${action} 失败:`, e.message);
  }
}
