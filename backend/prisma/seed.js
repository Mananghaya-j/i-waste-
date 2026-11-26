import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seed() {
  const email = process.env.SEED_SUPERADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.SEED_SUPERADMIN_PASSWORD
  if (!email || !password || password.length < 12) {
    throw new Error('Set SEED_SUPERADMIN_EMAIL and a SEED_SUPERADMIN_PASSWORD of at least 12 characters.')
  }
  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      fullName: 'System Superadmin',
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  })
}

seed()
  .catch((error) => {
    console.error('Database seed failed.', { name: error.name, code: error.code })
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
