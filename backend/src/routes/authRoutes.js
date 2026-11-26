import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as controller from '../controllers/authController.js'
import { authenticate } from '../middleware/auth.js'
import { requireTrustedOrigin } from '../middleware/csrf.js'
import { upload, validateFileSignatures } from '../middleware/upload.js'
import { validate } from '../middleware/validate.js'
import { registerSchema, loginSchema, changePasswordSchema, resetPasswordSchema, verifyEmailSchema, updateProfileSchema } from '../validations/auth.js'

const router = Router()
const credentialLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false })
const refreshLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false })

router.post('/register', credentialLimiter, validate({ body: registerSchema }), controller.register)
router.post('/guest', controller.guest)
router.post('/login', requireTrustedOrigin, credentialLimiter, validate({ body: loginSchema }), controller.login)
router.post('/admin/login', requireTrustedOrigin, credentialLimiter, validate({ body: loginSchema }), controller.loginAdmin)
router.post('/refresh', requireTrustedOrigin, refreshLimiter, controller.refresh)
router.post('/logout', requireTrustedOrigin, controller.logout)
router.post('/password/change', authenticate, validate({ body: changePasswordSchema }), controller.changePassword)
router.post('/password/reset', credentialLimiter, validate({ body: resetPasswordSchema }), controller.preparePasswordReset)
router.post('/email/verify', credentialLimiter, validate({ body: verifyEmailSchema }), controller.verifyEmail)
router.get('/profile', authenticate, controller.getProfile)
router.patch('/profile', authenticate, validate({ body: updateProfileSchema }), controller.updateProfile)
router.get('/profile/photo', authenticate, controller.getProfilePhoto)
router.put('/profile/photo', authenticate, upload.single('profilePhoto'), validateFileSignatures, controller.updateProfilePhoto)

export default router
