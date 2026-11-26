import { z } from 'zod'

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  contactNumber: z.string().trim().min(7).max(24).optional(),
  password: z.string().min(12).max(128),
}).strict()

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict()

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
}).strict()

export const resetPasswordSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
}).strict()

export const verifyEmailSchema = z.object({
  token: z.string().min(20).max(128),
}).strict()

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  contactNumber: z.preprocess(
    (value) => value === '' ? null : value,
    z.string().trim().min(7).max(24).nullable(),
  ).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'Provide at least one profile field to update.',
})

export const adminCreateSchema = registerSchema.extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
}).strict()
