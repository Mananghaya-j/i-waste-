import 'dotenv/config'
import path from 'node:path'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  SERVER_URL: z.string().url().optional(),
  CLIENT_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  FRONTEND_ORIGINS: z.string().optional(),
  UPLOAD_DIR: z.string().optional(),
  MAX_UPLOAD_BYTES: z.coerce.number().int().min(1024).max(20 * 1024 * 1024).default(8 * 1024 * 1024),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
})

const result = schema.safeParse(process.env)
if (!result.success) {
  throw new Error(`Invalid environment configuration: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`)
}

const clientOrigins = result.data.CLIENT_URL ?? result.data.FRONTEND_ORIGINS
if (!clientOrigins) throw new Error('Invalid environment configuration: CLIENT_URL')

const frontendOrigins = clientOrigins.split(',').map((origin) => origin.trim()).filter(Boolean)
if (!frontendOrigins.length) throw new Error('Invalid environment configuration: CLIENT_URL')

for (const origin of frontendOrigins) {
  let parsedOrigin
  try {
    parsedOrigin = new URL(origin)
  } catch {
    throw new Error('Invalid environment configuration: CLIENT_URL')
  }
  if (parsedOrigin.origin !== origin || (result.data.NODE_ENV === 'production' && parsedOrigin.protocol !== 'https:')) {
    throw new Error('Invalid environment configuration: CLIENT_URL')
  }
}

if (result.data.NODE_ENV === 'production') {
  const serverUrl = result.data.SERVER_URL ? new URL(result.data.SERVER_URL) : null
  if (!serverUrl || serverUrl.origin !== result.data.SERVER_URL || serverUrl.protocol !== 'https:') {
    throw new Error('Invalid environment configuration: SERVER_URL')
  }
  const databaseUrl = new URL(result.data.DATABASE_URL)
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol) ||
      !['require', 'verify-ca', 'verify-full'].includes(databaseUrl.searchParams.get('sslmode'))) {
    throw new Error('Invalid environment configuration: DATABASE_URL')
  }
  if (!result.data.UPLOAD_DIR || !path.isAbsolute(result.data.UPLOAD_DIR)) {
    throw new Error('Invalid environment configuration: UPLOAD_DIR')
  }
}

export const env = {
  ...result.data,
  FRONTEND_ORIGINS: frontendOrigins,
  UPLOAD_DIR: result.data.UPLOAD_DIR || './src/uploads',
  COOKIE_SECURE: result.data.COOKIE_SECURE === 'true' || result.data.NODE_ENV === 'production',
}
