import * as adminService from '../services/adminService.js'

export async function listAdmins(req, res) {
  res.json(await adminService.listAdmins(req))
}

export async function listRoleUsers(req, res) {
  res.json(await adminService.listRoleUsers(req))
}

export async function listInvestigators(req, res) {
  res.json({ data: await adminService.listInvestigators() })
}

export async function updateUserRole(req, res) {
  res.json({ data: await adminService.updateUserRole(req.params.id, req.body.role, req) })
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

export async function updateAdminPermissions(req, res) {
  res.json({ data: await adminService.updateAdminPermissions(req.params.id, req.body.permissions, req) })
}

export async function permissions(req, res) {
  res.json({ data: adminService.ADMIN_PERMISSIONS })
}

export async function auditLogs(req, res) {
  res.json(await adminService.listAuditLogs(req))
}

export async function settings(req, res) {
  res.json({ data: await adminService.listSettings() })
}

export async function updateSettings(req, res) {
  res.json({ data: await adminService.updateSettings(req.body, req) })
}
