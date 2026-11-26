import * as service from '../services/junkshopService.js'

export async function listJunkshops(req, res) {
  res.json({ data: await service.listJunkshops() })
}

export async function createJunkshop(req, res) {
  res.status(201).json({ data: await service.createJunkshop(req.body, req) })
}

export async function listJunkshopReports(req, res) {
  res.json(await service.listJunkshopReports(req.query))
}

export async function createJunkshopReport(req, res) {
  const files = req.files?.supportingDocuments || []
  res.status(201).json({ data: await service.createJunkshopReport(req.body, files, req) })
}
