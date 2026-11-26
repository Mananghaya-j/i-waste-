import {
  validateModule3PickupRequest,
  validateRecyclablesRequest,
  validateSearchQuery,
  validateTreeMaintenanceRequest,
  validateWaterwayCleaningRequest,
} from '../utils/validation.js'
import { authenticatedRequest, publicMultipartRequest, publicRequest } from './authApi.js'

const delay = (duration = 180) => new Promise((resolve) => setTimeout(resolve, duration))

const directory = [
  { label: 'Route B-12 · Rizal St.', category: 'Route' },
  { label: 'Module 3 · Waste & cooking oil pickup', category: 'Service' },
  { label: 'Module 4 · Tree & waterway requests', category: 'Service' },
  { label: 'Module 5 · Sell recyclables', category: 'Service' },
]

const RECYCLABLE_ESTIMATES = {
  Plastic: { valuePerKg: 10, litersPerKg: 4 },
  Paper: { valuePerKg: 6, litersPerKg: 3 },
  Cardboard: { valuePerKg: 5, litersPerKg: 5 },
  Glass: { valuePerKg: 2, litersPerKg: 1 },
  Metal: { valuePerKg: 12, litersPerKg: 1 },
  Aluminum: { valuePerKg: 30, litersPerKg: 2 },
  'Electronic Waste': { valuePerKg: 20, litersPerKg: 2 },
}

function describeFile(file) {
  return file ? { name: file.name, contentType: file.type, sizeBytes: file.size } : null
}

export async function getDashboardData() {
  const response = await publicRequest('/public/dashboard')
  return response.data
}

export async function getCommunityContent() {
  const response = await publicRequest('/announcements')
  return response.data
}

export async function createEnvironmentalReport(input) {
  const body = new FormData()
  body.append('anonymous', String(input.anonymous))
  if (!input.anonymous && input.fullName) body.append('fullName', input.fullName)
  if (!input.anonymous && input.contactNumber) body.append('contactNumber', input.contactNumber)
  if (!input.anonymous && input.email) body.append('email', input.email)
  body.append('type', input.type)
  body.append('location', input.location)
  body.append('description', input.description)
  body.append('photo', input.photo)
  const response = await publicMultipartRequest('/environmental-reports', body)
  return { reference: response.data.referenceNo, status: response.data.status }
}

export async function searchDirectory({ query }) {
  const result = validateSearchQuery(query)
  if (!result.valid) throw new Error(result.error)
  await delay(120)

  const normalizedQuery = result.value.toLocaleLowerCase()
  const localResults = normalizedQuery
    ? directory.filter((item) => item.label.toLocaleLowerCase().includes(normalizedQuery))
    : []
  const events = normalizedQuery
    ? (await getCommunityContent())
      .filter((item) => ['COMMUNITY_EVENT', 'ACTIVITY_SCHEDULE'].includes(item.category))
      .filter((item) => `${item.title} ${item.location || ''}`.toLocaleLowerCase().includes(normalizedQuery))
      .map((item) => ({ label: `${item.title}${item.location ? ` · ${item.location}` : ''}`, category: 'Community event' }))
    : []
  return [...localResults, ...events].map((item) => ({ ...item }))
}

export async function createPickupRequest(input) {
  const result = validateModule3PickupRequest(input)
  if (!result.valid) throw new Error(result.error)

  const { photo, ...fields } = result.value
  const body = new FormData()
  if (fields.fullName) body.append('fullName', fields.fullName)
  body.append('contactNumber', fields.contactNumber)
  body.append('address', fields.address)
  body.append('category', { normal: 'NORMAL', special: 'SPECIAL', oil: 'COOKING_OIL' }[fields.requestCategory])
  if (fields.specialWasteType) body.append('specialWasteType', fields.specialWasteType)
  if (fields.otherWaste) body.append('otherWaste', fields.otherWaste)
  if (fields.oilQuantityLiters !== null) body.append('oilQuantityLiters', String(fields.oilQuantityLiters))
  if (fields.description) body.append('description', fields.description)
  body.append('photo', photo)
  const response = await publicMultipartRequest('/pickup-requests', body)
  const payload = { ...fields, photo: describeFile(photo) }
  const truckDispatchGroup = {
    normal: 'Normal Waste',
    special: 'Special Waste',
    oil: 'Cooking Oil Collection',
  }[fields.requestCategory]
  return { reference: response.data.referenceNo, status: 'Submitted', truckDispatchGroup, ...payload }
}

export async function createTreeMaintenanceRequest(input) {
  const result = validateTreeMaintenanceRequest(input)
  if (!result.valid) throw new Error(result.error)

  const { photo, denrDocument, ...fields } = result.value
  const body = new FormData()
  if (fields.fullName) body.append('fullName', fields.fullName)
  body.append('contactNumber', fields.contactNumber)
  body.append('location', fields.location)
  body.append('landClassification', fields.landClassification.toUpperCase())
  body.append('requestType', fields.requestType.toUpperCase())
  if (fields.treeType) body.append('treeType', fields.treeType)
  body.append('hazardDescription', fields.hazardDescription)
  if (fields.denrDocumentReference) body.append('denrDocumentReference', fields.denrDocumentReference)
  body.append('instructionsAccepted', String(fields.instructionsAccepted))
  body.append('photo', photo)
  if (denrDocument) body.append('denrDocument', denrDocument)
  const response = await publicMultipartRequest('/tree-requests', body)
  const payload = {
    ...fields,
    photo: describeFile(photo),
    denrDocument: describeFile(denrDocument),
  }
  return { reference: response.data.referenceNo, status: 'Submitted', ...payload }
}

export async function createWaterwayCleaningRequest(input) {
  const result = validateWaterwayCleaningRequest(input)
  if (!result.valid) throw new Error(result.error)

  const { photo, ...fields } = result.value
  const body = new FormData()
  if (fields.fullName) body.append('fullName', fields.fullName)
  body.append('contactNumber', fields.contactNumber)
  body.append('location', fields.location)
  body.append('issueType', fields.issueType)
  body.append('description', fields.description)
  body.append('photo', photo)
  const response = await publicMultipartRequest('/waterway-requests', body)
  return { reference: response.data.referenceNo, status: 'Submitted', ...fields, photo: describeFile(photo) }
}

export function estimateRecyclables({ materialType, estimatedWeight }) {
  const material = RECYCLABLE_ESTIMATES[materialType]
  const weight = Number(estimatedWeight)
  if (!material || !Number.isFinite(weight) || weight <= 0) return null

  return {
    estimatedValue: Math.round(weight * material.valuePerKg * 100) / 100,
    estimatedVolumeLiters: Math.round(weight * material.litersPerKg * 10) / 10,
    sampleValuePerKg: material.valuePerKg,
  }
}

export async function createRecyclablesRequest(input) {
  const result = validateRecyclablesRequest(input)
  if (!result.valid) throw new Error(result.error)
  const { photos, ...fields } = result.value
  const estimate = estimateRecyclables(fields)
  const body = new FormData()
  if (fields.fullName) body.append('fullName', fields.fullName)
  body.append('contactNumber', fields.contactNumber)
  body.append('materialType', fields.materialType)
  if (fields.estimatedWeight !== null) body.append('estimatedWeightKg', String(fields.estimatedWeight))
  body.append('pickupAddress', fields.pickupAddress)
  body.append('fulfillment', fields.fulfillment)
  body.append('preferredDate', fields.preferredDate)
  photos.forEach((photo) => body.append('photos', photo))
  const response = await publicMultipartRequest('/recyclables-requests', body)
  return {
    reference: response.data.referenceNo,
    status: response.data.status,
    ...fields,
    photos: photos.map(describeFile),
    estimate,
  }
}

export async function joinCommunityEvent({ eventId }) {
  if (typeof eventId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId)) {
    throw new Error('Choose a valid community event.')
  }
  const response = await authenticatedRequest(`/announcements/${eventId}/rsvp`, { method: 'POST', body: {} })
  return { eventId, joined: Boolean(response.data?.id) }
}
