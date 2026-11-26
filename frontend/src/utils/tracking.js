function checkpointIndex(checkpoint, route, fallbackIndex) {
  const byId = checkpoint.routeCheckpointId
    ? route.streets.findIndex((street) => street.id === checkpoint.routeCheckpointId)
    : -1
  if (byId >= 0) return byId
  const byName = route.streets.findIndex((street) => street.name.toLocaleLowerCase() === checkpoint.streetName.toLocaleLowerCase())
  return byName >= 0 ? byName : fallbackIndex
}

export function estimateArrivals(ticket, route, tickets) {
  const samples = route.streets.map(() => [])
  for (const pastTicket of tickets) {
    if (pastTicket.routeId !== route.id || !pastTicket.checkpoints.length) continue
    let previousAt = new Date(pastTicket.routeStart).getTime()
    pastTicket.checkpoints.forEach((checkpoint, index) => {
      const streetIndex = checkpointIndex(checkpoint, route, index)
      const arrivedAt = new Date(checkpoint.arrivedAt).getTime()
      if (streetIndex >= 0 && streetIndex < samples.length && arrivedAt > previousAt) {
        samples[streetIndex].push((arrivedAt - previousAt) / 60000)
      }
      if (arrivedAt > previousAt) previousAt = arrivedAt
    })
  }
  const averages = samples.map((durations) => durations.length
    ? durations.reduce((total, duration) => total + duration, 0) / durations.length
    : null)
  const allSamples = samples.flat()
  const averageStopMinutes = allSamples.length
    ? allSamples.reduce((total, duration) => total + duration, 0) / allSamples.length
    : null
  const actualTimes = new Map()
  ticket.checkpoints.forEach((checkpoint, index) => {
    const streetIndex = checkpointIndex(checkpoint, route, index)
    if (streetIndex >= 0 && streetIndex < route.streets.length) {
      actualTimes.set(streetIndex, checkpoint.arrivedAt)
    }
  })

  const currentIndex = actualTimes.size ? Math.max(...actualTimes.keys()) : -1
  let predictedAt = new Date(actualTimes.get(currentIndex) || ticket.routeStart).getTime()
  const estimates = new Map()
  for (let index = currentIndex + 1; index < route.streets.length; index += 1) {
    const minutes = averages[index] ?? averageStopMinutes
    if (minutes === null || !Number.isFinite(predictedAt)) break
    predictedAt += minutes * 60000
    estimates.set(index, new Date(predictedAt).toISOString())
  }

  return { actualTimes, estimates, sampleCount: allSamples.length }
}
