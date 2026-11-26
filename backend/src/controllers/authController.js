import * as authService from '../services/authService.js'

export async function register(req, res) {
  res.status(201).json(await authService.register(req.body, req))
}

export async function login(req, res) {
  res.json(await authService.login(req.body, req, res))
}

export async function loginAdmin(req, res) {
  res.json(await authService.loginAdmin(req.body, req, res))
}

export async function refresh(req, res) {
  res.json(await authService.refresh(req.cookies.refreshToken, res))
}

export async function logout(req, res) {
  await authService.logout(req.cookies.refreshToken, res)
  res.status(204).end()
}

export async function changePassword(req, res) {
  await authService.changePassword(req.user.id, req.body, req)
  res.status(204).end()
}

export async function preparePasswordReset(req, res) {
  await authService.preparePasswordReset(req.body.email)
  res.status(202).json({ message: 'If an account exists for that email, password reset instructions will be sent.' })
}

export async function verifyEmail(req, res) {
  await authService.verifyEmail(req.body.token, req)
  res.status(204).end()
}

export async function getProfile(req, res) {
  res.json({ data: await authService.getProfile(req.user.id) })
}

export async function updateProfile(req, res) {
  res.json({ data: await authService.updateProfile(req.user.id, req.body, req) })
}

export async function getProfilePhoto(req, res, next) {
  const photo = await authService.getProfilePhoto(req.user.id)
  res.set('Cache-Control', 'private, no-store')
  res.type(photo.mimeType)
  res.sendFile(photo.path, (error) => {
    if (error && !res.headersSent) next(error)
  })
}

export async function updateProfilePhoto(req, res) {
  res.json({ data: await authService.updateProfilePhoto(req.user.id, req.file, req) })
}

export function guest(req, res) {
  res.json({
    mode: 'GUEST',
    capabilities: ['public-truck-tracking', 'request-tracking', 'submit-service-request', 'submit-environmental-report'],
  })
}
