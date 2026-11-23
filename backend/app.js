import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { env } from './src/config/env.js'
import { AppError } from './src/utils/errors.js'
import { isAllowedOrigin } from './src/utils/corsOrigin.js'
import { errorHandler, notFoundHandler } from './src/middleware/errorHandler.js'
import authRoutes from './src/routes/authRoutes.js'
import truckRoutes, { routesRouter, tripsRouter } from './src/routes/truckRoutes.js'
import { createRequestRouter } from './src/routes/requestRoutes.js'
import adminRoutes from './src/routes/adminRoutes.js'
import notificationRoutes from './src/routes/notificationRoutes.js'
import attachmentRoutes from './src/routes/attachmentRoutes.js'
import reportRoutes from './src/routes/reportRoutes.js'

const app = express()

app.disable('x-powered-by')
if (env.TRUST_PROXY_HOPS > 0) app.set('trust proxy', env.TRUST_PROXY_HOPS)
app.use(helmet())
app.use(cors({
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin, env.FRONTEND_ORIGINS, env.NODE_ENV)) return callback(null, true)
    return callback(new AppError(403, 'Origin is not allowed by CORS.', 'CORS_ORIGIN_DENIED'))
  },
  credentials: true,
}))
app.use(express.json({ limit: '32kb' }))
app.use(express.urlencoded({ extended: false, limit: '32kb' }))
app.use(cookieParser())
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
}))

app.get('/health', (req, res) => res.json({ status: 'ok' }))
app.use('/api/auth', authRoutes)
app.use('/api/trucks', truckRoutes)
app.use('/api/routes', routesRouter)
app.use('/api/trips', tripsRouter)
app.use('/api/pickup-requests', createRequestRouter('pickup-requests'))
app.use('/api/tree-requests', createRequestRouter('tree-requests'))
app.use('/api/waterway-requests', createRequestRouter('waterway-requests'))
app.use('/api/environmental-reports', createRequestRouter('environmental-reports'))
app.use('/api/notifications', notificationRoutes)
app.use('/api/attachments', attachmentRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api', adminRoutes)
app.use(notFoundHandler)
app.use(errorHandler)

export default app
