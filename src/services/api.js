import {
  validateModule3PickupRequest,
  validateRecyclablesRequest,
  validateSearchQuery,
  validateTreeMaintenanceRequest,
  validateWaterwayCleaningRequest,
} from '../utils/validation.js'

const delay = (duration = 180) => new Promise((resolve) => setTimeout(resolve, duration))

const dashboardSnapshot = {
  activeTrucks: 12,
  totalTrucks: 18,
  collectionsToday: 342,
  wasteRecycledTons: 1.2,
  communityMembers: 2450,
  routeProgress: 83,
  streetsCompleted: 5,
  streetsTotal: 6,
  organicWasteKg: 425,
  recyclablesKg: 290,
  collectedStops: 47,
  lastUpdated: new Date().toISOString(),
}

const directory = [
  { label: 'Route B-12 · Rizal St.', category: 'Route' },
  { label: 'Plaza Cleanup Drive · Nov 20', category: 'Community event' },
  { label: 'Module 3 · Waste & cooking oil pickup', category: 'Service' },
  { label: 'Module 4 · Tree & waterway requests', category: 'Service' },
  { label: 'Module 5 · Sell recyclables', category: 'Service' },
  { label: 'Greenfield Park · Tree planting', category: 'Community event' },
]

function describeFile(file) {
  return file ? { name: file.name, contentType: file.type, sizeBytes: file.size } : null
}

function makeReference(prefix) {
  return `IW-${prefix}-${Date.now().toString().slice(-6)}`
}

export async function getDashboardData() {
  await delay()
  return { ...dashboardSnapshot, lastUpdated: new Date().toISOString() }
}

export async function searchDirectory({ query }) {
  const result = validateSearchQuery(query)
  if (!result.valid) throw new Error(result.error)
  await delay(120)

  const normalizedQuery = result.value.toLocaleLowerCase()
  const results = normalizedQuery
    ? directory.filter((item) => item.label.toLocaleLowerCase().includes(normalizedQuery))
    : []
  return results.map((item) => ({ ...item }))
}

export async function createPickupRequest(input) {
  const result = validateModule3PickupRequest(input)
  if (!result.valid) throw new Error(result.error)
  await delay(240)

  const { photo, ...fields } = result.value
  const payload = { ...fields, photo: describeFile(photo) }
  const truckDispatchGroup = {
    normal: 'Normal Waste',
    special: 'Special Waste',
    oil: 'Cooking Oil Collection',
  }[fields.requestCategory]
  // Upload image bytes to storage separately; send the resulting attachment ID with this typed JSON to the future API.
  // The backend should bind request fields as parameters (for example, $1, $2 in node-postgres or Prisma).
  return { reference: makeReference('PU'), status: 'Submitted', truckDispatchGroup, ...payload }
}

export async function createTreeMaintenanceRequest(input) {
  const result = validateTreeMaintenanceRequest(input)
  if (!result.valid) throw new Error(result.error)
  await delay(240)

  const { photo, denrDocument, ...fields } = result.value
  const payload = {
    ...fields,
    photo: describeFile(photo),
    denrDocument: describeFile(denrDocument),
  }
  // Replace this mock with POST /api/tree-maintenance/requests using the typed payload.
  return { reference: makeReference('TR'), status: 'Submitted', ...payload }
}

export async function createWaterwayCleaningRequest(input) {
  const result = validateWaterwayCleaningRequest(input)
  if (!result.valid) throw new Error(result.error)
  await delay(240)

  const { photo, ...fields } = result.value
  // Replace this mock with POST /api/waterway-cleaning/requests using the typed payload.
  return { reference: makeReference('WW'), status: 'Submitted', ...fields, photo: describeFile(photo) }
}

export function estimateRecyclables({ materials }) {
  if (!Array.isArray(materials) || materials.length === 0) return null
  return {
    estimatedValue: null,
    estimatedVolumeLiters: materials.reduce((total, material) => total + Number(material.volumeLiters || 0), 0),
    sampleValuePerKg: null,
  }
}

export async function createRecyclablesRequest(input) {
  const result = validateRecyclablesRequest(input)
  if (!result.valid) throw new Error(result.error)
  await delay(240)

  const { photos, ...fields } = result.value
  const estimate = estimateRecyclables(fields)
  const payload = {
    ...fields,
    photos: photos.map(describeFile),
    estimate,
  }
  // Replace this mock with POST /api/recyclables/requests; keep estimates server-validated.
  return { reference: makeReference('RC'), status: 'Submitted', ...payload }
}

export async function joinCommunityEvent({ eventId }) {
  if (typeof eventId !== 'string' || !/^[a-z0-9-]{1,32}$/i.test(eventId)) {
    throw new Error('Choose a valid community event.')
  }
  await delay(160)
  // The event identifier is sent as JSON so the backend can use a parameterized query.
  return { eventId, joined: true }
}
