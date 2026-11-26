import bcrypt from 'bcryptjs'
import { prisma } from '../database/prisma.js'
import { writeAudit } from '../utils/audit.js'
import { notFound, AppError } from '../utils/errors.js'
import { pagination, paginated } from '../utils/pagination.js'

export const ADMIN_PERMISSIONS = ['requests:manage', 'requests:update_status', 'reports:manage', 'announcements:manage']
const userSelect = { id: true, fullName: true, email: true, contactNumber: true, role: true, status: true, permissions: true, createdAt: true }

export async function listRoleUsers(req) {
  const { skip, take, page, limit } = pagination(req.query)
  const roleUserSelect = { id: true, fullName: true, email: true, role: true, status: true, createdAt: true }
  const [data, total] = await prisma.$transaction([
    prisma.user.findMany({ skip, take, orderBy: { createdAt: 'desc' }, select: roleUserSelect }),
    prisma.user.count(),
  ])
  return paginated(data, total, page, limit)
}

export async function listInvestigators() {
  return prisma.user.findMany({
    where: { role: 'ADMIN', status: 'ACTIVE' },
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' },
  })
}

export async function updateUserRole(id, role, req) {
  if (id === req.user.id) throw new AppError(409, 'You cannot change your own role.', 'SELF_ROLE_CHANGE')
  if (!['RESIDENT', 'ADMIN'].includes(role)) throw new AppError(400, 'Choose Resident or Admin.', 'INVALID_ROLE')

  return prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id }, select: { id: true, role: true } })
    if (!current) throw notFound('User account not found.')
    if (current.role === 'SUPER_ADMIN') throw new AppError(409, 'Super-admin roles cannot be changed here.', 'PROTECTED_ROLE')

    const user = await tx.user.update({
      where: { id },
      data: { role, permissions: role === 'ADMIN' ? ADMIN_PERMISSIONS : [] },
      select: userSelect,
    })
    if (role === 'RESIDENT') {
      await tx.environmentalReport.updateMany({
        where: { assignedInvestigatorId: id },
        data: { assignedInvestigatorId: null },
      })
    }
    if (role === 'RESIDENT' && current.role === 'ADMIN') {
      await tx.truck.updateMany({ where: { adminId: id }, data: { adminId: null } })
    }
    await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })
    await writeAudit(tx, req, {
      action: 'USER_ROLE_UPDATED',
      entityType: 'User',
      entityId: id,
      metadata: { from: current.role, to: role },
    })
    return user
  }, { isolationLevel: 'Serializable' })
}

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
        passwordHash, role: 'ADMIN', status: input.status, permissions: ADMIN_PERMISSIONS,
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

export async function updateAdminPermissions(id, permissions, req) {
  const current = await prisma.user.findFirst({ where: { id, role: 'ADMIN' } })
  if (!current) throw notFound('Admin account not found.')
  if (permissions.some((permission) => !ADMIN_PERMISSIONS.includes(permission))) {
    throw new AppError(400, 'One or more permissions are not supported.', 'INVALID_PERMISSION')
  }
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id }, data: { permissions }, select: userSelect })
    await writeAudit(tx, req, {
      action: 'ADMIN_PERMISSIONS_UPDATED',
      entityType: 'User',
      entityId: id,
      metadata: { permissions },
    })
    return user
  })
}

export async function listAuditLogs(req) {
  const { skip, take, page, limit } = pagination(req.query)
  const [data, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, fullName: true, email: true } } },
    }),
    prisma.auditLog.count(),
  ])
  return paginated(data, total, page, limit)
}

const publicSettings = {
  siteName: 'i-WASTE',
  supportEmail: '',
  maintenanceMode: false,
}

export async function listSettings() {
  const settings = await prisma.systemSetting.findMany()
  const allowedKeys = new Set(Object.keys(publicSettings))
  return {
    ...publicSettings,
    ...Object.fromEntries(settings.filter(({ key }) => allowedKeys.has(key)).map(({ key, value }) => [key, value])),
  }
}

export async function updateSettings(input, req) {
  await prisma.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(input)) {
      await tx.systemSetting.upsert({
        where: { key },
        create: { key, value, updatedById: req.user.id },
        update: { value, updatedById: req.user.id },
      })
    }
    await writeAudit(tx, req, {
      action: 'SYSTEM_SETTINGS_UPDATED',
      entityType: 'SystemSetting',
      metadata: { keys: Object.keys(input) },
    })
  })
  return listSettings()
}

export async function dashboardStats() {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const nextMonthStart = new Date(monthStart)
  nextMonthStart.setMonth(nextMonthStart.getMonth() + 1)
  const [activePickup, activeTree, activeWaterway, activeEnvironmental, activeRecyclables, pendingPickup, pendingTree, pendingWaterway, pendingEnvironmental, pendingRecyclables, complaints, activeTrucks, totalTrucks, completed, monthlyReports, activeTruckMonitoring] = await Promise.all([
    prisma.pickupRequest.count({ where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } } }),
    prisma.treeRequest.count({ where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } } }),
    prisma.waterwayRequest.count({ where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } } }),
    prisma.environmentalReport.count({ where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } } }),
    prisma.recyclablesRequest.count({ where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } } }),
    prisma.pickupRequest.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.treeRequest.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.waterwayRequest.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.environmentalReport.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.recyclablesRequest.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.environmentalReport.count({ where: { status: { notIn: ['COMPLETED', 'REJECTED'] } } }),
    prisma.truck.count({ where: { status: 'ACTIVE' } }),
    prisma.truck.count(),
    prisma.pickupRequest.count({ where: { status: 'COMPLETED', completedAt: { gte: monthStart, lt: nextMonthStart } } }),
    prisma.environmentalReport.groupBy({ by: ['type', 'status'], _count: { _all: true } }),
    prisma.truck.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, truckId: true, plateNumber: true, currentStreet: true },
      orderBy: { truckId: 'asc' },
    }),
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
      active: activePickup + activeTree + activeWaterway + activeEnvironmental + activeRecyclables,
      pending: pendingPickup + pendingTree + pendingWaterway + pendingEnvironmental + pendingRecyclables,
      completedThisMonth: completed,
      byKind: {
        environmentalReports: complaints,
        treeRequests: activeTree + pendingTree,
        waterwayRequests: activeWaterway + pendingWaterway,
        recyclableRequests: activeRecyclables + pendingRecyclables,
      },
    },
    trucks: { active: activeTrucks, total: totalTrucks, monitoring: activeTruckMonitoring },
    environmentalReports: {
      open: complaints,
      byTypeAndStatus: monthlyReports.map((item) => ({ type: item.type, status: item.status, count: item._count._all })),
    },
    monthlyStatistics,
  }
}
