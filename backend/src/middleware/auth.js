import jwt from 'jsonwebtoken'
import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { AppError } from '../utils/errors.js'

export async function authenticate(req, res, next) {
  const header = req.get('authorization')
  if (!header?.startsWith('Bearer ')) return next(new AppError(401, 'Authentication required.', 'UNAUTHENTICATED'))

  let payload
  try {
    payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] })
    if (typeof payload !== 'object' || !payload.sub) throw new Error('Invalid token')
  } catch {
    return next(new AppError(401, 'Invalid or expired access token.', 'INVALID_TOKEN'))
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, status: true },
  })
  if (!user || user.status !== 'ACTIVE') return next(new AppError(401, 'Authentication required.', 'UNAUTHENTICATED'))
  req.user = user
  return next()
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, 'You do not have permission to perform this action.', 'FORBIDDEN'))
    }
    return next()
  }
}
