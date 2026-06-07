import { handleInterceptedRequest } from './interceptor.ts'
import { generateServerCert } from './gencert.ts'

export async function startHttpsServer(): Promise<void> {
  console.log('Generating server certificate...')
  await generateServerCert()
  console.log('Server certificate ready.')

  Deno.serve({
    port: 3129,
    hostname: '127.0.0.1',
    cert: Deno.readTextFileSync('./certificates/cert.pem'),
    key: Deno.readTextFileSync('./certificates/key.pem'),
  }, (req) => handleInterceptedRequest(req))
}
