import { env } from '../config/env.js'
import { AppError } from '../utils/errors.js'
import { isAllowedOrigin } from '../utils/corsOrigin.js'

export function requireTrustedOrigin(req, res, next) {
  const origin = req.get('origin')
  if (!origin || !isAllowedOrigin(origin, env.FRONTEND_ORIGINS, env.NODE_ENV)) {
    return next(new AppError(403, 'Request origin is not allowed.', 'CSRF_ORIGIN_DENIED'))
  }
  return next()
}
