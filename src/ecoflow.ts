import type { InterceptRequest } from './intercept-request.ts'

// EcoFlow Stream 2300W Belgium grid-tie unlock: rewrite showAreaId to "23"
// (Belgium), which has the highest permitted output limit, whenever the app
// saves its region setting.
export const ecoflowIntercept: InterceptRequest = {
  host: 'api-e.ecoflow.com',
  method: 'POST',
  path: '/app/system/property/save',

  modifyBody(bytes) {
    if (!bytes.length) return bytes

    let body: Record<string, unknown>
    try {
      body = JSON.parse(new TextDecoder().decode(bytes))
    } catch {
      return bytes
    }

    const props = body.properties as Record<string, unknown> | undefined
    if (props && 'showAreaId' in props) {
      props.showAreaId = '23'
    }

    return new TextEncoder().encode(JSON.stringify(body))
  },
}
