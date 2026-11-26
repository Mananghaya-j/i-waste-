import { Router } from 'express'
import { z } from 'zod'
import * as controller from '../controllers/adminController.js'
import { authenticate, authorize, requirePermission } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { paginationSchema } from '../utils/pagination.js'

const router = Router()
const idParams = z.object({ id: z.string().uuid() })
const roleSchema = z.object({ role: z.enum(['RESIDENT', 'ADMIN']) }).strict()

router.use(authenticate)
router.get('/dashboard/stats', authorize('ADMIN', 'SUPER_ADMIN'), controller.stats)
router.get('/investigators', requirePermission('reports:manage'), controller.listInvestigators)
router.get('/users/roles', authorize('SUPER_ADMIN'), validate({ query: paginationSchema }), controller.listRoleUsers)
router.patch('/users/:id/role', authorize('SUPER_ADMIN'), validate({ params: idParams, body: roleSchema }), controller.updateUserRole)

export default router
