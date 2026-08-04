import { INTERCEPT_REQUESTS } from './intercept-request.ts'

const DEFAULT_INTERCEPT_HOSTS: string[] = [
  'archive.ubuntu.com',
  'github.com',
  'gitlab.com',
  'httpbin.org',
  'ports.ubuntu.com',
  'registry.yarnpkg.com',
  'rubygems.org',
  'security.ubuntu.com',
]

const configuredHosts = Deno.env.get('INTERCEPT_HOSTS')
  ?.split(',').map(h => h.trim()).filter(Boolean)
  ?? DEFAULT_INTERCEPT_HOSTS

// Hosts referenced by an InterceptRequest rule are always intercepted,
// regardless of configuration - a rule is useless if its traffic never
// reaches it.
export const INTERCEPT_HOSTS: string[] = [...new Set([
  ...configuredHosts,
  ...INTERCEPT_REQUESTS.map(r => r.host),
])]
