import path from 'node:path'
import { createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../database/prisma.js'
import { env } from '../config/env.js'
import { AppError } from '../utils/errors.js'
import { randomToken } from '../utils/reference.js'
import { writeAudit } from '../utils/audit.js'
import { hasAccountLockout, isAccountLocked } from '../utils/authPolicy.js'
import { persistFiles, removeFiles, uploadDirectory } from '../utils/attachments.js'

const hashToken = (token) => createHash('sha256').update(token).digest('hex')
const publicUser = ({ id, fullName, email, contactNumber, role, permissions = [], profilePhotoStorageKey }) => ({
  id,
  fullName,
  email,
  contactNumber,
  role,
  permissions: role === 'ADMIN' ? permissions : [],
  profilePhotoAvailable: Boolean(profilePhotoStorageKey),
})
const failedLoginLimit = 5
const lockoutDurationMs = 15 * 60 * 1000
const dummyPasswordHash = bcrypt.hash(randomToken(), 12)

function createAccessToken(user) {
  return jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_ACCESS_TTL,
    algorithm: 'HS256',
  })
}

function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  })
}

async function recordFailedLogin(user, now) {
  let latest = user
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!latest || latest.status !== 'ACTIVE' || (latest.lockedUntil && latest.lockedUntil > now)) return

    const expiredLock = latest.lockedUntil && latest.lockedUntil <= now
    const result = await prisma.user.updateMany({
      where: expiredLock
        ? { id: latest.id, lockedUntil: { lte: now } }
        : { id: latest.id, lockedUntil: null, failedLoginAttempts: latest.failedLoginAttempts },
      data: expiredLock
        ? { failedLoginAttempts: 1, lockedUntil: null }
        : { failedLoginAttempts: { increment: 1 } },
    })
    if (result.count === 1) {
      const updated = await prisma.user.findUnique({
        where: { id: latest.id },
        select: { failedLoginAttempts: true, lockedUntil: true },
      })
      if (updated?.failedLoginAttempts >= failedLoginLimit && !updated.lockedUntil) {
        await prisma.user.updateMany({
          where: { id: latest.id, failedLoginAttempts: updated.failedLoginAttempts, lockedUntil: null },
          data: { lockedUntil: new Date(now.getTime() + lockoutDurationMs) },
        })
      }
      return
    }

    latest = await prisma.user.findUnique({
      where: { id: latest.id },
      select: { id: true, status: true, failedLoginAttempts: true, lockedUntil: true },
    })
  }
}

async function issueSession(user, res) {
  const refreshToken = randomToken()
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000)
  await prisma.refreshToken.create({ data: { tokenHash: hashToken(refreshToken), userId: user.id, expiresAt } })
  setRefreshCookie(res, refreshToken)
  return { user: publicUser(user), accessToken: createAccessToken(user), tokenType: 'Bearer', expiresIn: env.JWT_ACCESS_TTL }
}

export async function register(input, req) {
  const passwordHash = await bcrypt.hash(input.password, 12)
  await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { fullName: input.fullName, email: input.email, contactNumber: input.contactNumber, passwordHash },
    })
    await writeAudit(tx, req, { actorId: created.id, action: 'USER_REGISTERED', entityType: 'User', entityId: created.id })
  })
  return { verificationRequired: false }
}

export async function login(input, req, res, allowedRoles = null) {
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  const passwordMatches = await bcrypt.compare(input.password, user?.passwordHash || await dummyPasswordHash)
  const now = new Date()
  if (!user || user.status !== 'ACTIVE' || isAccountLocked(user, now) || !passwordMatches) {
    if (user && !passwordMatches && hasAccountLockout(user.role)) await recordFailedLogin(user, now)
    await prisma.auditLog.create({
      data: { action: 'LOGIN_FAILED', entityType: 'User', metadata: {}, ipAddress: req.ip },
    })
    throw new AppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS')
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    await prisma.auditLog.create({
      data: { actorId: user.id, action: 'ADMIN_LOGIN_ROLE_DENIED', entityType: 'User', entityId: user.id, ipAddress: req.ip },
    })
    throw new AppError(403, 'Administrative sign-in is required for this account.', 'ADMIN_LOGIN_REQUIRED')
  }
  if (user.failedLoginAttempts || user.lockedUntil) {
    const unlocked = await prisma.user.updateMany({
      where: {
        id: user.id,
        status: 'ACTIVE',
        ...(hasAccountLockout(user.role) ? { OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] } : {}),
      },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    })
    if (unlocked.count !== 1) {
      throw new AppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS')
    }
  } else {
    const stillActive = await prisma.user.count({
      where: {
        id: user.id,
        status: 'ACTIVE',
        ...(hasAccountLockout(user.role) ? { OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] } : {}),
      },
    })
    if (stillActive !== 1) {
      throw new AppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS')
    }
  }
  await prisma.auditLog.create({
    data: { actorId: user.id, action: 'LOGIN_SUCCEEDED', entityType: 'User', entityId: user.id, ipAddress: req.ip },
  })
  return issueSession(user, res)
}

export function loginAdmin(input, req, res) {
  return login(input, req, res, ['ADMIN', 'SUPER_ADMIN'])
}

export async function refresh(token, res) {
  if (!token) throw new AppError(401, 'Refresh token is required.', 'INVALID_REFRESH_TOKEN')
  const tokenHash = hashToken(token)
  const current = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } })
  if (!current || current.revokedAt || current.expiresAt <= new Date() || current.user.status !== 'ACTIVE') {
    throw new AppError(401, 'Invalid or expired refresh token.', 'INVALID_REFRESH_TOKEN')
  }

  const replacement = randomToken()
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000)
  await prisma.$transaction(async (tx) => {
    const revoked = await tx.refreshToken.updateMany({
      where: { id: current.id, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    })
    if (revoked.count !== 1) throw new AppError(401, 'Invalid or expired refresh token.', 'INVALID_REFRESH_TOKEN')
    await tx.refreshToken.create({ data: { tokenHash: hashToken(replacement), userId: current.userId, expiresAt } })
  })
  setRefreshCookie(res, replacement)
  return { user: publicUser(current.user), accessToken: createAccessToken(current.user), tokenType: 'Bearer', expiresIn: env.JWT_ACCESS_TTL }
}

export async function logout(token, res) {
  if (token) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }
  res.clearCookie('refreshToken', { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'strict', path: '/api/auth' })
}

export async function changePassword(userId, input, req) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
    throw new AppError(400, 'Current password is incorrect.', 'INVALID_PASSWORD')
  }
  const passwordHash = await bcrypt.hash(input.newPassword, 12)
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } })
    await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
    await writeAudit(tx, req, { actorId: userId, action: 'PASSWORD_CHANGED', entityType: 'User', entityId: userId })
  })
}

export async function preparePasswordReset(email) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) return
  const token = randomToken()
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt } })
  // The token is deliberately not returned; production deployment must deliver it through a configured mail provider.
}

export async function verifyEmail(token, req) {
  const tokenHash = hashToken(token)
  const verification = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  })
  if (!verification || verification.usedAt || verification.expiresAt <= new Date()) {
    throw new AppError(400, 'Email verification link is invalid or expired.', 'INVALID_VERIFICATION_TOKEN')
  }

  await prisma.$transaction(async (tx) => {
    const consumed = await tx.emailVerificationToken.updateMany({
      where: { id: verification.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    })
    if (consumed.count !== 1) {
      throw new AppError(400, 'Email verification link is invalid or expired.', 'INVALID_VERIFICATION_TOKEN')
    }
    await tx.user.update({ where: { id: verification.userId }, data: { emailVerifiedAt: new Date() } })
    await writeAudit(tx, req, {
      actorId: verification.userId,
      action: 'EMAIL_VERIFIED',
      entityType: 'User',
      entityId: verification.userId,
    })
  })
}

const profileSelect = {
  id: true,
  fullName: true,
  email: true,
  contactNumber: true,
  role: true,
  permissions: true,
  profilePhotoStorageKey: true,
}

export async function getProfile(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: profileSelect })
  if (!user) throw new AppError(404, 'User account not found.', 'USER_NOT_FOUND')
  return publicUser(user)
}

export async function updateProfile(userId, input, req) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: input,
      select: profileSelect,
    })
    await writeAudit(tx, req, {
      action: 'USER_PROFILE_UPDATED',
      entityType: 'User',
      entityId: userId,
      metadata: { fields: Object.keys(input) },
    })
    return publicUser(user)
  })
}

export async function getProfilePhoto(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { profilePhotoStorageKey: true, profilePhotoMimeType: true },
  })
  if (!user?.profilePhotoStorageKey || !user.profilePhotoMimeType) {
    throw new AppError(404, 'Profile picture not found.', 'PROFILE_PHOTO_NOT_FOUND')
  }
  return {
    path: path.join(uploadDirectory, path.basename(user.profilePhotoStorageKey)),
    mimeType: user.profilePhotoMimeType,
  }
}

export async function updateProfilePhoto(userId, file, req) {
  if (!file) throw new AppError(400, 'Choose a profile picture to upload.', 'PROFILE_PHOTO_REQUIRED')
  if (file.size > 5 * 1024 * 1024) {
    throw new AppError(400, 'Profile pictures must be 5 MB or smaller.', 'PROFILE_PHOTO_TOO_LARGE')
  }

  const [savedFile] = await persistFiles([file])
  let updated
  try {
    updated = await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { profilePhotoStorageKey: true },
      })
      if (!current) throw new AppError(404, 'User account not found.', 'USER_NOT_FOUND')
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          profilePhotoStorageKey: savedFile.storageKey,
          profilePhotoMimeType: savedFile.mimeType,
        },
        select: { ...profileSelect, profilePhotoStorageKey: true },
      })
      await writeAudit(tx, req, {
        action: 'USER_PROFILE_PHOTO_UPDATED',
        entityType: 'User',
        entityId: userId,
      })
      return { user, previousStorageKey: current.profilePhotoStorageKey }
    })
  } catch (error) {
    await removeFiles([savedFile])
    throw error
  }

  if (updated.previousStorageKey) {
    await removeFiles([{ storageKey: updated.previousStorageKey }])
  }
  return { ...publicUser(updated.user), profilePhotoVersion: Date.now() }
}
