export function logRequest(method: string, url: string, note = '') {
  console.log(`${new Date().toISOString()} ${method} ${url}${note ? '  ' + note : ''}`)
}
