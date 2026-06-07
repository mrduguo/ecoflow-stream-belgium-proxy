import { INTERCEPT_HOSTS } from './hosts.ts'

export async function generateServerCert(): Promise<void> {
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

  const run = (args: string[]) => new Deno.Command(args[0], { args: args.slice(1) }).output()

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
