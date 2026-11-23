export class AppError extends Error {
  constructor(status, message, code = 'REQUEST_ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}

export function notFound(message = 'Resource not found.') {
  return new AppError(404, message, 'NOT_FOUND')
}
