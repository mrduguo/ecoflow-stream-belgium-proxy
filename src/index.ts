import { startProxyServer } from './proxy-server.ts'
import { startHttpsServer } from './https-server.ts'
import { resolvePrimaryIp } from './utils.ts'

Deno.mkdirSync('./tmp', { recursive: true })
Deno.writeFileSync('./tmp/http-request.log', new Uint8Array(), { append: true, create: true })

const PROXY_PORT = parseInt(Deno.env.get('PROXY_PORT') ?? '3128')
const ip = await resolvePrimaryIp()

await startHttpsServer()

startProxyServer(PROXY_PORT, ip)

console.log()
console.log(`Set device proxy → ${ip}:${PROXY_PORT}`)
console.log(`Proxy auto-config (PAC) → http://${ip}:${PROXY_PORT}/proxy.pac`)
console.log(`Install CA cert → open in device browser: http://${ip}:${PROXY_PORT}/ca.crt`)
console.log(`Watching tmp/http-request.log for traffic`)
