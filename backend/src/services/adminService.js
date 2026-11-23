import bcrypt from 'bcryptjs'
import { prisma } from '../config/prisma.js'
import { writeAudit } from '../utils/audit.js'
import { notFound } from '../utils/errors.js'
import { pagination, paginated } from '../utils/pagination.js'

const userSelect = { id: true, fullName: true, email: true, contactNumber: true, role: true, status: true, createdAt: true }

export async function listAdmins(req) {
  const { skip, take, page, limit } = pagination(req.query)
  const where = { role: 'ADMIN' }
  const [data, total] = await prisma.$transaction([
    prisma.user.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, select: userSelect }),
    prisma.user.count({ where }),
  ])
  return paginated(data, total, page, limit)
}

export async function createAdmin(input, req) {
  const passwordHash = await bcrypt.hash(input.password, 12)
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        fullName: input.fullName, email: input.email, contactNumber: input.contactNumber,
        passwordHash, role: 'ADMIN', status: input.status,
      },
      select: userSelect,
    })
    await writeAudit(tx, req, { action: 'ADMIN_ACCOUNT_CREATED', entityType: 'User', entityId: user.id })
    return user
  })
}

export async function updateAdmin(id, input, req) {
  const current = await prisma.user.findFirst({ where: { id, role: 'ADMIN' } })
  if (!current) throw notFound('Admin account not found.')
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id }, data: input, select: userSelect })
    if (input.status === 'INACTIVE') {
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })
    }
    await writeAudit(tx, req, {
      action: 'ADMIN_ACCOUNT_UPDATED', entityType: 'User', entityId: id,
      metadata: input.status ? { status: input.status } : {},
    })
    return user
  })
}

export async function dashboardStats() {
  const [activePickup, activeTree, activeWaterway, pendingPickup, pendingTree, pendingWaterway, complaints, activeTrucks, totalTrucks, completed, monthlyReports] = await Promise.all([
    prisma.pickupRequest.count({ where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } } }),
    prisma.treeRequest.count({ where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } } }),
    prisma.waterwayRequest.count({ where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } } }),
    prisma.pickupRequest.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.treeRequest.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.waterwayRequest.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.environmentalReport.count({ where: { status: { notIn: ['COMPLETED', 'REJECTED'] } } }),
    prisma.truck.count({ where: { status: 'ACTIVE' } }),
    prisma.truck.count(),
    prisma.pickupRequest.count({ where: { status: 'COMPLETED', updatedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
    prisma.environmentalReport.groupBy({ by: ['type', 'status'], _count: { _all: true } }),
  ])

  const monthlyStatistics = await Promise.all(Array.from({ length: 6 }, async (_, index) => {
    const offset = 5 - index
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    start.setMonth(start.getMonth() - offset)
    const end = new Date(start)
    end.setMonth(end.getMonth() + 1)
    const [pickupRequests, treeRequests, waterwayRequests] = await Promise.all([
      prisma.pickupRequest.count({ where: { createdAt: { gte: start, lt: end } } }),
      prisma.treeRequest.count({ where: { createdAt: { gte: start, lt: end } } }),
      prisma.waterwayRequest.count({ where: { createdAt: { gte: start, lt: end } } }),
    ])
    return {
      month: start.toISOString().slice(0, 7),
      pickupRequests,
      treeRequests,
      waterwayRequests,
    }
  }))

  return {
    requests: {
      active: activePickup + activeTree + activeWaterway,
      pending: pendingPickup + pendingTree + pendingWaterway,
      completedThisMonth: completed,
    },
    trucks: { active: activeTrucks, total: totalTrucks },
    environmentalReports: {
      open: complaints,
      byTypeAndStatus: monthlyReports.map((item) => ({ type: item.type, status: item.status, count: item._count._all })),
    },
    monthlyStatistics,
  }
}
