import * as announcementService from '../services/announcementService.js'

export async function listPublic(req, res) {
  res.json({ data: await announcementService.listPublicAnnouncements(req) })
}

export async function list(req, res) {
  res.json(await announcementService.listAnnouncements(req))
}

export async function create(req, res) {
  res.status(201).json({ data: await announcementService.createAnnouncement(req.body, req) })
}

export async function update(req, res) {
  res.json({ data: await announcementService.updateAnnouncement(req.params.id, req.body, req) })
}

export async function remove(req, res) {
  await announcementService.deleteAnnouncement(req.params.id, req)
  res.status(204).end()
}

export async function rsvp(req, res) {
  res.status(201).json({ data: await announcementService.rsvpCommunityEvent(req.params.id, req) })
}
