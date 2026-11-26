import { Router } from 'express'
import { z } from 'zod'
import * as controller from '../controllers/requestController.js'
import { authenticate, authorize, requirePermission } from '../middleware/auth.js'
import { optionalAuth } from '../middleware/optionalAuth.js'
import { upload, validateFileSignatures } from '../middleware/upload.js'
import { validate } from '../middleware/validate.js'
import { paginationSchema } from '../utils/pagination.js'
import { referenceSchema, pickupSchema, treeSchema, waterwaySchema, environmentalReportSchema, recyclablesSchema, statusUpdateSchema } from '../validations/requests.js'

const definitions = {
  'pickup-requests': ['pickup', pickupSchema, [{ name: 'photo', maxCount: 1 }, { name: 'attachments', maxCount: 4 }]],
  'tree-requests': ['tree', treeSchema, [{ name: 'photo', maxCount: 1 }, { name: 'denrDocument', maxCount: 1 }, { name: 'proofOfCompletion', maxCount: 3 }]],
  'waterway-requests': ['waterway', waterwaySchema, [{ name: 'photo', maxCount: 1 }, { name: 'proofOfCompletion', maxCount: 3 }]],
  'environmental-reports': ['environmental', environmentalReportSchema, [{ name: 'photo', maxCount: 1 }, { name: 'attachments', maxCount: 4 }]],
  'recyclables-requests': ['recyclables', recyclablesSchema, [{ name: 'photos', maxCount: 5 }]],
}

const idSchema = z.object({ id: z.string().uuid() })
const querySchema = paginationSchema.extend({ status: z.enum(['SUBMITTED', 'UNDER_REVIEW', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED']).optional() })

export function createRequestRouter(path) {
  const [kind, bodySchema, fields] = definitions[path]
  const router = Router()
  router.post('/', optionalAuth, upload.fields(fields), validateFileSignatures, validate({ body: bodySchema }), (req, res) => controller.create(kind, req, res))
  router.get('/track/:referenceNo', validate({ params: referenceSchema }), (req, res) => controller.track(kind, req, res))
  router.get('/', authenticate, authorize('RESIDENT', 'ADMIN'), validate({ query: querySchema }), (req, res) => controller.list(kind, req, res))
  router.patch('/:id/status', authenticate, requirePermission('requests:update_status'), upload.fields([{ name: 'proofOfCompletion', maxCount: 5 }]), validateFileSignatures, validate({ params: idSchema, body: statusUpdateSchema }), (req, res) => controller.updateStatus(kind, req, res))
  return router
}
