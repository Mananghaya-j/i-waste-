import test from 'node:test'
import assert from 'node:assert/strict'
import { pickupSchema, treeSchema, environmentalReportSchema } from '../src/validators/requests.js'
import { createReference } from '../src/utils/reference.js'
import { renderCsv, renderPdf, renderXlsx } from '../src/services/reportService.js'
import ExcelJS from 'exceljs'
import { isAllowedOrigin } from '../src/utils/corsOrigin.js'

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

test('reference numbers include the type prefix and random suffix', () => {
  assert.match(createReference('PU'), /^IW-PU-\d{6}-[A-F0-9]{12}$/)
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
