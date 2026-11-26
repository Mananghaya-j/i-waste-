import { prisma } from '../database/prisma.js'
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
  recyclables: { model: 'recyclablesRequest', prefix: 'RC', entityType: 'RecyclablesRequest', attachmentField: 'recyclablesRequestId' },
}

const detailInclude = { attachments: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, purpose: true, createdAt: true } } }

function publicTracking(record) {
  return {
    referenceNo: record.referenceNo,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    statusHistory: record.statusHistory.map(({ fromStatus, toStatus, createdAt }) => ({ fromStatus, toStatus, createdAt })),
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
      if (kind === 'environmental') {
        data.fullName = input.anonymous ? null : data.fullName || null
        data.contactNumber = input.anonymous ? null : data.contactNumber || null
        data.email = input.anonymous ? null : data.email || null
        if (input.anonymous) data.requesterId = null
      }

      const record = await tx[config.model].create({
        data: {
          ...data,
          attachments: persisted.length ? { create: persisted.map((file) => ({ ...file, uploadedById: req.user?.id || null })) } : undefined,
        },
        include: detailInclude,
      })
      await tx.requestStatusHistory.create({
        data: { requestKind: kind, referenceNo: record.referenceNo, toStatus: record.status },
      })
      await writeAudit(tx, req, {
        actorId: req.user?.id,
        action: 'REQUEST_CREATED',
        entityType: config.entityType,
        entityId: record.id,
        metadata: { referenceNo: record.referenceNo },
      })
      const admins = await tx.user.findMany({
          where: { role: 'ADMIN', status: 'ACTIVE' },
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
  const managementPermission = kind === 'environmental' ? 'reports:manage' : 'requests:manage'
  const canManage = req.user.role !== 'SUPER_ADMIN' && req.user.permissions.includes(managementPermission)
  if (!canManage) where.requesterId = req.user.id
  const [data, total] = await prisma.$transaction([
    prisma[config.model].findMany({
      where, skip, take, orderBy: { createdAt: 'desc' },
      include: {
        attachments: { select: { id: true, mimeType: true, sizeBytes: true, purpose: true } },
        ...(kind === 'environmental' ? { assignedInvestigator: { select: { id: true, fullName: true } } } : {}),
        ...(kind === 'recyclables' ? { assignedTruck: { select: { id: true, truckId: true } } } : {}),
      },
    }),
    prisma[config.model].count({ where }),
  ])
  return paginated(data, total, page, limit)
}

export async function trackRequest(kind, referenceNo) {
  const config = configurations[kind]
  const record = await prisma[config.model].findUnique({ where: { referenceNo } })
  if (!record) throw notFound('Request reference was not found.')
  const statusHistory = await prisma.requestStatusHistory.findMany({
    where: { referenceNo },
    orderBy: { createdAt: 'asc' },
    select: { fromStatus: true, toStatus: true, createdAt: true },
  })
  return publicTracking({ ...record, statusHistory })
}

export async function trackRequestByReference(referenceNo) {
  const prefix = referenceNo.split('-')[1]
  const kind = { PU: 'pickup', TR: 'tree', WW: 'waterway', ER: 'environmental', RC: 'recyclables' }[prefix]
  if (!kind) throw notFound('Request reference was not found.')
  return trackRequest(kind, referenceNo)
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
  if (input.assignedTruckId && !['pickup', 'recyclables'].includes(kind)) {
    throw new AppError(400, 'Truck assignment is supported only for collection requests.', 'INVALID_ASSIGNMENT')
  }
  if (input.assignedTruckId) {
    const truck = await prisma.truck.findUnique({ where: { id: input.assignedTruckId }, select: { status: true } })
    if (!truck) throw new AppError(400, 'Assigned truck was not found.', 'INVALID_ASSIGNMENT')
    if (truck.status === 'MAINTENANCE') throw new AppError(409, 'Truck is under maintenance.', 'TRUCK_UNAVAILABLE')
  }
  if (input.assignedInvestigatorId && kind !== 'environmental') {
    throw new AppError(400, 'Investigator assignment is supported only for environmental reports.', 'INVALID_ASSIGNMENT')
  }
  if (input.assignedInvestigatorId) {
    const investigator = await prisma.user.findFirst({
      where: { id: input.assignedInvestigatorId, role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true },
    })
    if (!investigator) throw new AppError(400, 'Investigator must be an active admin.', 'INVALID_ASSIGNMENT')
  }
  if (nextStatus === 'COMPLETED' && kind === 'environmental') {
    const assignedInvestigatorId = input.assignedInvestigatorId || current.assignedInvestigatorId
    const activeInvestigator = assignedInvestigatorId && await prisma.user.findFirst({
      where: { id: assignedInvestigatorId, role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true },
    })
    if (!activeInvestigator) throw new AppError(409, 'Assign an active investigator before completing this report.', 'INVESTIGATOR_REQUIRED')
  }
  if (nextStatus === 'COMPLETED' && kind === 'pickup' &&
    !(input.assignedTruckId || current.assignedTruckId)) {
    throw new AppError(409, 'Assign a truck before completing this pickup.', 'TRUCK_ASSIGNMENT_REQUIRED')
  }
  if (nextStatus === 'COMPLETED' && kind === 'recyclables' && current.fulfillment === 'Pickup' &&
    !(input.assignedTruckId || current.assignedTruckId)) {
    throw new AppError(409, 'Assign a truck before completing this pickup.', 'TRUCK_ASSIGNMENT_REQUIRED')
  }
  if (current.status !== 'COMPLETED' && nextStatus === 'COMPLETED' && kind === 'pickup' && input.measuredWasteKg === undefined) {
    throw new AppError(400, 'Enter the measured total collected weight in kilograms before completing this request.', 'MEASUREMENT_REQUIRED')
  }
  if (current.status !== 'COMPLETED' && nextStatus === 'COMPLETED' && kind === 'recyclables' && input.actualCollectedKg === undefined) {
    throw new AppError(400, 'Enter the actual collected weight in kilograms before completing this request.', 'MEASUREMENT_REQUIRED')
  }
  const measuredRecyclablesKg = input.measuredRecyclablesKg ?? 0
  const measuredCompostKg = input.measuredCompostKg ?? 0
  if (kind === 'pickup' && input.measuredWasteKg !== undefined &&
    measuredRecyclablesKg + measuredCompostKg > input.measuredWasteKg) {
    throw new AppError(400, 'Recyclable and compost weights cannot exceed total collected weight.', 'INVALID_MEASUREMENT')
  }

  const persisted = await persistFiles(files)
  try {
    return await prisma.$transaction(async (tx) => {
      const updateData = {
        status: nextStatus,
        adminNotes: input.adminNotes,
        ...(['pickup', 'recyclables'].includes(kind) && input.assignedTruckId ? { assignedTruckId: input.assignedTruckId } : {}),
        ...(kind === 'environmental' && input.investigationNotes ? { investigationNotes: input.investigationNotes } : {}),
        ...(kind === 'environmental' && input.assignedInvestigatorId !== undefined ? { assignedInvestigatorId: input.assignedInvestigatorId } : {}),
        ...(kind === 'pickup' && input.measuredWasteKg !== undefined ? {
          measuredWasteKg: input.measuredWasteKg,
          measuredRecyclablesKg,
          measuredCompostKg,
        } : {}),
        ...(kind === 'recyclables' && input.actualCollectedKg !== undefined ? { actualCollectedKg: input.actualCollectedKg } : {}),
        ...(nextStatus === 'COMPLETED' && current.status !== 'COMPLETED' && ['pickup', 'recyclables'].includes(kind) ? { completedAt: new Date() } : {}),
      }
      const updated = await tx[config.model].updateMany({
        where: { id, status: current.status },
        data: updateData,
      })
      if (updated.count !== 1) throw new AppError(409, 'Request was changed by another administrator. Reload and retry.', 'REQUEST_CHANGED')
      if (persisted.length) {
        await tx.attachment.createMany({
          data: persisted.map((file) => ({
            ...file,
            uploadedById: req.user.id,
            [config.attachmentField]: id,
          })),
        })
      }
      const record = await tx[config.model].findUnique({ where: { id }, include: detailInclude })
      if (current.status !== nextStatus) {
        await tx.requestStatusHistory.create({
          data: {
            requestKind: kind,
            referenceNo: current.referenceNo,
            fromStatus: current.status,
            toStatus: nextStatus,
            actorId: req.user.id,
          },
        })
      }
      await writeAudit(tx, req, {
        action: kind === 'environmental' && input.assignedInvestigatorId !== undefined ? 'REPORT_UPDATED' : 'REQUEST_STATUS_UPDATED',
        entityType: config.entityType,
        entityId: id,
        metadata: {
          from: current.status,
          to: nextStatus,
          referenceNo: current.referenceNo,
          ...(input.assignedInvestigatorId !== undefined ? { assignedInvestigatorId: input.assignedInvestigatorId } : {}),
        },
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
