import path from 'node:path'
import { prisma } from '../config/prisma.js'
import { uploadDirectory } from '../utils/attachments.js'
import { AppError, notFound } from '../utils/errors.js'
import { writeAudit } from '../utils/audit.js'

export async function download(req, res, next) {
  const attachment = await prisma.attachment.findUnique({
    where: { id: req.params.id },
    include: {
      pickupRequest: { select: { requesterId: true } },
      treeRequest: { select: { requesterId: true } },
      waterwayRequest: { select: { requesterId: true } },
      environmentalReport: { select: { requesterId: true, anonymous: true } },
    },
  })
  if (!attachment) throw notFound('Attachment not found.')
  const admin = ['ADMIN', 'SUPERADMIN'].includes(req.user.role)
  const ownerId = attachment.pickupRequest?.requesterId
    || attachment.treeRequest?.requesterId
    || attachment.waterwayRequest?.requesterId
    || attachment.environmentalReport?.requesterId
  if (!admin && ownerId !== req.user.id) throw new AppError(403, 'You cannot access this attachment.', 'FORBIDDEN')

  await prisma.$transaction(async (tx) => {
    await writeAudit(tx, req, { action: 'ATTACHMENT_DOWNLOADED', entityType: 'Attachment', entityId: attachment.id })
  })
  const filePath = path.join(uploadDirectory, path.basename(attachment.storageKey))
  res.download(filePath, attachment.originalName, (error) => {
    if (error && !res.headersSent) next(error)
  })
}
