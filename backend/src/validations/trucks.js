import { z } from 'zod'

const checkpoint = z.object({
  sequence: z.coerce.number().int().min(1),
  streetName: z.string().trim().min(2).max(160),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
}).strict()

export const truckSchema = z.object({
  truckId: z.string().trim().min(2).max(32),
  plateNumber: z.string().trim().min(2).max(20),
  vehicleType: z.string().trim().min(2).max(80),
  capacityKg: z.coerce.number().positive().max(100000).optional(),
  driverName: z.string().trim().max(120).optional(),
  crew: z.string().trim().max(500).optional(),
  adminId: z.string().uuid().optional(),
}).strict()

export const truckUpdateSchema = truckSchema.partial().extend({
  status: z.enum(['ACTIVE', 'IDLE', 'MAINTENANCE', 'ROUTE_COMPLETED']).optional(),
  capacityKg: z.coerce.number().positive().max(100000).nullable().optional(),
  driverName: z.string().trim().max(120).nullable().optional(),
  crew: z.string().trim().max(500).nullable().optional(),
  adminId: z.string().uuid().nullable().optional(),
}).strict()

export const routeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  checkpoints: z.array(checkpoint).max(200).default([]),
}).strict().superRefine((value, ctx) => {
  const sequences = value.checkpoints.map((item) => item.sequence)
  if (new Set(sequences).size !== sequences.length) {
    ctx.addIssue({ code: 'custom', path: ['checkpoints'], message: 'Checkpoint sequence values must be unique.' })
  }
  value.checkpoints.forEach((item, index) => {
    if ((item.latitude === undefined) !== (item.longitude === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['checkpoints', index, 'latitude'],
        message: 'Provide both coordinates or leave both empty.',
      })
    }
  })
})

export const tripSchema = z.object({
  truckId: z.string().uuid(),
  routeId: z.string().uuid().optional(),
}).strict()

export const tripCheckpointSchema = z.object({
  streetName: z.string().trim().min(2).max(160),
  completed: z.coerce.boolean().default(false),
}).strict()

export const truckStatusSchema = z.object({ status: z.enum(['ACTIVE', 'IDLE', 'MAINTENANCE', 'ROUTE_COMPLETED']) }).strict()

export const tripListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  truckId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).strict().superRefine((query, ctx) => {
  if (query.from && query.to && query.from > query.to) {
    ctx.addIssue({ code: 'custom', path: ['from'], message: 'The start date must be before the end date.' })
  }
})

export const publicTripListQuerySchema = z.object({
  truckId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).strict().superRefine((query, ctx) => {
  if (query.from && query.to && query.from > query.to) {
    ctx.addIssue({ code: 'custom', path: ['from'], message: 'The start date must be before the end date.' })
  }
})
