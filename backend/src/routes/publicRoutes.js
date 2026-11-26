import { Router } from 'express'
import * as controller from '../controllers/publicDashboardController.js'

const router = Router()
router.get('/dashboard', controller.stats)
export default router
