import { logRequest } from './log.ts'

const enc = new TextEncoder()

function buildSetupPage(ip: string, port: number, socksPort: number): string {
  const pacUrl = `http://${ip}:${port}/proxy.pac`
  const certUrl = `http://${ip}:${port}/ca.crt`
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Proxy Setup</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 540px; margin: 48px auto; padding: 0 16px; color: #222; }
  h1 { font-size: 1.3rem; margin-bottom: 32px; }
  .section { margin-bottom: 28px; }
  label { display: block; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #666; margin-bottom: 6px; }
  .row { display: flex; gap: 8px; }
  input[type=text] { flex: 1; padding: 8px 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 0.95rem; background: #f9f9f9; }
  button { padding: 8px 14px; border: 1px solid #ccc; border-radius: 6px; background: #fff; cursor: pointer; font-size: 0.85rem; white-space: nowrap; }
  button:active { background: #eee; }
</style>
</head>
<body>
<h1>Proxy Setup</h1>

<div class="section">
  <label>CA Certificate</label>
  <div class="row">
    <input type="text" value="${certUrl}" readonly>
    <a href="${certUrl}" download="ca.crt"><button>Download</button></a>
  </div>
</div>

<div class="section">
  <label>Auto Settings (PAC)</label>
  <div class="row">
    <input type="text" id="pac" value="${pacUrl}" readonly>
    <button onclick="copy('pac')">Copy</button>
  </div>
</div>

<div class="section">
  <label>HTTP Proxy</label>
  <div class="row">
    <input type="text" id="http-ip" value="${ip}" readonly>
    <input type="text" id="http-port" value="${port}" readonly style="flex:0;width:70px">
    <button onclick="copyText('${ip}:${port}')">Copy</button>
  </div>
</div>

<div class="section">
  <label>SOCKS Proxy</label>
  <div class="row">
    <input type="text" id="socks-ip" value="${ip}" readonly>
    <input type="text" id="socks-port" value="${socksPort}" readonly style="flex:0;width:70px">
    <button onclick="copyText('${ip}:${socksPort}')">Copy</button>
  </div>
</div>

<script>
function copyText(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
    return
  }
  const el = document.createElement('textarea')
  el.value = text
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}
function copy(id) { copyText(document.getElementById(id).value) }
</script>
</body>
</html>`
}

export async function handleConfigRequest(conn: Deno.TcpConn, uri: string, port: number, ip: string): Promise<boolean> {
  const socksPort = port + 2
  if (uri === '/' || uri === '') {
    logRequest('GET', uri)
    const html = enc.encode(buildSetupPage(ip, port, socksPort))
    await conn.write(enc.encode([
      'HTTP/1.1 200 OK',
      'Content-Type: text/html; charset=utf-8',
      `Content-Length: ${html.length}`,
      '', '',
    ].join('\r\n')))
    await conn.write(html)
    conn.close()
    return true
  }
  if (uri === '/ca.crt') {
    logRequest('GET', uri)
    const cert = Deno.readFileSync('./certificates/ca.crt')
    await conn.write(enc.encode([
      'HTTP/1.1 200 OK',
      'Content-Type: application/x-x509-ca-cert',
      `Content-Length: ${cert.length}`,
      '', '',
    ].join('\r\n')))
    await conn.write(cert)
    conn.close()
    return true
  }
  if (uri === '/proxy.pac') {
    logRequest('GET', uri)
    const pac = enc.encode(`function FindProxyForURL(url, host) { return "PROXY ${ip}:${port}; SOCKS5 ${ip}:${socksPort}"; }\n`)
    await conn.write(enc.encode([
      'HTTP/1.1 200 OK',
      'Content-Type: application/x-ns-proxy-autoconfig',
      `Content-Length: ${pac.length}`,
      '', '',
    ].join('\r\n')))
    await conn.write(pac)
    conn.close()
    return true
  }
  return false
}
