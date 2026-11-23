import * as adminService from '../services/adminService.js'

export async function listAdmins(req, res) {
  res.json(await adminService.listAdmins(req))
}

export async function createAdmin(req, res) {
  res.status(201).json({ data: await adminService.createAdmin(req.body, req) })
}

export async function updateAdmin(req, res) {
  res.json({ data: await adminService.updateAdmin(req.params.id, req.body, req) })
}

export async function stats(req, res) {
  res.json({ data: await adminService.dashboardStats() })
}
