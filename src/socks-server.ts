import { logRequest } from './log.ts'

async function readExact(conn: Deno.TcpConn, n: number): Promise<Uint8Array> {
  const buf = new Uint8Array(n)
  let offset = 0
  while (offset < n) {
    const read = await conn.read(buf.subarray(offset))
    if (read === null) throw new Error('connection closed')
    offset += read
  }
  return buf
}

async function readUntilNull(conn: Deno.TcpConn): Promise<string> {
  const bytes: number[] = []
  while (true) {
    const b = (await readExact(conn, 1))[0]
    if (b === 0) break
    bytes.push(b)
  }
  return new TextDecoder().decode(new Uint8Array(bytes))
}

function tunnel(conn: Deno.TcpConn, remote: Deno.TcpConn): void {
  conn.readable.pipeTo(remote.writable).catch(() => { try { remote.close() } catch { /* ignore */ } })
  remote.readable.pipeTo(conn.writable).catch(() => { try { conn.close() } catch { /* ignore */ } })
}

async function handleSocks4(conn: Deno.TcpConn): Promise<void> {
  const header = await readExact(conn, 7) // cmd(1) + port(2) + ip(4)
  const cmd = header[0]
  const port = (header[1] << 8) | header[2]
  const ip = header.subarray(3, 7)

  await readUntilNull(conn) // userid (ignored)

  let host: string
  // SOCKS4a: IP 0.0.0.x means domain name follows after userid
  if (ip[0] === 0 && ip[1] === 0 && ip[2] === 0 && ip[3] !== 0) {
    host = await readUntilNull(conn)
  } else {
    host = `${ip[0]}.${ip[1]}.${ip[2]}.${ip[3]}`
  }

  const reply = new Uint8Array(8) // VN=0, CD, DSTPORT(2), DSTIP(4)

  if (cmd !== 0x01) {
    reply[1] = 0x5B
    await conn.write(reply)
    conn.close()
    return
  }

  try {
    logRequest('SOCKS4', `${host}:${port}`)
    const remote = await Deno.connect({ hostname: host, port })
    reply[1] = 0x5A
    await conn.write(reply)
    tunnel(conn, remote)
  } catch {
    reply[1] = 0x5B
    await conn.write(reply)
    conn.close()
  }
}

async function handleSocks5(conn: Deno.TcpConn): Promise<void> {
  const nmethods = (await readExact(conn, 1))[0]
  await readExact(conn, nmethods) // discard offered auth methods
  await conn.write(new Uint8Array([0x05, 0x00])) // no auth required

  const reqHeader = await readExact(conn, 4) // ver, cmd, rsv, atyp
  const cmd = reqHeader[1]
  const atyp = reqHeader[3]

  let host: string
  if (atyp === 0x01) {
    const addr = await readExact(conn, 4)
    host = `${addr[0]}.${addr[1]}.${addr[2]}.${addr[3]}`
  } else if (atyp === 0x03) {
    const len = (await readExact(conn, 1))[0]
    host = new TextDecoder().decode(await readExact(conn, len))
  } else if (atyp === 0x04) {
    const addr = await readExact(conn, 16)
    const groups: string[] = []
    for (let i = 0; i < 16; i += 2) groups.push(((addr[i] << 8) | addr[i + 1]).toString(16))
    host = groups.join(':')
  } else {
    await conn.write(new Uint8Array([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0])) // address type not supported
    conn.close()
    return
  }

  const portBytes = await readExact(conn, 2)
  const port = (portBytes[0] << 8) | portBytes[1]

  if (cmd !== 0x01) {
    await conn.write(new Uint8Array([0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0])) // command not supported
    conn.close()
    return
  }

  try {
    logRequest('SOCKS5', `${host}:${port}`)
    const remote = await Deno.connect({ hostname: host, port })
    await conn.write(new Uint8Array([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0])) // success, bind 0.0.0.0:0
    tunnel(conn, remote)
  } catch {
    await conn.write(new Uint8Array([0x05, 0x04, 0x00, 0x01, 0, 0, 0, 0, 0, 0])) // host unreachable
    conn.close()
  }
}

async function handleConnection(conn: Deno.TcpConn): Promise<void> {
  const version = (await readExact(conn, 1))[0]
  if (version === 0x04) {
    await handleSocks4(conn)
  } else if (version === 0x05) {
    await handleSocks5(conn)
  } else {
    conn.close()
  }
}

export async function startSocksServer(port: number): Promise<void> {
  const listener = Deno.listen({ port, hostname: '0.0.0.0' })
  console.log(`SOCKS proxy listening on :${port}`)
  for await (const conn of listener) {
    handleConnection(conn).catch(() => { try { conn.close() } catch { /* ignore */ } })
  }
}
