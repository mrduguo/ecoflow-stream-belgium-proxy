import { logRequest } from './log.ts'
import { INTERCEPT_REQUESTS } from './intercept-request.ts'

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
  const start = Date.now()
  const host = req.headers.get('host') ?? new URL(req.url).host
  const { pathname, search } = new URL(req.url)
  const url = targetUrl ?? `https://${host}${pathname}${search}`

  if (LOG_HEADER) {
    logRequest('REQUEST HEADERS', url, JSON.stringify(Object.fromEntries(req.headers)))
  }

  let requestBodySize = 0
  let body: BodyInit | undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    let bytes = new Uint8Array(await req.arrayBuffer())
    if (LOG_BODY && bytes.length) {
      logBody('REQUEST BODY', url, req.headers.get('content-type'), bytes)
    }
    const rule = INTERCEPT_REQUESTS.find(r => r.host === host && r.method === req.method && r.path === pathname)
    if (rule) {
      logRequest('REQUEST', url, new TextDecoder().decode(bytes))
      bytes = rule.modifyBody(bytes)
      logRequest('MODIFIED', url, new TextDecoder().decode(bytes))
    }
    requestBodySize = bytes.length
    body = bytes
  }

  const forwardHeaders = new Headers(req.headers)
  forwardHeaders.set('host', host)
  if (!req.headers.has('accept-encoding')) forwardHeaders.delete('accept-encoding')
  if (!req.headers.has('accept-language')) forwardHeaders.delete('accept-language')
  if (body) forwardHeaders.set('content-length', String((body as Uint8Array).length))

  const res = await fetch(url, { method: req.method, headers: forwardHeaders, body })

  if (LOG_HEADER) {
    logRequest(`RESPONSE [${res.status}] HEADERS`, url, JSON.stringify(Object.fromEntries(res.headers)))
  }

  const responseHeaders = new Headers(res.headers)
  responseHeaders.delete('content-encoding')

  const resBytes = new Uint8Array(await res.arrayBuffer())
  if (LOG_BODY) {
    logBody(`RESPONSE [${res.status}] BODY`, url, res.headers.get('content-type'), resBytes)
  }
  logRequest(req.method, url, JSON.stringify({request:{size:requestBodySize},response:{size:resBytes.length},duration:Date.now()-start}))
  const nullBodyStatus = res.status === 101 || res.status === 204 || res.status === 205 || res.status === 304
  return new Response(nullBodyStatus ? null : resBytes, { status: res.status, headers: responseHeaders })
}
