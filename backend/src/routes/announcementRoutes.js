import { Router } from 'express'
import { z } from 'zod'
import * as controller from '../controllers/announcementController.js'
import { authenticate, authorize, requirePermission } from '../middleware/auth.js'
import { optionalAuth } from '../middleware/optionalAuth.js'
import { validate } from '../middleware/validate.js'
import { paginationSchema } from '../utils/pagination.js'

const router = Router()
const idParams = z.object({ id: z.string().uuid() })
const contentFields = {
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(4000),
  category: z.enum(['COMMUNITY_EVENT', 'GREETING', 'ANNOUNCEMENT', 'ACTIVITY_SCHEDULE', 'MEMO', 'CITY_ORDINANCE', 'BARANGAY_ORDINANCE', 'RA_9003']),
  publishedAt: z.coerce.date().nullable().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  location: z.string().trim().max(300).nullable().optional(),
}
const createSchema = z.object(contentFields).strict()
const updateSchema = createSchema.partial().refine((input) => Object.keys(input).length > 0)

router.get('/', optionalAuth, controller.listPublic)
router.post('/:id/rsvp', authenticate, authorize('RESIDENT'), validate({ params: idParams }), controller.rsvp)
router.get('/manage', authenticate, requirePermission('announcements:manage'), validate({ query: paginationSchema }), controller.list)
router.post('/', authenticate, requirePermission('announcements:manage'), validate({ body: createSchema }), controller.create)
router.patch('/:id', authenticate, requirePermission('announcements:manage'), validate({ params: idParams, body: updateSchema }), controller.update)
router.delete('/:id', authenticate, requirePermission('announcements:manage'), validate({ params: idParams }), controller.remove)

export default router
