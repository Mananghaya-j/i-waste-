import { Router } from 'express'
import { z } from 'zod'
import * as controller from '../controllers/adminController.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { paginationSchema } from '../utils/pagination.js'
import { adminCreateSchema } from '../validators/auth.js'
import { adminUpdateSchema } from '../validators/admin.js'

const router = Router()
const idParams = z.object({ id: z.string().uuid() })
router.use(authenticate, authorize('ADMIN', 'SUPERADMIN'))
router.get('/dashboard/stats', controller.stats)
router.get('/admins', authorize('SUPERADMIN'), validate({ query: paginationSchema }), controller.listAdmins)
router.post('/admins', authorize('SUPERADMIN'), validate({ body: adminCreateSchema }), controller.createAdmin)
router.patch('/admins/:id', authorize('SUPERADMIN'), validate({ params: idParams, body: adminUpdateSchema }), controller.updateAdmin)
export default router
