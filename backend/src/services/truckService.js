import { randomUUID } from 'node:crypto'
import QRCode from 'qrcode'
import { prisma } from '../config/prisma.js'
import { writeAudit } from '../utils/audit.js'
import { AppError, notFound } from '../utils/errors.js'
import { pagination, paginated } from '../utils/pagination.js'

export async function listTrucks(req) {
  const { skip, take, page, limit } = pagination(req.query)
  const where = req.query.status ? { status: req.query.status } : {}
  const [data, total] = await prisma.$transaction([
    prisma.truck.findMany({
      where, skip, take, orderBy: { updatedAt: 'desc' },
      include: {
        admin: { select: { id: true, fullName: true } },
        trips: { where: { status: 'ACTIVE' }, take: 1, orderBy: { startedAt: 'desc' }, include: { checkpoints: { orderBy: { arrivedAt: 'asc' } } } },
      },
    }),
    prisma.truck.count({ where }),
  ])
  return paginated(data, total, page, limit)
}

export async function createTruck(input, req) {
  if (input.adminId) {
    const admin = await prisma.user.findFirst({ where: { id: input.adminId, role: { in: ['ADMIN', 'SUPERADMIN'] }, status: 'ACTIVE' } })
    if (!admin) throw new AppError(400, 'Assigned admin must be an active administrative account.', 'INVALID_ADMIN')
  }
  const qrCodeValue = randomUUID()
  const truck = await prisma.$transaction(async (tx) => {
    const record = await tx.truck.create({
      data: { ...input, qrCodeValue, status: 'IDLE' },
      include: { admin: { select: { id: true, fullName: true } } },
    })
    await writeAudit(tx, req, { action: 'TRUCK_REGISTERED', entityType: 'Truck', entityId: record.id, metadata: { truckId: record.truckId } })
    return record
  })
  return { ...truck, qrCode: await QRCode.toDataURL(qrCodeValue) }
}

export async function updateTruck(id, input, req) {
  if (input.adminId) {
    const admin = await prisma.user.findFirst({ where: { id: input.adminId, role: { in: ['ADMIN', 'SUPERADMIN'] }, status: 'ACTIVE' } })
    if (!admin) throw new AppError(400, 'Assigned admin must be an active administrative account.', 'INVALID_ADMIN')
  }
  const current = await prisma.truck.findUnique({ where: { id } })
  if (!current) throw notFound()
  const truck = await prisma.$transaction(async (tx) => {
    const record = await tx.truck.update({ where: { id }, data: input, include: { admin: { select: { id: true, fullName: true } } } })
    await writeAudit(tx, req, {
      action: input.status ? 'TRUCK_STATUS_UPDATED' : 'TRUCK_UPDATED',
      entityType: 'Truck',
      entityId: id,
      metadata: input.status ? { from: current.status, to: input.status } : {},
    })
    if (input.status && current.status !== input.status && record.adminId) {
      await tx.notification.create({
        data: {
          userId: record.adminId, type: 'TRUCK_STATUS', title: 'Truck status updated',
          message: `Truck ${record.truckId} status is now ${input.status.toLowerCase().replaceAll('_', ' ')}.`,
          entityType: 'Truck', entityId: record.id,
        },
      })
    }
    return record
  })
  return truck
}

export async function lookupQr(qrCodeValue) {
  const truck = await prisma.truck.findUnique({
    where: { qrCodeValue },
    select: { id: true, truckId: true, plateNumber: true, vehicleType: true, status: true, currentStreet: true },
  })
  if (!truck) throw notFound('Truck QR code was not found.')
  await prisma.auditLog.create({
    data: { action: 'TRUCK_QR_SCANNED', entityType: 'Truck', entityId: truck.id, metadata: { truckId: truck.truckId } },
  })
  return truck
}

export async function listRoutes() {
  return prisma.route.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: { checkpoints: { orderBy: { sequence: 'asc' } } },
  })
}

export async function saveRoute(input, req, id) {
  const data = {
    name: input.name,
    description: input.description,
    isActive: input.isActive ?? true,
    checkpoints: { create: input.checkpoints.map((checkpoint) => ({ ...checkpoint })) },
  }
  return prisma.$transaction(async (tx) => {
    const route = id
      ? await tx.route.update({
        where: { id },
        data: {
          name: input.name, description: input.description, isActive: input.isActive,
          checkpoints: {
            deleteMany: {},
            create: input.checkpoints.map((checkpoint) => ({ ...checkpoint })),
          },
        },
        include: { checkpoints: { orderBy: { sequence: 'asc' } } },
      })
      : await tx.route.create({ data, include: { checkpoints: { orderBy: { sequence: 'asc' } } } })
    await writeAudit(tx, req, {
      action: id ? 'ROUTE_UPDATED' : 'ROUTE_CREATED', entityType: 'Route', entityId: route.id,
    })
    return route
  })
}

export async function createTrip(input, req) {
  return prisma.$transaction(async (tx) => {
    const truck = await tx.truck.findUnique({ where: { id: input.truckId } })
    if (!truck) throw notFound('Truck not found.')
    if (req.user.role === 'ADMIN' && truck.adminId !== req.user.id) {
      throw new AppError(403, 'Only the truck assigned administrator can create its trip ticket.', 'FORBIDDEN')
    }
    if (truck.status === 'MAINTENANCE') throw new AppError(409, 'Truck is under maintenance.', 'TRUCK_UNAVAILABLE')
    const activeTrip = await tx.tripTicket.findFirst({ where: { truckId: truck.id, status: 'ACTIVE' } })
    if (activeTrip) throw new AppError(409, 'Truck already has an active trip ticket.', 'ACTIVE_TRIP_EXISTS')
    if (input.routeId && !(await tx.route.findUnique({ where: { id: input.routeId } }))) throw notFound('Route not found.')

    const trip = await tx.tripTicket.create({
      data: {
        tripNo: `TT-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`,
        truckId: truck.id, routeId: input.routeId, createdById: req.user.id,
      },
      include: { truck: true, route: { include: { checkpoints: { orderBy: { sequence: 'asc' } } } } },
    })
    await tx.truck.update({ where: { id: truck.id }, data: { status: 'ACTIVE', currentStreet: null } })
    await writeAudit(tx, req, { action: 'TRIP_TICKET_CREATED', entityType: 'TripTicket', entityId: trip.id, metadata: { tripNo: trip.tripNo } })
    return trip
  }, { isolationLevel: 'Serializable' })
}

export async function addCheckpoint(tripId, input, req) {
  return prisma.$transaction(async (tx) => {
    const trip = await tx.tripTicket.findUnique({ where: { id: tripId } })
    if (!trip || trip.status !== 'ACTIVE') throw notFound('Active trip ticket not found.')
    const checkpoint = await tx.tripCheckpoint.create({
      data: { tripTicketId: trip.id, streetName: input.streetName, completed: input.completed, completedAt: input.completed ? new Date() : null },
    })
    await tx.truck.update({ where: { id: trip.truckId }, data: { currentStreet: input.streetName } })
    await writeAudit(tx, req, {
      action: 'TRIP_CHECKPOINT_RECORDED', entityType: 'TripTicket', entityId: trip.id,
      metadata: { streetName: input.streetName, completed: input.completed },
    })
    return checkpoint
  })
}

export async function completeTrip(tripId, req) {
  return prisma.$transaction(async (tx) => {
    const trip = await tx.tripTicket.findUnique({ where: { id: tripId } })
    if (!trip || trip.status !== 'ACTIVE') throw notFound('Active trip ticket not found.')
    const completedAt = new Date()
    const result = await tx.tripTicket.update({ where: { id: trip.id }, data: { status: 'COMPLETED', completedAt } })
    await tx.truck.update({ where: { id: trip.truckId }, data: { status: 'ROUTE_COMPLETED' } })
    await writeAudit(tx, req, { action: 'TRIP_COMPLETED', entityType: 'TripTicket', entityId: trip.id })
    return result
  })
}

export async function getTrip(id) {
  const trip = await prisma.tripTicket.findUnique({
    where: { id },
    include: {
      truck: { select: { id: true, truckId: true, plateNumber: true, status: true, currentStreet: true } },
      route: { include: { checkpoints: { orderBy: { sequence: 'asc' } } } },
      checkpoints: { orderBy: { arrivedAt: 'asc' } },
    },
  })
  if (!trip) throw notFound('Trip ticket not found.')
  return trip
}

export async function listTrips(req) {
  const { skip, take, page, limit } = pagination(req.query)
  const where = {
    ...(req.query.truckId ? { truckId: req.query.truckId } : {}),
    ...(req.query.from || req.query.to ? { startedAt: {
      ...(req.query.from ? { gte: req.query.from } : {}),
      ...(req.query.to ? { lte: req.query.to } : {}),
    } } : {}),
  }
  const [data, total] = await prisma.$transaction([
    prisma.tripTicket.findMany({
      where, skip, take, orderBy: { startedAt: 'desc' },
      include: {
        truck: { select: { truckId: true, plateNumber: true } },
        route: { select: { name: true } },
      },
    }),
    prisma.tripTicket.count({ where }),
  ])
  return paginated(data, total, page, limit)
}
