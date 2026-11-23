import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as controller from '../controllers/authController.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { registerSchema, loginSchema, changePasswordSchema, resetPasswordSchema } from '../validators/auth.js'

const router = Router()
const credentialLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false })
const refreshLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false })

router.post('/register', credentialLimiter, validate({ body: registerSchema }), controller.register)
router.post('/guest', controller.guest)
router.post('/login', credentialLimiter, validate({ body: loginSchema }), controller.login)
router.post('/refresh', refreshLimiter, controller.refresh)
router.post('/logout', controller.logout)
router.post('/password/change', authenticate, validate({ body: changePasswordSchema }), controller.changePassword)
router.post('/password/reset', credentialLimiter, validate({ body: resetPasswordSchema }), controller.preparePasswordReset)

export default router
