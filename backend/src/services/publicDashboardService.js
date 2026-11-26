import { prisma } from '../database/prisma.js'

function sum(value) {
  return Number(value || 0)
}

export async function publicDashboardStats() {
  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - 7)
  const [activeTrucks, totalTrucks, collectionsToday, monthlyWeight, communityMembers, newMembersThisWeek, activeTrip] = await Promise.all([
    prisma.truck.count({ where: { status: 'ACTIVE' } }),
    prisma.truck.count(),
    prisma.pickupRequest.count({ where: { status: 'COMPLETED', completedAt: { gte: today, lt: tomorrow } } }),
    prisma.pickupRequest.aggregate({
      where: { status: 'COMPLETED', completedAt: { gte: monthStart, lt: now } },
      _sum: { measuredWasteKg: true, measuredRecyclablesKg: true, measuredCompostKg: true },
    }),
    prisma.user.count({ where: { role: 'RESIDENT', status: 'ACTIVE' } }),
    prisma.user.count({ where: { role: 'RESIDENT', createdAt: { gte: weekStart }, status: 'ACTIVE' } }),
    prisma.tripTicket.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
      include: {
        truck: { select: { truckId: true, plateNumber: true, currentStreet: true } },
        route: { include: { checkpoints: { orderBy: { sequence: 'asc' } } } },
        checkpoints: { orderBy: { arrivedAt: 'asc' }, select: { streetName: true, completed: true } },
      },
    }),
  ])
  const plannedStops = activeTrip?.route?.checkpoints || []
  const completedStreets = new Set(activeTrip?.checkpoints.filter(({ completed }) => completed).map(({ streetName }) => streetName.toLocaleLowerCase()) || [])
  const currentCheckpoint = activeTrip?.checkpoints.filter(({ completed }) => !completed).slice(-1)[0]
  const currentStreet = activeTrip?.truck.currentStreet || currentCheckpoint?.streetName || null
  const routeCheckpoints = plannedStops.map((checkpoint) => {
    const name = checkpoint.streetName
    const isDone = completedStreets.has(name.toLocaleLowerCase())
    const isCurrent = !isDone && currentStreet?.toLocaleLowerCase() === name.toLocaleLowerCase()
    const latitude = checkpoint.latitude === null ? null : Number(checkpoint.latitude)
    const longitude = checkpoint.longitude === null ? null : Number(checkpoint.longitude)
    return {
      name,
      state: isDone ? 'done' : isCurrent ? 'current' : 'pending',
      position: latitude === null || longitude === null ? null : [latitude, longitude],
    }
  })
  const streetsTotal = plannedStops.length || activeTrip?.checkpoints.length || 0
  const streetsCompleted = plannedStops.length
    ? routeCheckpoints.filter(({ state }) => state === 'done').length
    : activeTrip?.checkpoints.filter(({ completed }) => completed).length || 0
  const recyclablesKg = sum(monthlyWeight._sum.measuredRecyclablesKg)
  return {
    activeTrucks,
    totalTrucks,
    collectionsToday,
    wasteRecycledTons: recyclablesKg / 1000,
    communityMembers,
    newMembersThisWeek,
    routeProgress: streetsTotal ? Math.round((streetsCompleted / streetsTotal) * 100) : 0,
    streetsCompleted,
    streetsTotal,
    activeRoute: activeTrip ? {
      tripNo: activeTrip.tripNo,
      truckId: activeTrip.truck.truckId,
      plateNumber: activeTrip.truck.plateNumber,
      currentStreet,
      nextStreet: routeCheckpoints.find(({ state }) => state === 'pending')?.name || null,
      finalStop: plannedStops.at(-1)?.streetName || null,
      checkpoints: routeCheckpoints.filter(({ position }) => position),
    } : null,
    organicWasteKg: sum(monthlyWeight._sum.measuredCompostKg),
    recyclablesKg,
    collectedStops: collectionsToday,
    lastUpdated: now.toISOString(),
  }
}
