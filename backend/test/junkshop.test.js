import test from 'node:test'
import assert from 'node:assert/strict'
import { requirePermissionOrSuperAdmin } from '../src/middleware/auth.js'
import { calculateLandfillKg, summarizeJunkshopReports } from '../src/services/reportService.js'
import { junkshopReportSchema, junkshopSchema } from '../src/validations/junkshop.js'

test('junkshop registration requires an accreditation number and bounded business details', () => {
  const valid = junkshopSchema.safeParse({
    name: 'Central Recyclers',
    accreditationNumber: 'BRGY-2026/12',
    address: '12 Rizal Street, Central',
    contactNumber: '+63 917 123 4567',
  })
  assert.equal(valid.success, true)
  assert.equal(junkshopSchema.safeParse({
    name: 'Central Recyclers',
    accreditationNumber: 'not valid',
    address: '12 Rizal Street, Central',
  }).success, false)
})

test('junkshop reports coerce measurements and reject invalid material entries', () => {
  const report = junkshopReportSchema.safeParse({
    junkshopId: '4a5578a8-3038-4ea6-9d6d-0c99a56f0b5b',
    month: '2026-11',
    materials: JSON.stringify([{
      category: 'PLASTIC',
      quantity: '12',
      unit: 'BAG',
      weightKg: '18.5',
      volumeM3: '0.42',
    }]),
  })
  assert.equal(report.success, true)
  assert.equal(report.data.materials[0].weightKg, 18.5)
  assert.equal(junkshopReportSchema.safeParse({
    junkshopId: '4a5578a8-3038-4ea6-9d6d-0c99a56f0b5b',
    month: '2026-13',
    materials: '[{"category":"PLASTIC","quantity":0,"unit":"KG","weightKg":0,"volumeM3":-1}]',
  }).success, false)
})

test('monthly report aggregation consolidates junkshop weight and volume by material, household, and truck', () => {
  const reports = [{
    junkshopId: 'shop-1',
    junkshop: { name: 'Central Recyclers', accreditationNumber: 'BRGY-2026/12' },
    householdAddress: '12 Rizal Street',
    truckId: 'truck-1',
    materials: [
      { category: 'PLASTIC', quantity: 3, unit: 'BAG', weightKg: 12.5, volumeM3: 0.3 },
      { category: 'PAPER', quantity: 2, unit: 'KG', weightKg: 2, volumeM3: 0.05 },
    ],
  }]

  const summary = summarizeJunkshopReports(reports)

  assert.equal(summary.totalWeightKg, 14.5)
  assert.equal(summary.totalVolumeM3, 0.35)
  assert.equal(summary.materials.length, 2)
  assert.equal(summary.householdWeights.get('12 Rizal Street'), 14.5)
  assert.equal(summary.truckWeights.get('truck-1'), 14.5)
})

test('landfill disposal subtracts recyclable weight and flags unreconciled excess instead of negative disposal', () => {
  assert.deepEqual(calculateLandfillKg(100, 35), {
    landfillKg: 65,
    reconciliationExcessKg: 0,
  })
  assert.deepEqual(calculateLandfillKg(20, 25), {
    landfillKg: 0,
    reconciliationExcessKg: 5,
  })
})

test('report authorization admits permitted admins and super-admins but denies other roles', () => {
  const middleware = requirePermissionOrSuperAdmin('reports:manage')
  const check = (user) => {
    let error
    let continued = false
    middleware({ user }, {}, (nextError) => {
      error = nextError
      continued = true
    })
    return { error, continued }
  }

  assert.equal(check({ role: 'ADMIN', permissions: ['reports:manage'] }).continued, true)
  assert.equal(check({ role: 'SUPER_ADMIN', permissions: [] }).continued, true)
  assert.equal(check({ role: 'ADMIN', permissions: [] }).error.status, 403)
  assert.equal(check({ role: 'RESIDENT', permissions: ['reports:manage'] }).error.status, 403)
})
