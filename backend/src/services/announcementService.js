import { prisma } from '../database/prisma.js'
import { writeAudit } from '../utils/audit.js'
import { notFound } from '../utils/errors.js'
import { pagination, paginated } from '../utils/pagination.js'

export async function listPublicAnnouncements(req) {
  const announcements = await prisma.announcement.findMany({
    where: { publishedAt: { lte: new Date() } },
    orderBy: [{ startsAt: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: 100,
    select: {
      id: true,
      title: true,
      body: true,
      category: true,
      publishedAt: true,
      startsAt: true,
      location: true,
      _count: { select: { rsvps: true } },
      ...(req.user ? { rsvps: { where: { userId: req.user.id }, select: { id: true } } } : {}),
    },
  })
  return announcements.map(({ _count, rsvps, ...announcement }) => ({
    ...announcement,
    rsvpCount: _count.rsvps,
    joined: Boolean(rsvps?.length),
  }))
}

export async function listAnnouncements(req) {
  const { skip, take, page, limit } = pagination(req.query)
  const [data, total] = await prisma.$transaction([
    prisma.announcement.findMany({ skip, take, orderBy: { createdAt: 'desc' }, include: { _count: { select: { rsvps: true } } } }),
    prisma.announcement.count(),
  ])
  return paginated(data, total, page, limit)
}

export async function createAnnouncement(input, req) {
  return prisma.$transaction(async (tx) => {
    const announcement = await tx.announcement.create({
      data: { ...input, createdById: req.user.id },
    })
    await writeAudit(tx, req, {
      action: 'ANNOUNCEMENT_CREATED',
      entityType: 'Announcement',
      entityId: announcement.id,
    })
    return announcement
  })
}

export async function updateAnnouncement(id, input, req) {
  const current = await prisma.announcement.findUnique({ where: { id }, select: { id: true } })
  if (!current) throw notFound('Announcement not found.')
  return prisma.$transaction(async (tx) => {
    const announcement = await tx.announcement.update({ where: { id }, data: input })
    await writeAudit(tx, req, {
      action: 'ANNOUNCEMENT_UPDATED',
      entityType: 'Announcement',
      entityId: id,
    })
    return announcement
  })
}

export async function deleteAnnouncement(id, req) {
  const current = await prisma.announcement.findUnique({ where: { id }, select: { id: true } })
  if (!current) throw notFound('Announcement not found.')
  await prisma.$transaction(async (tx) => {
    await tx.announcement.delete({ where: { id } })
    await writeAudit(tx, req, {
      action: 'ANNOUNCEMENT_DELETED',
      entityType: 'Announcement',
      entityId: id,
    })
  })
}

export async function rsvpCommunityEvent(id, req) {
  const announcement = await prisma.announcement.findFirst({
    where: {
      id,
      publishedAt: { lte: new Date() },
      category: { in: ['COMMUNITY_EVENT', 'ACTIVITY_SCHEDULE'] },
    },
    select: { id: true },
  })
  if (!announcement) throw notFound('Published community event was not found.')
  return prisma.$transaction(async (tx) => {
    const rsvp = await tx.eventRsvp.upsert({
      where: { announcementId_userId: { announcementId: id, userId: req.user.id } },
      create: { announcementId: id, userId: req.user.id },
      update: {},
    })
    await writeAudit(tx, req, {
      action: 'COMMUNITY_EVENT_RSVP',
      entityType: 'Announcement',
      entityId: id,
    })
    return rsvp
  })
}
