import { startTunnel } from './tunnel.ts'
import { handleEcoflowRequest } from './ecoflow.ts'
import { logRequest } from './log.ts'

Deno.writeFileSync('./http-request.log', new Uint8Array(), { append: true, create: true })

startTunnel(3128)

Deno.serve({
  port: 3129,
  hostname: '127.0.0.1',
  cert: Deno.readTextFileSync('./certificates/cert.pem'),
  key: Deno.readTextFileSync('./certificates/key.pem'),
}, async (req) => {
  const host = req.headers.get('host') ?? new URL(req.url).host
  const { pathname, search } = new URL(req.url)
  logRequest(req.method, `https://${host}${pathname}${search}`)
  return handleEcoflowRequest(req)
})

const ip = await getLocalIP()
console.log()
console.log(`Set iPhone WiFi proxy → ${ip}:3128`)
console.log(`Install CA cert → open in iPhone Safari: http://${ip}:3128/cert`)
console.log(`Watching http-request.log for traffic`)

async function getLocalIP(): Promise<string> {
  const conn = await Deno.connect({ hostname: '8.8.8.8', port: 53 })
  const ip = (conn.localAddr as Deno.NetAddr).hostname
  conn.close()
  return ip
}
