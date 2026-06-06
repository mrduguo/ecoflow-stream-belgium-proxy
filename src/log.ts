const LOG_FILE = './http-request.log'
const enc = new TextEncoder()

export function logRequest(method: string, url: string, note = '') {
  const line = `${new Date().toISOString()} ${method} ${url}${note ? '  ' + note : ''}\n`
  Deno.writeFileSync(LOG_FILE, enc.encode(line), { append: true, create: true })
}
