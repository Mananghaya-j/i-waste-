import test from 'node:test'
import assert from 'node:assert/strict'
import { pickupSchema, treeSchema, environmentalReportSchema, recyclablesSchema, statusUpdateSchema, referenceSchema } from '../src/validations/requests.js'
import { createReference } from '../src/utils/reference.js'
import { renderCsv, renderPdf, renderXlsx } from '../src/services/reportService.js'
import ExcelJS from 'exceljs'
import { isAllowedOrigin } from '../src/utils/corsOrigin.js'
import { updateProfileSchema } from '../src/validations/auth.js'
import { publicTripListQuerySchema } from '../src/validations/trucks.js'

test('profile updates accept name and optional contact details but reject empty changes', () => {
  assert.deepEqual(updateProfileSchema.parse({ fullName: 'Resident Example', contactNumber: '' }), {
    fullName: 'Resident Example',
    contactNumber: null,
  })
  assert.equal(updateProfileSchema.safeParse({}).success, false)
  assert.equal(updateProfileSchema.safeParse({ email: 'new@example.com' }).success, false)
})

test('public tracking filters validate truck ids and date ranges', () => {
  assert.equal(publicTripListQuerySchema.safeParse({ truckId: 'not-a-uuid' }).success, false)
  assert.equal(publicTripListQuerySchema.safeParse({ from: '2026-12-02', to: '2026-12-01' }).success, false)
})

test('pickup validates special waste subtype and requires a description for Others', () => {
  const valid = pickupSchema.safeParse({
    contactNumber: '09171234567',
    address: 'Rizal Street, Barangay Central',
    category: 'SPECIAL',
    specialWasteType: 'Others',
    otherWaste: 'Broken ceramic tiles',
  })
  assert.equal(valid.success, true)

  const invalid = pickupSchema.safeParse({
    contactNumber: '09171234567',
    address: 'Rizal Street, Barangay Central',
    category: 'SPECIAL',
    specialWasteType: 'Others',
  })
  assert.equal(invalid.success, false)
})

test('cooking oil pickup requires a positive quantity', () => {
  const result = pickupSchema.safeParse({
    contactNumber: '09171234567',
    address: 'Rizal Street, Barangay Central',
    category: 'COOKING_OIL',
    oilQuantityLiters: '0',
  })
  assert.equal(result.success, false)
})

test('private-land tree requests require accepted instructions and a bounded description', () => {
  const result = treeSchema.safeParse({
    contactNumber: '09171234567',
    location: 'Rizal Street, Barangay Central',
    landClassification: 'PRIVATE',
    requestType: 'PRUNING',
    hazardDescription: 'Branches are touching the overhead power line.',
    instructionsAccepted: 'true',
  })
  assert.equal(result.success, true)
  assert.equal(result.data.instructionsAccepted, true)
})

test('anonymous environmental reports do not require reporter contact details', () => {
  const result = environmentalReportSchema.safeParse({
    anonymous: 'true',
    type: 'ILLEGAL_DUMPING',
    location: 'Creek access road, Barangay Central',
    description: 'Several bags of household waste were left beside the creek.',
  })
  assert.equal(result.success, true)
  assert.equal(result.data.anonymous, true)
})

test('identified environmental reports require phone or email contact', () => {
  const base = {
    anonymous: 'false',
    type: 'MISSED_COLLECTION',
    location: 'Rizal Street, Barangay Central',
    description: 'Garbage was not collected on the scheduled pickup day.',
  }
  assert.equal(environmentalReportSchema.safeParse(base).success, false)
  assert.equal(environmentalReportSchema.safeParse({ ...base, email: 'resident@example.com' }).success, true)
})

test('recyclables requests require a valid pickup address, fulfillment, and preferred date', () => {
  const result = recyclablesSchema.safeParse({
    contactNumber: '09171234567',
    materialType: 'Plastic',
    estimatedWeightKg: '4.5',
    pickupAddress: 'Rizal Street, Barangay Central',
    fulfillment: 'Pickup',
    preferredDate: '2026-12-01',
  })
  assert.equal(result.success, true)
  assert.equal(result.data.estimatedWeightKg, 4.5)
})

test('pickup measurement validation prevents component weights exceeding total kilograms', () => {
  const result = statusUpdateSchema.safeParse({
    status: 'COMPLETED',
    measuredWasteKg: '10',
    measuredRecyclablesKg: '7',
    measuredCompostKg: '4',
  })
  assert.equal(result.success, false)
})

test('reference numbers include the type prefix and random suffix', () => {
  const referenceNo = createReference('PU')
  assert.match(referenceNo, /^IW-PU-\d{6}-[A-F0-9]{16}$/)
  assert.equal(referenceSchema.safeParse({ referenceNo }).success, true)
  assert.equal(referenceSchema.safeParse({ referenceNo: 'IW-PU-260101-INVALID' }).success, false)
  assert.equal(referenceSchema.safeParse({ referenceNo: 'IW-RC-260101-ABCDEF123456' }).success, true)
})

test('CSV export neutralizes formula cells', () => {
  const csv = renderCsv([{ description: '=1+1' }], ['description'])
  assert.match(csv, /"'=1\+1"/)
})

test('XLSX export is readable and stores user text as plain strings', async () => {
  const workbookBytes = await renderXlsx([{ description: '=1+1' }], ['description'], 'pickup')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(workbookBytes)
  assert.equal(workbook.worksheets[0].getCell('A2').value, "'=1+1")
})

test('PDF export returns a PDF document', async () => {
  const pdf = await renderPdf([{ referenceNo: 'IW-PU-123456-ABCDEF123456' }], ['referenceNo'], 'pickup')
  assert.equal(pdf.toString('ascii', 0, 5), '%PDF-')
})

test('development CORS allows Vite loopback hosts on dynamic ports only', () => {
  const allowedOrigins = ['http://localhost:5173']
  assert.equal(isAllowedOrigin('http://127.0.0.1:5182', allowedOrigins, 'development'), true)
  assert.equal(isAllowedOrigin('http://localhost:5175', allowedOrigins, 'development'), true)
  assert.equal(isAllowedOrigin('https://localhost:5175', allowedOrigins, 'development'), false)
  assert.equal(isAllowedOrigin('https://untrusted.example', allowedOrigins, 'development'), false)
  assert.equal(isAllowedOrigin('http://127.0.0.1:5182', allowedOrigins, 'production'), false)
})
