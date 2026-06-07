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

export const INTERCEPT_HOSTS: string[] = Deno.env.get('INTERCEPT_HOSTS')
  ?.split(',').map(h => h.trim()).filter(Boolean)
  ?? DEFAULT_INTERCEPT_HOSTS
