import { prisma } from '../database/prisma.js'
import { writeAudit } from '../utils/audit.js'
import { persistFiles, removeFiles } from '../utils/attachments.js'
import { AppError } from '../utils/errors.js'
import { pagination, paginated } from '../utils/pagination.js'
import { createReference } from '../utils/reference.js'

const reportInclude = {
  junkshop: { select: { id: true, name: true, accreditationNumber: true } },
  truck: { select: { id: true, truckId: true, plateNumber: true } },
  materials: { orderBy: { category: 'asc' } },
  attachments: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true } },
}

export async function listJunkshops() {
  return prisma.junkshop.findMany({
    where: { isActive: true },
    select: { id: true, name: true, accreditationNumber: true, address: true, contactPerson: true, contactNumber: true },
    orderBy: { name: 'asc' },
  })
}

export async function createJunkshop(input, req) {
  try {
    return await prisma.$transaction(async (tx) => {
      const junkshop = await tx.junkshop.create({ data: input })
      await writeAudit(tx, req, {
        action: 'JUNKSHOP_CREATED',
        entityType: 'Junkshop',
        entityId: junkshop.id,
        metadata: { accreditationNumber: junkshop.accreditationNumber },
      })
      return junkshop
    })
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError(409, 'That junkshop accreditation number is already registered.', 'JUNKSHOP_ALREADY_EXISTS')
    }
    throw error
  }
}

export async function listJunkshopReports(query) {
  const { skip, take, page, limit } = pagination(query)
  const [data, total] = await prisma.$transaction([
    prisma.junkshopMonthlyReport.findMany({
      skip,
      take,
      orderBy: [{ reportMonth: 'desc' }, { createdAt: 'desc' }],
      include: reportInclude,
    }),
    prisma.junkshopMonthlyReport.count(),
  ])
  return paginated(data, total, page, limit)
}

export async function createJunkshopReport(input, files, req) {
  if (!files.length) {
    throw new AppError(400, 'Attach at least one supporting receipt or document.', 'RECEIPT_REQUIRED')
  }
  const [junkshop, truck] = await Promise.all([
    prisma.junkshop.findFirst({ where: { id: input.junkshopId, isActive: true }, select: { id: true } }),
    input.truckId ? prisma.truck.findUnique({ where: { id: input.truckId }, select: { id: true } }) : null,
  ])
  if (!junkshop) throw new AppError(400, 'Choose an active accredited junkshop.', 'INVALID_JUNKSHOP')
  if (input.truckId && !truck) throw new AppError(400, 'The selected truck was not found.', 'INVALID_TRUCK')

  const persisted = await persistFiles(files)
  try {
    return await prisma.$transaction(async (tx) => {
      const report = await tx.junkshopMonthlyReport.create({
        data: {
          referenceNo: createReference('JS'),
          junkshopId: input.junkshopId,
          reportMonth: new Date(`${input.month}-01T00:00:00.000Z`),
          truckId: input.truckId || null,
          householdAddress: input.householdAddress || null,
          notes: input.notes || null,
          createdById: req.user.id,
          materials: {
            create: input.materials.map((entry) => ({
              category: entry.category,
              otherMaterial: entry.otherMaterial || null,
              quantity: entry.quantity,
              unit: entry.unit,
              otherUnit: entry.otherUnit || null,
              weightKg: entry.weightKg,
              volumeM3: entry.volumeM3,
            })),
          },
          attachments: {
            create: persisted.map((file) => ({ ...file, uploadedById: req.user.id })),
          },
        },
        include: reportInclude,
      })
      const totalWeightKg = input.materials.reduce((sum, entry) => sum + entry.weightKg, 0)
      const totalVolumeM3 = input.materials.reduce((sum, entry) => sum + entry.volumeM3, 0)
      await writeAudit(tx, req, {
        action: 'JUNKSHOP_REPORT_CREATED',
        entityType: 'JunkshopMonthlyReport',
        entityId: report.id,
        metadata: {
          referenceNo: report.referenceNo,
          month: input.month,
          materialCount: input.materials.length,
          totalWeightKg,
          totalVolumeM3,
          attachmentCount: persisted.length,
        },
      })
      return report
    })
  } catch (error) {
    await removeFiles(persisted)
    throw error
  }
}
