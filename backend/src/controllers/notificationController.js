import * as notificationService from '../services/notificationService.js'

export async function list(req, res) {
  res.json(await notificationService.listNotifications(req.user.id, req.query))
}

export async function markRead(req, res) {
  await notificationService.markRead(req.user.id, req.params.id)
  res.status(204).end()
}
