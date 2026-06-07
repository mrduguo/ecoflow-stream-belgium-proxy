const DEFAULT_INTERCEPT_HOSTS: string[] = [
  'api-e.ecoflow.com',
  'github.com',
  'gitlab.com',
  'httpbin.org',
  'registry.yarnpkg.com',
  'rubygems.org',
]

export const INTERCEPT_HOSTS: string[] = Deno.env.get('INTERCEPT_HOSTS')
  ?.split(',').map(h => h.trim()).filter(Boolean)
  ?? DEFAULT_INTERCEPT_HOSTS
