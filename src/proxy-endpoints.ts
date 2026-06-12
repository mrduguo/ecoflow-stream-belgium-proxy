import { logRequest } from './log.ts'

const enc = new TextEncoder()

export async function handleConfigRequest(conn: Deno.TcpConn, uri: string, port: number, ip: string): Promise<boolean> {
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
    const pac = enc.encode(`function FindProxyForURL(url, host) { return "PROXY ${ip}:${port}"; }\n`)
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
