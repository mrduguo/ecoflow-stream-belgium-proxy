import { startTunnel } from './tunnel.ts'
import { handleInterceptedRequest } from './interceptor.ts'
import { logRequest } from './log.ts'
import { generateServerCert } from './gencert.ts'

Deno.mkdirSync('./tmp', { recursive: true })
Deno.writeFileSync('./tmp/http-request.log', new Uint8Array(), { append: true, create: true })

startTunnel(3128)

console.log('Generating server certificate...')
await generateServerCert()
console.log('Server certificate ready.')

Deno.serve({
  port: 3129,
  hostname: '127.0.0.1',
  cert: Deno.readTextFileSync('./certificates/cert.pem'),
  key: Deno.readTextFileSync('./certificates/key.pem'),
}, (req) => {
  const host = req.headers.get('host') ?? new URL(req.url).host
  const { pathname, search } = new URL(req.url)
  logRequest(req.method, `https://${host}${pathname}${search}`)
  return handleInterceptedRequest(req)
})

const ip = await getLocalIP()
console.log()
console.log(`Set device WiFi proxy → ${ip}:3128`)
console.log(`Install CA cert → open in device browser: http://${ip}:3128/ca.crt`)
console.log(`Watching tmp/http-request.log for traffic`)

async function getLocalIP(): Promise<string> {
  const conn = await Deno.connect({ hostname: '8.8.8.8', port: 53 })
  const ip = (conn.localAddr as Deno.NetAddr).hostname
  conn.close()
  return ip
}
