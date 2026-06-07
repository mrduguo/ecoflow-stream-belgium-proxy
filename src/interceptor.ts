import { logRequest } from './log.ts'

const LOG_HEADER = Deno.env.get('LOG_HEADER') === 'true'
const LOG_BODY = Deno.env.get('LOG_BODY') === 'true'

const TEXT_TYPES = ['application/json', 'application/xml', 'application/javascript',
  'application/x-www-form-urlencoded', 'application/graphql']

function isBinary(contentType: string | null): boolean {
  if (!contentType) return false
  const ct = contentType.split(';')[0].trim().toLowerCase()
  return !ct.startsWith('text/') && !TEXT_TYPES.includes(ct)
}

function logBody(label: string, url: string, contentType: string | null, bytes: Uint8Array) {
  if (isBinary(contentType)) {
    logRequest(label, url, `[binary content-type=${contentType} bytes=${bytes.length}]`)
  } else {
    const text = new TextDecoder().decode(bytes)
    if (text) logRequest(label, url, text)
  }
}

export async function handleInterceptedRequest(req: Request, targetUrl?: string): Promise<Response> {
  const host = req.headers.get('host') ?? new URL(req.url).host
  const { pathname, search } = new URL(req.url)
  const url = targetUrl ?? `https://${host}${pathname}${search}`

  if (LOG_HEADER) {
    logRequest('REQUEST HEADERS', url, JSON.stringify(Object.fromEntries(req.headers)))
  }

  let body: BodyInit | undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const bytes = new Uint8Array(await req.arrayBuffer())
    if (LOG_BODY && bytes.length) {
      logBody('REQUEST BODY', url, req.headers.get('content-type'), bytes)
    }
    body = bytes
  }

  const forwardHeaders = new Headers(req.headers)
  forwardHeaders.set('host', host)
  if (!req.headers.has('accept-encoding')) forwardHeaders.delete('accept-encoding')
  if (!req.headers.has('accept-language')) forwardHeaders.delete('accept-language')

  const res = await fetch(url, { method: req.method, headers: forwardHeaders, body })

  if (LOG_HEADER) {
    logRequest(`RESPONSE [${res.status}] HEADERS`, url, JSON.stringify(Object.fromEntries(res.headers)))
  }

  const responseHeaders = new Headers(res.headers)
  responseHeaders.delete('content-encoding')

  if (LOG_BODY) {
    const bytes = new Uint8Array(await res.arrayBuffer())
    logBody(`RESPONSE [${res.status}] BODY`, url, res.headers.get('content-type'), bytes)
    return new Response(bytes, { status: res.status, headers: responseHeaders })
  }

  return new Response(res.body, { status: res.status, headers: responseHeaders })
}
