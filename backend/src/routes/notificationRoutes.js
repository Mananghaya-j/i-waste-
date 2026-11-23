import { Router } from 'express'
import { z } from 'zod'
import * as controller from '../controllers/notificationController.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { paginationSchema } from '../utils/pagination.js'

const router = Router()
router.use(authenticate)
router.get('/', validate({ query: paginationSchema }), controller.list)
router.patch('/:id/read', validate({ params: z.object({ id: z.string().uuid() }) }), controller.markRead)
export default router
