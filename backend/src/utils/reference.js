import { randomBytes } from 'node:crypto'

export function createReference(prefix) {
  const date = new Date().toISOString().slice(2, 10).replaceAll('-', '')
  return `IW-${prefix}-${date}-${randomBytes(8).toString('hex').toUpperCase()}`
}

export function randomToken(bytes = 48) {
  return randomBytes(bytes).toString('base64url')
}
