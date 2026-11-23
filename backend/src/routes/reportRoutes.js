import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { exportReport } from '../controllers/reportController.js'

const router = Router()
router.get('/export', authenticate, authorize('ADMIN', 'SUPERADMIN'), validate({
  query: z.object({
    type: z.enum(['pickup', 'land', 'water', 'environmental', 'trips']),
    format: z.enum(['csv', 'xlsx', 'pdf']).default('csv'),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  }).strict().superRefine((query, ctx) => {
    if (query.from && query.to && query.from > query.to) {
      ctx.addIssue({ code: 'custom', path: ['from'], message: 'The start date must be before the end date.' })
    }
  }),
}), exportReport)
export default router
