import { prisma } from '../config/prisma.js'
import { pagination, paginated } from '../utils/pagination.js'
import { notFound } from '../utils/errors.js'

export async function listNotifications(userId, query) {
  const { skip, take, page, limit } = pagination(query)
  const where = { userId }
  const [data, total] = await prisma.$transaction([
    prisma.notification.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.notification.count({ where }),
  ])
  return paginated(data, total, page, limit)
}

export async function markRead(userId, id) {
  const result = await prisma.notification.updateMany({
    where: { id, userId },
    data: { readAt: new Date() },
  })
  if (!result.count) throw notFound('Notification not found.')
}
