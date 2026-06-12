import { startProxyServer } from './proxy-server.ts'
import { startHttpsServer } from './https-server.ts'
import { resolvePrimaryIp } from './utils.ts'

const PROXY_PORT = parseInt(Deno.env.get('PROXY_PORT') ?? '3128')
const INTERCEPT_PORT = PROXY_PORT + 1
const ip = await resolvePrimaryIp()

await startHttpsServer(INTERCEPT_PORT)

startProxyServer(PROXY_PORT, ip, INTERCEPT_PORT)

console.log()
console.log(`Set device proxy → ${ip}:${PROXY_PORT}`)
console.log(`Proxy auto-config (PAC) → http://${ip}:${PROXY_PORT}/proxy.pac`)
console.log(`Install CA cert → open in device browser: http://${ip}:${PROXY_PORT}/ca.crt`)
console.log(`Traffic is logged below`)
