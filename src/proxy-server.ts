import { logRequest } from './log.ts'
import { INTERCEPT_HOSTS } from './hosts.ts'
import { handleInterceptedRequest } from './interceptor.ts'

const INTERCEPT_PORT = 3129
const enc = new TextEncoder()

function findHeaderEnd(buf: Uint8Array, n: number): number {
  for (let i = 0; i < n - 3; i++) {
    if (buf[i] === 13 && buf[i+1] === 10 && buf[i+2] === 13 && buf[i+3] === 10) return i
  }
  return -1
}

async function handleHttpRequest(conn: Deno.TcpConn, method: string, targetUrl: string, buf: Uint8Array, n: number): Promise<void> {
  const headerEnd = findHeaderEnd(buf, n)
  const headerSection = new TextDecoder().decode(buf.subarray(0, headerEnd >= 0 ? headerEnd : n))

  const headers = new Headers()
  for (const line of headerSection.split('\r\n').slice(1)) {
    const colon = line.indexOf(':')
    if (colon > 0) headers.set(line.slice(0, colon).trim(), line.slice(colon + 1).trim())
  }

  let bodyBytes: Uint8Array | undefined
  const contentLength = parseInt(headers.get('content-length') ?? '0')
  if (contentLength > 0 && headerEnd >= 0) {
    const bodyInBuf = buf.subarray(headerEnd + 4, n)
    bodyBytes = new Uint8Array(contentLength)
    bodyBytes.set(bodyInBuf.subarray(0, Math.min(bodyInBuf.length, contentLength)))
    let offset = Math.min(bodyInBuf.length, contentLength)
    while (offset < contentLength) {
      const chunk = new Uint8Array(Math.min(65536, contentLength - offset))
      const bytesRead = await conn.read(chunk)
      if (!bytesRead) break
      bodyBytes.set(chunk.subarray(0, bytesRead), offset)
      offset += bytesRead
    }
  }

  const body = bodyBytes ? bodyBytes.buffer as ArrayBuffer : undefined
  const req = new Request(targetUrl, { method, headers, body })

  const res = await handleInterceptedRequest(req, targetUrl)

  const resBody = new Uint8Array(await res.arrayBuffer())
  const resLines = [`HTTP/1.1 ${res.status} ${res.statusText || 'OK'}`]
  for (const [k, v] of res.headers) {
    const kl = k.toLowerCase()
    if (kl === 'transfer-encoding' || kl === 'content-encoding' || kl === 'content-length') continue
    resLines.push(`${k}: ${v}`)
  }
  resLines.push(`content-length: ${resBody.length}`)

  await conn.write(enc.encode(resLines.join('\r\n') + '\r\n\r\n'))
  if (resBody.length) await conn.write(resBody)
  conn.close()
}

async function handleConnection(conn: Deno.TcpConn, port: number, ip: string): Promise<void> {
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
      return
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
      return
    }
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
  const targetPort = intercept ? INTERCEPT_PORT : connectPort

  if (intercept) {
    console.log(`Intercepting ${uri} → localhost:${INTERCEPT_PORT}`)
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
