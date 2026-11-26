import { Router } from 'express'
import * as controller from '../controllers/requestController.js'
import { validate } from '../middleware/validate.js'
import { referenceSchema } from '../validations/requests.js'

const router = Router()
router.get('/track/:referenceNo', validate({ params: referenceSchema }), controller.trackByReference)
export default router
