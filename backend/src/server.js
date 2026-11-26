import app from '../app.js'
import { env } from './config/env.js'
import { prisma } from './database/prisma.js'

let server

async function start() {
  await prisma.$connect()
  server = app.listen(env.PORT, () => {
    console.log(`i-WASTE API listening at ${env.SERVER_URL || `port ${env.PORT}`}`)
  })
}

async function shutdown(signal) {
  console.log(`${signal} received; shutting down.`)
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
  await prisma.$disconnect()
}

process.once('SIGINT', () => shutdown('SIGINT').then(() => process.exit(0)))
process.once('SIGTERM', () => shutdown('SIGTERM').then(() => process.exit(0)))

start().catch(async (error) => {
  console.error('Unable to start i-WASTE API.', { name: error.name, code: error.code })
  await prisma.$disconnect()
  process.exitCode = 1
})
