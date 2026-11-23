import { z } from 'zod'

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export function pagination(query) {
  const { page, limit } = paginationSchema.parse(query)
  return { skip: (page - 1) * limit, take: limit, page, limit }
}

export function paginated(data, total, page, limit) {
  return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }
}
