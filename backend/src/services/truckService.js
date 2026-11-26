import { randomUUID } from 'node:crypto'
import QRCode from 'qrcode'
import { prisma } from '../database/prisma.js'
import { writeAudit } from '../utils/audit.js'
import { AppError, notFound } from '../utils/errors.js'
import { pagination, paginated } from '../utils/pagination.js'

export async function listTrucks(req) {
  const { skip, take, page, limit } = pagination(req.query)
  const adminView = ['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role)
  const where = {
    ...(req.query.status ? { status: req.query.status } : {}),
    ...(req.user?.role === 'ADMIN' ? { adminId: req.user.id } : {}),
  }
  const [data, total] = await prisma.$transaction([
    prisma.truck.findMany({
      where, skip, take, orderBy: { updatedAt: 'desc' },
      ...(adminView ? {
        include: {
          admin: { select: { id: true, fullName: true } },
          trips: { where: { status: 'ACTIVE' }, take: 1, orderBy: { startedAt: 'desc' }, include: { checkpoints: { orderBy: { arrivedAt: 'asc' } } } },
        },
      } : {
        select: {
          id: true, truckId: true, plateNumber: true, vehicleType: true,
          driverName: true, crew: true, status: true, currentStreet: true,
          adminId: true, updatedAt: true,
          admin: { select: { id: true, fullName: true } },
        },
      }),
    }),
    prisma.truck.count({ where }),
  ])
  return paginated(data, total, page, limit)
}

export async function createTruck(input, req) {
  if (req.user.role === 'ADMIN' && input.adminId && input.adminId !== req.user.id) {
    throw new AppError(403, 'Administrators can only register trucks assigned to themselves.', 'FORBIDDEN')
  }
  if (input.adminId) {
    const admin = await prisma.user.findFirst({ where: { id: input.adminId, role: 'ADMIN', status: 'ACTIVE' } })
    if (!admin) throw new AppError(400, 'Assigned admin must be an active administrative account.', 'INVALID_ADMIN')
  }
  const qrCodeValue = randomUUID()
  const truck = await prisma.$transaction(async (tx) => {
    const record = await tx.truck.create({
      data: { ...input, ...(req.user.role === 'ADMIN' ? { adminId: req.user.id } : {}), qrCodeValue, status: 'IDLE' },
      include: { admin: { select: { id: true, fullName: true } } },
    })
    await writeAudit(tx, req, { action: 'TRUCK_REGISTERED', entityType: 'Truck', entityId: record.id, metadata: { truckId: record.truckId } })
    return record
  })
  return { ...truck, qrCode: await QRCode.toDataURL(qrCodeValue) }
}

export async function updateTruck(id, input, req) {
  if (req.user.role === 'ADMIN' && input.adminId && input.adminId !== req.user.id) {
    throw new AppError(403, 'Administrators can only assign trucks to themselves.', 'FORBIDDEN')
  }
  if (input.adminId) {
    const admin = await prisma.user.findFirst({ where: { id: input.adminId, role: 'ADMIN', status: 'ACTIVE' } })
    if (!admin) throw new AppError(400, 'Assigned admin must be an active administrative account.', 'INVALID_ADMIN')
  }
  const current = await prisma.truck.findUnique({ where: { id } })
  if (!current) throw notFound()
  if (req.user.role === 'ADMIN' && current.adminId !== req.user.id) {
    throw new AppError(403, 'You can only update trucks assigned to your account.', 'FORBIDDEN')
  }
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

export async function lookupQr(qrCodeValue, req) {
  const truck = await prisma.truck.findUnique({
    where: { qrCodeValue },
    select: { id: true, truckId: true, plateNumber: true, vehicleType: true, status: true, currentStreet: true, adminId: true },
  })
  if (!truck) throw notFound('Truck QR code was not found.')
  if (req.user.role === 'ADMIN' && truck.adminId !== req.user.id) {
    throw new AppError(403, 'Only the administrator assigned to this truck can scan its QR code.', 'FORBIDDEN')
  }
  await writeAudit(prisma, req, {
    action: 'TRUCK_QR_SCANNED',
    entityType: 'Truck',
    entityId: truck.id,
    metadata: { truckId: truck.truckId },
  })
  return { ...truck, qrCode: await QRCode.toDataURL(qrCodeValue) }
}

export async function listRoutes({ includeInactive = false } = {}) {
  return prisma.route.findMany({
    where: includeInactive ? undefined : { isActive: true },
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
    if (input.routeId) {
      const route = await tx.route.findUnique({ where: { id: input.routeId }, select: { id: true, isActive: true } })
      if (!route) throw notFound('Route not found.')
      if (!route.isActive) throw new AppError(409, 'Inactive routes cannot be assigned to new trips.', 'ROUTE_INACTIVE')
    }

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
    const trip = await tx.tripTicket.findUnique({
      where: { id: tripId },
      include: { route: { include: { checkpoints: { orderBy: { sequence: 'asc' } } } }, checkpoints: true },
    })
    if (!trip || trip.status !== 'ACTIVE') throw notFound('Active trip ticket not found.')
    if (req.user.role === 'ADMIN') {
      const truck = await tx.truck.findUnique({ where: { id: trip.truckId }, select: { adminId: true } })
      if (truck?.adminId !== req.user.id) throw new AppError(403, 'Only the assigned administrator can update this trip.', 'FORBIDDEN')
    }
    const routeCheckpoints = trip.route?.checkpoints || []
    const routeCheckpoint = routeCheckpoints[trip.checkpoints.length]
    if (routeCheckpoints.length && (!routeCheckpoint || routeCheckpoint.streetName !== input.streetName)) {
      throw new AppError(409, 'Record the next street in the assigned route.', 'CHECKPOINT_ORDER')
    }
    const arrivedAt = new Date()
    await tx.tripCheckpoint.updateMany({
      where: { tripTicketId: trip.id, completed: false },
      data: { completed: true, completedAt: arrivedAt },
    })
    const checkpoint = await tx.tripCheckpoint.create({
      data: {
        tripTicketId: trip.id,
        streetName: input.streetName,
        ...(routeCheckpoint ? { routeCheckpointId: routeCheckpoint.id } : {}),
        completed: input.completed,
        completedAt: input.completed ? arrivedAt : null,
        arrivedAt,
      },
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
    if (req.user.role === 'ADMIN') {
      const truck = await tx.truck.findUnique({ where: { id: trip.truckId }, select: { adminId: true } })
      if (truck?.adminId !== req.user.id) throw new AppError(403, 'Only the assigned administrator can complete this trip.', 'FORBIDDEN')
    }
    const completedAt = new Date()
    const result = await tx.tripTicket.update({ where: { id: trip.id }, data: { status: 'COMPLETED', completedAt } })
    await tx.tripCheckpoint.updateMany({
      where: { tripTicketId: trip.id, completed: false },
      data: { completed: true, completedAt },
    })
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
    ...(req.user.role === 'ADMIN' ? { truck: { adminId: req.user.id } } : {}),
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
        truck: {
          select: {
            id: true, truckId: true, plateNumber: true, vehicleType: true,
            driverName: true, crew: true, status: true, currentStreet: true,
            admin: { select: { id: true, fullName: true } },
          },
        },
        route: {
          select: {
            id: true, name: true, description: true,
            checkpoints: { orderBy: { sequence: 'asc' }, select: { id: true, sequence: true, streetName: true, latitude: true, longitude: true } },
          },
        },
        checkpoints: {
          orderBy: { arrivedAt: 'asc' },
          select: { id: true, routeCheckpointId: true, streetName: true, arrivedAt: true, completed: true, completedAt: true },
        },
      },
    }),
    prisma.tripTicket.count({ where }),
  ])
  return paginated(data, total, page, limit)
}

export async function listPublicTrips(req) {
  const where = {
    ...(req.query.truckId ? { truckId: req.query.truckId } : {}),
    ...(req.query.from || req.query.to ? { startedAt: {
      ...(req.query.from ? { gte: req.query.from } : {}),
      ...(req.query.to ? { lte: req.query.to } : {}),
    } } : {}),
  }
  return prisma.tripTicket.findMany({
    where,
    take: 100,
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      tripNo: true,
      status: true,
      startedAt: true,
      completedAt: true,
      truck: {
        select: {
          id: true, truckId: true, plateNumber: true, vehicleType: true,
          driverName: true, crew: true, status: true, currentStreet: true,
          admin: { select: { id: true, fullName: true } },
        },
      },
      route: {
        select: {
          id: true, name: true, description: true,
          checkpoints: { orderBy: { sequence: 'asc' }, select: { id: true, sequence: true, streetName: true, latitude: true, longitude: true } },
        },
      },
      checkpoints: {
        orderBy: { arrivedAt: 'asc' },
        select: { id: true, routeCheckpointId: true, streetName: true, arrivedAt: true, completed: true, completedAt: true },
      },
    },
  })
}
