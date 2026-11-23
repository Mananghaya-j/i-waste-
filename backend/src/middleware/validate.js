import { AppError } from '../utils/errors.js'

export function validate({ body, params, query }) {
  return (req, res, next) => {
    for (const [part, schema] of Object.entries({ body, params, query })) {
      if (!schema) continue
      const result = schema.safeParse(req[part])
      if (!result.success) {
        return next(new AppError(400, 'Request validation failed.', 'VALIDATION_ERROR'))
      }
      Object.defineProperty(req, part, { value: result.data, writable: true, configurable: true })
    }
    return next()
  }
}
