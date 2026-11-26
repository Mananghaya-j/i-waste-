import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requirePermissionOrSuperAdmin } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import * as controller from '../controllers/reportController.js'

const router = Router()
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
const filters = {
  month: monthSchema,
  truckId: z.string().uuid().optional(),
  household: z.string().trim().min(1).max(300).optional(),
}

router.get('/volumes', authenticate, requirePermissionOrSuperAdmin('reports:manage'), validate({
  query: z.object(filters).strict(),
}), controller.volumes)

router.get('/export', authenticate, requirePermissionOrSuperAdmin('reports:manage'), validate({
  query: z.object({
    type: z.enum(['pickup', 'land', 'water', 'environmental', 'trips', 'volumes']),
    format: z.enum(['csv', 'xlsx', 'pdf']).default('csv'),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    month: monthSchema.optional(),
    truckId: z.string().uuid().optional(),
    household: z.string().trim().min(1).max(300).optional(),
  }).strict().superRefine((query, ctx) => {
    if (query.type === 'volumes' && !query.month) {
      ctx.addIssue({ code: 'custom', path: ['month'], message: 'Select a month for the volume report.' })
    }
    if (query.type !== 'volumes' && (query.month || query.truckId || query.household)) {
      ctx.addIssue({ code: 'custom', path: ['month'], message: 'Volume filters are supported only for volume reports.' })
    }
    if (query.from && query.to && query.from > query.to) {
      ctx.addIssue({ code: 'custom', path: ['from'], message: 'The start date must be before the end date.' })
    }
  }),
}), controller.exportReport)
export default router
