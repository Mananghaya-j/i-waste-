const DEVELOPMENT_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export function isAllowedOrigin(origin, allowedOrigins, environment) {
  if (allowedOrigins.includes(origin)) return true
  if (environment !== 'development') return false

  try {
    const parsed = new URL(origin)
    return parsed.protocol === 'http:'
      && DEVELOPMENT_HOSTS.has(parsed.hostname)
      && parsed.origin === origin
  } catch {
    return false
  }
}
