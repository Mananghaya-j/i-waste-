import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  FRONTEND_ORIGINS: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('./src/uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().min(1024).max(20 * 1024 * 1024).default(8 * 1024 * 1024),
  COOKIE_SECURE: z.string().default('false'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
})

const result = schema.safeParse(process.env)
if (!result.success) {
  throw new Error(`Invalid environment configuration: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`)
}

export const env = {
  ...result.data,
  FRONTEND_ORIGINS: result.data.FRONTEND_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  COOKIE_SECURE: result.data.COOKIE_SECURE === 'true' || result.data.NODE_ENV === 'production',
}
