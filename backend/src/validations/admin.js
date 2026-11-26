import { z } from 'zod'

export const adminUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  contactNumber: z.string().trim().min(7).max(24).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
}).strict()
