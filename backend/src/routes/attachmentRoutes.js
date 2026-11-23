import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { download } from '../controllers/attachmentController.js'

const router = Router()
router.get('/:id', authenticate, validate({ params: z.object({ id: z.string().uuid() }) }), download)
export default router
