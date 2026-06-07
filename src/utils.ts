// Connect to an external address so the OS picks the outbound interface,
// then read the assigned local IP — no data is sent.
export async function resolvePrimaryIp(): Promise<string> {
  const conn = await Deno.connect({ hostname: '8.8.8.8', port: 53 })
  const ip = (conn.localAddr as Deno.NetAddr).hostname
  conn.close()
  return ip
}
