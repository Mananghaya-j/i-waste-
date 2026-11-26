import multer from 'multer'
import path from 'node:path'
import { env } from '../config/env.js'
import { AppError } from '../utils/errors.js'

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
const extensionByMime = new Map([
  ['image/jpeg', new Set(['.jpg', '.jpeg'])],
  ['image/png', new Set(['.png'])],
  ['image/webp', new Set(['.webp'])],
  ['application/pdf', new Set(['.pdf'])],
])

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 5 },
  fileFilter(req, file, callback) {
    const isPdfField = ['denrDocument', 'supportingDocuments'].includes(file.fieldname)
    const extension = path.extname(file.originalname).toLowerCase()
    if (!allowedMimeTypes.has(file.mimetype)
      || (file.mimetype === 'application/pdf' && !isPdfField)
      || !extensionByMime.get(file.mimetype)?.has(extension)) {
      callback(new AppError(400, 'Only JPG, PNG, WebP, or PDF attachments are accepted.', 'INVALID_FILE_TYPE'))
      return
    }
    callback(null, true)
  },
})

export function validateFileSignatures(req, res, next) {
  const files = req.files ? Object.values(req.files).flat() : req.file ? [req.file] : []
  for (const file of files) {
    const bytes = file.buffer
    const valid =
      (file.mimetype === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
      (file.mimetype === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (file.mimetype === 'image/webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') ||
      (file.mimetype === 'application/pdf' && bytes.toString('ascii', 0, 5) === '%PDF-')
    if (!valid) return next(new AppError(400, 'File content does not match an allowed file type.', 'INVALID_FILE_CONTENT'))
  }
  return next()
}
