import { prisma } from '../config/prisma.js'
import { createReference } from '../utils/reference.js'
import { writeAudit } from '../utils/audit.js'
import { persistFiles, removeFiles } from '../utils/attachments.js'
import { AppError, notFound } from '../utils/errors.js'
import { pagination, paginated } from '../utils/pagination.js'

const configurations = {
  pickup: { model: 'pickupRequest', prefix: 'PU', entityType: 'PickupRequest', attachmentField: 'pickupRequestId' },
  tree: { model: 'treeRequest', prefix: 'TR', entityType: 'TreeRequest', attachmentField: 'treeRequestId' },
  waterway: { model: 'waterwayRequest', prefix: 'WW', entityType: 'WaterwayRequest', attachmentField: 'waterwayRequestId' },
  environmental: { model: 'environmentalReport', prefix: 'ER', entityType: 'EnvironmentalReport', attachmentField: 'environmentalReportId' },
}

const detailInclude = { attachments: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, purpose: true, createdAt: true } } }

function publicTracking(record) {
  return {
    referenceNo: record.referenceNo,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    attachments: record.attachments,
  }
}

export async function createRequest(kind, input, req, files = []) {
  const config = configurations[kind]
  if (kind === 'tree' && input.landClassification === 'PRIVATE' &&
    !input.denrDocumentReference && !files.some((file) => file.fieldname === 'denrDocument')) {
    throw new AppError(400, 'DENR approval or Certificate of No Objection is required for private land.', 'DENR_DOCUMENT_REQUIRED')
  }

  const persisted = await persistFiles(files)
  try {
    return await prisma.$transaction(async (tx) => {
      const data = {
        ...input,
        referenceNo: createReference(config.prefix),
        requesterId: req.user?.id || null,
      }
      if (kind === 'pickup') {
        if (input.category !== 'SPECIAL') {
          data.specialWasteType = null
          data.otherWaste = null
        }
        if (input.category !== 'COOKING_OIL') data.oilQuantityLiters = null
        if (!data.email) data.email = null
      }
      if (kind === 'environmental' && input.anonymous) {
        data.fullName = null
        data.contactNumber = null
        data.requesterId = null
      }

      const record = await tx[config.model].create({
        data: {
          ...data,
          attachments: persisted.length ? { create: persisted.map((file) => ({ ...file, uploadedById: req.user?.id || null })) } : undefined,
        },
        include: detailInclude,
      })
      await writeAudit(tx, req, {
        actorId: req.user?.id,
        action: 'REQUEST_CREATED',
        entityType: config.entityType,
        entityId: record.id,
        metadata: { referenceNo: record.referenceNo },
      })
      const admins = await tx.user.findMany({
          where: { role: { in: ['ADMIN', 'SUPERADMIN'] }, status: 'ACTIVE' },
          select: { id: true },
        })
      if (admins.length) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            type: 'ADMIN_ALERT',
            title: 'New service request',
            message: `New ${config.entityType.toLowerCase()} ${record.referenceNo} was submitted.`,
            entityType: config.entityType,
            entityId: record.id,
          })),
        })
      }
      return record
    })
  } catch (error) {
    await removeFiles(persisted)
    throw error
  }
}

export async function listRequests(kind, req) {
  const config = configurations[kind]
  const { skip, take, page, limit } = pagination(req.query)
  const where = {}
  if (req.query.status) where.status = req.query.status
  if (!['ADMIN', 'SUPERADMIN'].includes(req.user.role)) where.requesterId = req.user.id
  const [data, total] = await prisma.$transaction([
    prisma[config.model].findMany({
      where, skip, take, orderBy: { createdAt: 'desc' },
      include: { attachments: { select: { id: true, mimeType: true, sizeBytes: true, purpose: true } } },
    }),
    prisma[config.model].count({ where }),
  ])
  return paginated(data, total, page, limit)
}

export async function trackRequest(kind, referenceNo) {
  const config = configurations[kind]
  const record = await prisma[config.model].findUnique({ where: { referenceNo }, include: detailInclude })
  if (!record) throw notFound('Request reference was not found.')
  return publicTracking(record)
}

export async function updateRequestStatus(kind, id, input, req, files = []) {
  const config = configurations[kind]
  const current = await prisma[config.model].findUnique({ where: { id } })
  if (!current) throw notFound()
  const nextStatus = input.status
  const transitions = {
    SUBMITTED: ['UNDER_REVIEW', 'REJECTED'],
    UNDER_REVIEW: ['SCHEDULED', 'IN_PROGRESS', 'REJECTED'],
    SCHEDULED: ['IN_PROGRESS', 'REJECTED'],
    IN_PROGRESS: ['COMPLETED', 'REJECTED'],
    COMPLETED: [],
    REJECTED: ['UNDER_REVIEW'],
  }
  if (current.status !== nextStatus && !transitions[current.status].includes(nextStatus)) {
    throw new AppError(409, `Cannot change request from ${current.status} to ${nextStatus}.`, 'INVALID_STATUS_TRANSITION')
  }
  if (input.assignedTruckId && kind !== 'pickup') {
    throw new AppError(400, 'Truck assignment is supported only for pickup requests.', 'INVALID_ASSIGNMENT')
  }
  if (input.assignedTruckId) {
    const truck = await prisma.truck.findUnique({ where: { id: input.assignedTruckId }, select: { status: true } })
    if (!truck) throw new AppError(400, 'Assigned truck was not found.', 'INVALID_ASSIGNMENT')
    if (truck.status === 'MAINTENANCE') throw new AppError(409, 'Truck is under maintenance.', 'TRUCK_UNAVAILABLE')
  }

  const persisted = await persistFiles(files)
  try {
    return await prisma.$transaction(async (tx) => {
      const updateData = {
        status: nextStatus,
        adminNotes: input.adminNotes,
        ...(kind === 'pickup' && input.assignedTruckId ? { assignedTruckId: input.assignedTruckId } : {}),
        ...(kind === 'environmental' && input.investigationNotes ? { investigationNotes: input.investigationNotes } : {}),
      }
      const record = await tx[config.model].update({
        where: { id },
        data: {
          ...updateData,
          attachments: persisted.length ? { create: persisted.map((file) => ({ ...file, uploadedById: req.user.id })) } : undefined,
        },
        include: detailInclude,
      })
      await writeAudit(tx, req, {
        action: 'REQUEST_STATUS_UPDATED',
        entityType: config.entityType,
        entityId: id,
        metadata: { from: current.status, to: nextStatus, referenceNo: current.referenceNo },
      })
      if (current.requesterId) {
        await tx.notification.create({
          data: {
            userId: current.requesterId,
            type: nextStatus === 'COMPLETED' ? 'COMPLETION' : 'REQUEST_UPDATE',
            title: nextStatus === 'COMPLETED' ? 'Request completed' : 'Request status updated',
            message: `Request ${current.referenceNo} is now ${nextStatus.replaceAll('_', ' ').toLowerCase()}.`,
            entityType: config.entityType,
            entityId: current.id,
          },
        })
      }
      return record
    })
  } catch (error) {
    await removeFiles(persisted)
    throw error
  }
}

export const requestKinds = Object.keys(configurations)
