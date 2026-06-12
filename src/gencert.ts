import { INTERCEPT_HOSTS } from './hosts.ts'

const run = (args: string[]) => new Deno.Command(args[0], { args: args.slice(1) }).output()

function exists(path: string): boolean {
  try {
    Deno.statSync(path)
    return true
  } catch {
    return false
  }
}

export async function generateCa(): Promise<void> {
  Deno.mkdirSync('certificates', { recursive: true })

  const caConfig = '/tmp/mitm_ca.cnf'
  await Deno.writeTextFile(caConfig, [
    '[req]',
    'distinguished_name = dn',
    'x509_extensions = v3_ca',
    'prompt = no',
    '',
    '[dn]',
    'CN = Man In The Middle Proxy CA',
    'O = https://github.com/mrduguo/man-in-the-middle-proxy',
    '',
    '[v3_ca]',
    'subjectKeyIdentifier = hash',
    'authorityKeyIdentifier = keyid:always, issuer',
    'basicConstraints = critical, CA:TRUE',
    'keyUsage = critical, keyCertSign, cRLSign',
  ].join('\n'))

  await run(['openssl', 'genrsa', '-out', 'certificates/ca.key', '4096'])
  await run(['openssl', 'req', '-x509', '-new', '-nodes', '-key', 'certificates/ca.key',
    '-sha256', '-days', '3650', '-config', caConfig, '-out', 'certificates/ca.crt'])

  await Deno.remove(caConfig).catch(() => {})
}

export async function generateServerCert(): Promise<void> {
  if (!exists('certificates/ca.crt') || !exists('certificates/ca.key')) {
    console.log('CA certificate not found, generating...')
    await generateCa()
    console.log('CA certificate ready — install certificates/ca.crt on your device.')
  }

  const sanList = ['DNS:localhost', ...INTERCEPT_HOSTS.map(h => `DNS:${h}`)].join(',')
  const extFile = '/tmp/mitm_ext.cnf'

  await Deno.writeTextFile(extFile, [
    `subjectAltName=${sanList}`,
    'subjectKeyIdentifier=hash',
    'authorityKeyIdentifier=keyid,issuer',
    'basicConstraints=CA:FALSE',
    'keyUsage=digitalSignature,keyEncipherment',
    'extendedKeyUsage=serverAuth',
  ].join('\n'))

  await run(['openssl', 'genrsa', '-out', 'certificates/key.pem', '4096'])
  await run(['openssl', 'req', '-new', '-key', 'certificates/key.pem',
    '-subj', '/CN=Man In The Middle Proxy', '-out', 'certificates/server.csr'])
  await run(['openssl', 'x509', '-req', '-in', 'certificates/server.csr',
    '-CA', 'certificates/ca.crt', '-CAkey', 'certificates/ca.key',
    '-CAcreateserial', '-days', '825', '-sha256',
    '-extfile', extFile, '-out', 'certificates/cert.pem'])

  for (const f of ['certificates/server.csr', 'certificates/ca.srl', extFile]) {
    await Deno.remove(f).catch(() => {})
  }
}
