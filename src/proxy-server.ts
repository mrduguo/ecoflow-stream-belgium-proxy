import { logRequest } from './log.ts'
import { INTERCEPT_HOSTS } from './hosts.ts'
import { handleHttpRequest } from './http-handler.ts'
import { handleConfigRequest } from './proxy-endpoints.ts'

const enc = new TextEncoder()

async function handleConnection(conn: Deno.TcpConn, port: number, ip: string): Promise<void> {
  const interceptPort = port + 1
  const buf = new Uint8Array(65536)
  const n = await conn.read(buf)
  if (!n) { conn.close(); return }

  // TLS ClientHello starts with 0x16 0x03 — reject non-HTTP connections early
  if (buf[0] === 0x16 && buf[1] === 0x03) {
    logRequest('TLS 400', conn.remoteAddr ? (conn.remoteAddr as Deno.NetAddr).hostname : 'unknown', 'direct TLS connection to HTTP proxy port')
    await conn.write(enc.encode('HTTP/1.1 400 Bad Request\r\n\r\n'))
    conn.close()
    return
  }

  const text = new TextDecoder().decode(buf.subarray(0, n))
  const [method, uri] = text.split('\r\n')[0].split(' ')

  if (method === 'GET') {
    if (await handleConfigRequest(conn, uri, port, ip)) return
    if (uri.startsWith('http://')) {
      await handleHttpRequest(conn, method, uri, buf, n)
      return
    }
    logRequest('GET 400', uri)
    await conn.write(enc.encode('HTTP/1.1 400 Bad Request\r\n\r\n'))
    conn.close()
    return
  }

  if (uri.startsWith('http://')) {
    await handleHttpRequest(conn, method, uri, buf, n)
    return
  }

  if (method !== 'CONNECT') {
    logRequest(`${method} 400`, uri)
    await conn.write(enc.encode('HTTP/1.1 400 Bad Request\r\n\r\n'))
    conn.close()
    return
  }

  const colonIdx = uri.lastIndexOf(':')
  const host = uri.slice(0, colonIdx)
  const connectPort = Number(uri.slice(colonIdx + 1))

  logRequest('CONNECT', uri)

  const intercept = INTERCEPT_HOSTS.includes(host)
  const targetHost = intercept ? '127.0.0.1' : host
  const targetPort = intercept ? interceptPort : connectPort

  if (intercept) {
    console.log(`Intercepting ${uri} → localhost:${interceptPort}`)
  }

  const remote = await Deno.connect({ hostname: targetHost, port: targetPort })

  conn.readable.pipeTo(remote.writable).catch(() => { try { remote.close() } catch { /* ignore */ } })
  remote.readable.pipeTo(conn.writable).catch(() => { try { conn.close() } catch { /* ignore */ } })

  await conn.write(enc.encode('HTTP/1.1 200 Connection Established\r\n\r\n'))
}

export async function startProxyServer(port: number, ip: string): Promise<void> {
  const listener = Deno.listen({ port, hostname: '0.0.0.0' })
  console.log(`CONNECT proxy listening on :${port}`)
  for await (const conn of listener) {
    handleConnection(conn, port, ip).catch(() => { try { conn.close() } catch { /* ignore */ } })
  }
}
