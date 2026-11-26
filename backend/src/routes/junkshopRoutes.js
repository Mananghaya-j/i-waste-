import { Router } from 'express'
import * as controller from '../controllers/junkshopController.js'
import { authenticate, requirePermissionOrSuperAdmin } from '../middleware/auth.js'
import { upload, validateFileSignatures } from '../middleware/upload.js'
import { validate } from '../middleware/validate.js'
import { paginationSchema } from '../utils/pagination.js'
import { junkshopReportSchema, junkshopSchema } from '../validations/junkshop.js'

const access = [authenticate, requirePermissionOrSuperAdmin('reports:manage')]
const shops = Router()
shops.get('/', ...access, controller.listJunkshops)
shops.post('/', ...access, validate({ body: junkshopSchema }), controller.createJunkshop)

const reports = Router()
reports.get('/', ...access, validate({ query: paginationSchema }), controller.listJunkshopReports)
reports.post(
  '/',
  ...access,
  upload.fields([{ name: 'supportingDocuments', maxCount: 5 }]),
  validateFileSignatures,
  validate({ body: junkshopReportSchema }),
  controller.createJunkshopReport,
)

export default { shops, reports }
