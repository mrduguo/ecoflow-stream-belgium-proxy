import { handleInterceptedRequest } from './interceptor.ts'

const enc = new TextEncoder()

function findHeaderEnd(buf: Uint8Array, n: number): number {
  for (let i = 0; i < n - 3; i++) {
    if (buf[i] === 13 && buf[i+1] === 10 && buf[i+2] === 13 && buf[i+3] === 10) return i
  }
  return -1
}

export async function handleHttpRequest(conn: Deno.TcpConn, method: string, targetUrl: string, buf: Uint8Array, n: number): Promise<void> {
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
