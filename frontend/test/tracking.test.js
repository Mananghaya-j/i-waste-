import test from 'node:test'
import assert from 'node:assert/strict'
import { estimateArrivals } from '../src/utils/tracking.js'

const route = {
  id: 'route-1',
  streets: [
    { id: 'stop-1', name: 'Rizal St.' },
    { id: 'stop-2', name: 'Mabini St.' },
    { id: 'stop-3', name: 'Bonifacio St.' },
  ],
}

test('tracking estimates upcoming stop times from recorded route segment averages', () => {
  const history = [{
    routeId: route.id,
    routeStart: '2026-11-25T08:00:00.000Z',
    checkpoints: [
      { routeCheckpointId: 'stop-1', streetName: 'Rizal St.', arrivedAt: '2026-11-25T08:10:00.000Z' },
      { routeCheckpointId: 'stop-2', streetName: 'Mabini St.', arrivedAt: '2026-11-25T08:30:00.000Z' },
    ],
  }]
  const currentTrip = {
    routeId: route.id,
    routeStart: '2026-11-26T09:00:00.000Z',
    checkpoints: [
      { routeCheckpointId: 'stop-1', streetName: 'Rizal St.', arrivedAt: '2026-11-26T09:05:00.000Z' },
    ],
  }

  const result = estimateArrivals(currentTrip, route, [...history, currentTrip])

  assert.equal(result.actualTimes.get(0), '2026-11-26T09:05:00.000Z')
  assert.equal(result.estimates.get(1), '2026-11-26T09:25:00.000Z')
  assert.equal(result.estimates.get(2), '2026-11-26T09:36:40.000Z')
  assert.equal(result.sampleCount, 3)
})

test('tracking does not invent an ETA before any checkpoint timing is available', () => {
  const ticket = { routeId: route.id, routeStart: '2026-11-26T09:00:00.000Z', checkpoints: [] }

  const result = estimateArrivals(ticket, route, [ticket])

  assert.equal(result.estimates.size, 0)
  assert.equal(result.sampleCount, 0)
})
