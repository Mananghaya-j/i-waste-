import { Prisma } from '@prisma/client'
import multer from 'multer'
import { ZodError } from 'zod'
import { AppError } from '../utils/errors.js'

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } })
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error)

  let status = error instanceof AppError ? error.status : 500
  let code = error instanceof AppError ? error.code : 'INTERNAL_ERROR'
  let message = error instanceof AppError ? error.message : 'An unexpected error occurred.'

  if (error instanceof ZodError) {
    status = 400
    code = 'VALIDATION_ERROR'
    message = 'Request validation failed.'
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      status = 409
      code = 'CONFLICT'
      message = 'A record with the supplied unique value already exists.'
    } else if (error.code === 'P2025') {
      status = 404
      code = 'NOT_FOUND'
      message = 'Resource not found.'
    }
  } else if (error instanceof multer.MulterError) {
    status = 400
    code = 'UPLOAD_ERROR'
    message = error.code === 'LIMIT_FILE_SIZE' ? 'Uploaded file exceeds the size limit.' : 'Invalid upload.'
  }

  if (status >= 500) console.error({ name: error.name, code: error.code, path: req.path })
  res.status(status).json({ error: { code, message } })
}
