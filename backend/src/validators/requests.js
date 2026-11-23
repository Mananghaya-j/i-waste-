import { z } from 'zod'

const contact = z.string().trim().min(7).max(24)
const optionalName = z.string().trim().max(120).optional()
const requestStatus = z.enum(['SUBMITTED', 'UNDER_REVIEW', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'])

export const pickupSchema = z.object({
  fullName: optionalName,
  contactNumber: contact,
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  address: z.string().trim().min(4).max(300),
  category: z.enum(['NORMAL', 'SPECIAL', 'COOKING_OIL']),
  specialWasteType: z.string().trim().max(80).optional(),
  otherWaste: z.string().trim().max(160).optional(),
  oilQuantityLiters: z.coerce.number().positive().max(10000).optional(),
  description: z.string().trim().max(1000).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.category === 'SPECIAL' && !value.specialWasteType) {
    ctx.addIssue({ code: 'custom', path: ['specialWasteType'], message: 'A special waste type is required.' })
  }
  if (value.category === 'SPECIAL' && value.specialWasteType === 'Others' && !value.otherWaste?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['otherWaste'], message: 'Describe the other waste type.' })
  }
  if (value.category === 'COOKING_OIL' && value.oilQuantityLiters === undefined) {
    ctx.addIssue({ code: 'custom', path: ['oilQuantityLiters'], message: 'Oil quantity is required.' })
  }
})

export const treeSchema = z.object({
  fullName: optionalName,
  contactNumber: contact,
  location: z.string().trim().min(4).max(300),
  landClassification: z.enum(['PRIVATE', 'PUBLIC']),
  requestType: z.enum(['CUTTING', 'PRUNING']),
  treeType: z.string().trim().max(80).optional(),
  hazardDescription: z.string().trim().min(8).max(1000),
  denrDocumentReference: z.string().trim().max(160).optional(),
  instructionsAccepted: z.enum(['true', 'false']).transform((value) => value === 'true'),
}).strict()

export const waterwaySchema = z.object({
  fullName: optionalName,
  contactNumber: contact,
  location: z.string().trim().min(4).max(300),
  issueType: z.enum(['Canal or waterway cleaning', 'Drainage cleaning', 'Water waste or clogging']),
  description: z.string().trim().min(8).max(1000),
}).strict()

export const environmentalReportSchema = z.object({
  anonymous: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  fullName: optionalName,
  contactNumber: z.string().trim().max(24).optional(),
  type: z.enum(['ILLEGAL_DUMPING', 'MISSED_COLLECTION', 'OTHER']),
  location: z.string().trim().min(4).max(300),
  description: z.string().trim().min(8).max(1500),
}).strict().superRefine((value, ctx) => {
  if (!value.anonymous && !value.contactNumber) {
    ctx.addIssue({ code: 'custom', path: ['contactNumber'], message: 'Contact number is required for non-anonymous reports.' })
  }
})

export const statusUpdateSchema = z.object({
  status: requestStatus,
  adminNotes: z.string().trim().max(1000).optional(),
  assignedTruckId: z.string().uuid().optional(),
  investigationNotes: z.string().trim().max(1500).optional(),
}).strict()

export const referenceSchema = z.object({ referenceNo: z.string().trim().min(8).max(32) })
