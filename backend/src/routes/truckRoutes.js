import { Router } from 'express'
import { z } from 'zod'
import * as controller from '../controllers/truckController.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { paginationSchema } from '../utils/pagination.js'
import { truckSchema, truckUpdateSchema, routeSchema, tripSchema, tripCheckpointSchema, tripListQuerySchema, publicTripListQuerySchema } from '../validations/trucks.js'

const idParams = z.object({ id: z.string().uuid() })
const codeParams = z.object({ code: z.string().uuid() })
const listQuery = paginationSchema.extend({ status: z.enum(['ACTIVE', 'IDLE', 'MAINTENANCE', 'ROUTE_COMPLETED']).optional() })
const router = Router()

router.get('/', validate({ query: listQuery }), controller.listTrucks)
router.get('/manage', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), validate({ query: listQuery }), controller.listTrucks)
router.get('/qr/:code', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), validate({ params: codeParams }), controller.lookupQr)
router.post('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), validate({ body: truckSchema }), controller.createTruck)
router.put('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), validate({ params: idParams, body: truckUpdateSchema }), controller.updateTruck)

const routesRouter = Router()
routesRouter.get('/', controller.routes)
routesRouter.get('/manage', authenticate, authorize('SUPER_ADMIN'), controller.manageRoutes)
routesRouter.post('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), validate({ body: routeSchema }), controller.saveRoute)
routesRouter.put('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), validate({ params: idParams, body: routeSchema }), controller.saveRoute)

const tripsRouter = Router()
tripsRouter.get('/public', validate({ query: publicTripListQuerySchema }), controller.listPublicTrips)
tripsRouter.post('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), validate({ body: tripSchema }), controller.createTrip)
tripsRouter.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), validate({ query: tripListQuerySchema }), controller.listTrips)
tripsRouter.post('/:id/checkpoints', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), validate({ params: idParams, body: tripCheckpointSchema }), controller.addCheckpoint)
tripsRouter.post('/:id/complete', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), validate({ params: idParams }), controller.completeTrip)
tripsRouter.get('/:id', validate({ params: idParams }), controller.getTrip)

export { routesRouter, tripsRouter }
export default router
