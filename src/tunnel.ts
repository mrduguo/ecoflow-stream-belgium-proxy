import { logRequest } from './log.ts'

const ECOFLOW_HOST = 'api-e.ecoflow.com'
const INTERCEPT_PORT = 3129
const enc = new TextEncoder()

async function handleConnection(conn: Deno.TcpConn): Promise<void> {
  const buf = new Uint8Array(4096)
  const n = await conn.read(buf)
  if (!n) { conn.close(); return }

  const text = new TextDecoder().decode(buf.subarray(0, n))
  const [method, uri] = text.split('\r\n')[0].split(' ')

  // Serve CA certificate for phone installation
  if (method === 'GET') {
    const cert = Deno.readFileSync('./certificates/ca.crt')
    await conn.write(enc.encode([
      'HTTP/1.1 200 OK',
      'Content-Type: application/x-x509-ca-cert',
      `Content-Length: ${cert.length}`,
      '', '',
    ].join('\r\n')))
    await conn.write(cert)
    conn.close()
    return
  }

  if (method !== 'CONNECT') {
    await conn.write(enc.encode('HTTP/1.1 400 Bad Request\r\n\r\n'))
    conn.close()
    return
  }

  const colonIdx = uri.lastIndexOf(':')
  const host = uri.slice(0, colonIdx)
  const port = Number(uri.slice(colonIdx + 1))

  logRequest('CONNECT', uri)

  const targetHost = host === ECOFLOW_HOST ? '127.0.0.1' : host
  const targetPort = host === ECOFLOW_HOST ? INTERCEPT_PORT : port

  if (host === ECOFLOW_HOST) {
    console.log(`Intercepting ${uri} → localhost:${INTERCEPT_PORT}`)
  }

  const remote = await Deno.connect({ hostname: targetHost, port: targetPort })

  conn.readable.pipeTo(remote.writable).catch(() => { try { remote.close() } catch { /* ignore */ } })
  remote.readable.pipeTo(conn.writable).catch(() => { try { conn.close() } catch { /* ignore */ } })

  await conn.write(enc.encode('HTTP/1.1 200 Connection Established\r\n\r\n'))
}

export async function startTunnel(port = 3128): Promise<void> {
  const listener = Deno.listen({ port, hostname: '0.0.0.0' })
  console.log(`CONNECT proxy listening on :${port}`)
  for await (const conn of listener) {
    handleConnection(conn).catch(() => { try { conn.close() } catch { /* ignore */ } })
  }
}
