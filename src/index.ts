import { startProxyServer } from './proxy-server.ts'
import { startHttpsServer } from './https-server.ts'
import { startSocksServer } from './socks-server.ts'
import { resolvePrimaryIp } from './utils.ts'

const PROXY_PORT = parseInt(Deno.env.get('PROXY_PORT') ?? '3128')
const ip = await resolvePrimaryIp()

await startHttpsServer(PROXY_PORT + 1)

startProxyServer(PROXY_PORT, ip)
startSocksServer(PROXY_PORT + 2)

console.log()
console.log(`Setup page → http://${ip}:${PROXY_PORT}/`)
console.log(`Set device proxy → ${ip}:${PROXY_PORT}`)
console.log(`Set device SOCKS proxy → ${ip}:${PROXY_PORT + 2}`)
console.log(`Proxy auto-config (PAC) → http://${ip}:${PROXY_PORT}/proxy.pac`)
console.log(`Install CA cert → open in device browser: http://${ip}:${PROXY_PORT}/ca.crt`)
console.log(`Traffic is logged below`)
