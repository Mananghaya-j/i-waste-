import test from 'node:test'
import assert from 'node:assert/strict'
import { routeSchema, truckSchema, truckUpdateSchema } from '../src/validations/trucks.js'

test('truck creation validates bounded identifiers and positive capacity', () => {
  const valid = truckSchema.safeParse({
    truckId: 'TRUCK-12',
    plateNumber: 'ABC-1234',
    vehicleType: 'Compactor',
    capacityKg: '5000',
  })
  assert.equal(valid.success, true)
  assert.equal(truckSchema.safeParse({
    truckId: 'TRUCK-12',
    plateNumber: 'ABC-1234',
    vehicleType: 'Compactor',
    capacityKg: '-1',
  }).success, false)
})

test('truck updates can clear optional details without accepting invalid admin ids', () => {
  assert.equal(truckUpdateSchema.safeParse({ driverName: null, crew: null, capacityKg: null, adminId: null }).success, true)
  assert.equal(truckUpdateSchema.safeParse({ adminId: 'not-a-uuid' }).success, false)
})

test('route checkpoints require paired coordinates and unique sequences', () => {
  const route = {
    name: 'Central collection',
    checkpoints: [{ sequence: 1, streetName: 'Rizal Street', latitude: 14.6, longitude: 121.0 }],
  }
  assert.equal(routeSchema.safeParse(route).success, true)
  assert.equal(routeSchema.safeParse({
    ...route,
    checkpoints: [{ sequence: 1, streetName: 'Rizal Street', latitude: 14.6 }],
  }).success, false)
  assert.equal(routeSchema.safeParse({
    ...route,
    checkpoints: [
      { sequence: 1, streetName: 'Rizal Street' },
      { sequence: 1, streetName: 'Bonifacio Street' },
    ],
  }).success, false)
})
