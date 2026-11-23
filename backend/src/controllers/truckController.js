import * as truckService from '../services/truckService.js'

export async function listTrucks(req, res) {
  res.json(await truckService.listTrucks(req))
}

export async function createTruck(req, res) {
  res.status(201).json({ data: await truckService.createTruck(req.body, req) })
}

export async function updateTruck(req, res) {
  res.json({ data: await truckService.updateTruck(req.params.id, req.body, req) })
}

export async function lookupQr(req, res) {
  res.json({ data: await truckService.lookupQr(req.params.code) })
}

export async function routes(req, res) {
  res.json({ data: await truckService.listRoutes() })
}

export async function saveRoute(req, res) {
  res.status(req.params.id ? 200 : 201).json({ data: await truckService.saveRoute(req.body, req, req.params.id) })
}

export async function createTrip(req, res) {
  res.status(201).json({ data: await truckService.createTrip(req.body, req) })
}

export async function addCheckpoint(req, res) {
  res.status(201).json({ data: await truckService.addCheckpoint(req.params.id, req.body, req) })
}

export async function completeTrip(req, res) {
  res.json({ data: await truckService.completeTrip(req.params.id, req) })
}

export async function getTrip(req, res) {
  res.json({ data: await truckService.getTrip(req.params.id) })
}

export async function listTrips(req, res) {
  res.json(await truckService.listTrips(req))
}
