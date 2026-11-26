import { z } from 'zod'

const hasControlCharacters = (value) => Array.from(value).some((character) => {
  const code = character.charCodeAt(0)
  return code <= 31 || code === 127
})

const safeText = (minimum, maximum) => z.string()
  .trim()
  .min(minimum)
  .max(maximum)
  .refine((value) => !hasControlCharacters(value))

const phone = z.string()
  .trim()
  .max(24)
  .refine((value) => !value || /^[+0-9(). -]{7,24}$/.test(value))
  .optional()

const quantityUnits = ['PIECE', 'KG', 'BAG', 'CRATE', 'OTHER']
const materialCategories = ['PLASTIC', 'PAPER', 'METAL', 'GLASS', 'ELECTRONICS', 'BATTERY', 'TEXTILE', 'OTHER']

const materialEntry = z.object({
  category: z.enum(materialCategories),
  otherMaterial: z.string().trim().max(80).refine((value) => !hasControlCharacters(value)).optional(),
  quantity: z.coerce.number().finite().positive().max(99999999.99),
  unit: z.enum(quantityUnits),
  otherUnit: z.string().trim().max(20).refine((value) => !hasControlCharacters(value)).optional(),
  weightKg: z.coerce.number().finite().positive().max(99999999.99),
  volumeM3: z.coerce.number().finite().min(0).max(9999999.999),
}).strict().superRefine((entry, context) => {
  if (entry.category === 'OTHER' && !entry.otherMaterial) {
    context.addIssue({ code: 'custom', path: ['otherMaterial'], message: 'Specify the material category.' })
  }
  if (entry.unit === 'OTHER' && !entry.otherUnit) {
    context.addIssue({ code: 'custom', path: ['otherUnit'], message: 'Specify the quantity unit.' })
  }
})

const materialsJson = z.string().transform((value, context) => {
  try {
    return JSON.parse(value)
  } catch {
    context.addIssue({ code: 'custom', message: 'Material entries must be valid JSON.' })
    return z.NEVER
  }
}).pipe(z.array(materialEntry).min(1).max(20))

export const junkshopSchema = z.object({
  name: safeText(2, 160),
  accreditationNumber: safeText(2, 80).refine((value) => /^[A-Za-z0-9][A-Za-z0-9./_-]*$/.test(value)),
  address: safeText(4, 300),
  contactPerson: safeText(2, 120).optional(),
  contactNumber: phone,
}).strict()

export const junkshopReportSchema = z.object({
  junkshopId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  truckId: z.string().uuid().optional(),
  householdAddress: safeText(4, 300).optional(),
  notes: safeText(1, 1000).optional(),
  materials: materialsJson,
}).strict()
