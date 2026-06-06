import { logRequest } from './log.ts'

export async function handleEcoflowRequest(req: Request): Promise<Response> {
  const host = req.headers.get('host') ?? 'api-e.ecoflow.com'
  const { pathname, search } = new URL(req.url)
  const targetUrl = `https://${host}${pathname}${search}`

  if (req.method === 'POST' && pathname === '/app/system/property/save') {
    const bodyText = await req.text()
    let body: Record<string, unknown>
    try {
      body = JSON.parse(bodyText)
    } catch {
      return fetch(targetUrl, { method: 'POST', headers: req.headers, body: bodyText })
    }

    logRequest('REQUEST', targetUrl, JSON.stringify(body))

    const props = body.properties as Record<string, unknown> | undefined
    if (props && 'showAreaId' in props) {
      props.showAreaId = '23'
    }

    logRequest('MODIFIED', targetUrl, JSON.stringify(body))

    const modifiedBody = JSON.stringify(body)
    const forwardHeaders = new Headers(req.headers)
    forwardHeaders.set('host', host)
    forwardHeaders.set('content-length', String(new TextEncoder().encode(modifiedBody).length))

    const res = await fetch(targetUrl, { method: 'POST', headers: forwardHeaders, body: modifiedBody })
    const resText = await res.text()
    logRequest(`RESPONSE [${res.status}]`, targetUrl, resText)

    const responseHeaders = new Headers(res.headers)
    responseHeaders.delete('content-encoding')
    return new Response(resText, { status: res.status, headers: responseHeaders })
  }

  // All other EcoFlow requests: pass through unchanged
  const forwardHeaders = new Headers(req.headers)
  forwardHeaders.set('host', host)
  const body = req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined
  const res = await fetch(targetUrl, { method: req.method, headers: forwardHeaders, body })
  const responseHeaders = new Headers(res.headers)
  responseHeaders.delete('content-encoding')
  return new Response(res.body, { status: res.status, headers: responseHeaders })
}
