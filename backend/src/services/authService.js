import { createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { AppError } from '../utils/errors.js'
import { randomToken } from '../utils/reference.js'
import { writeAudit } from '../utils/audit.js'

const hashToken = (token) => createHash('sha256').update(token).digest('hex')
const publicUser = ({ id, fullName, email, contactNumber, role }) => ({ id, fullName, email, contactNumber, role })

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

async function issueSession(user, res) {
  const refreshToken = randomToken()
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000)
  await prisma.refreshToken.create({ data: { tokenHash: hashToken(refreshToken), userId: user.id, expiresAt } })
  setRefreshCookie(res, refreshToken)
  return { user: publicUser(user), accessToken: createAccessToken(user), tokenType: 'Bearer', expiresIn: env.JWT_ACCESS_TTL }
}

export async function register(input, req, res) {
  const passwordHash = await bcrypt.hash(input.password, 12)
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { fullName: input.fullName, email: input.email, contactNumber: input.contactNumber, passwordHash },
    })
    await writeAudit(tx, req, { actorId: created.id, action: 'USER_REGISTERED', entityType: 'User', entityId: created.id })
    return created
  })
  const session = await issueSession(user, res)
  return session
}

export async function login(input, req, res) {
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  if (!user || user.status !== 'ACTIVE' || !(await bcrypt.compare(input.password, user.passwordHash))) {
    await prisma.auditLog.create({
      data: { action: 'LOGIN_FAILED', entityType: 'User', metadata: {}, ipAddress: req.ip },
    })
    throw new AppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS')
  }
  await prisma.auditLog.create({
    data: { actorId: user.id, action: 'LOGIN_SUCCEEDED', entityType: 'User', entityId: user.id, ipAddress: req.ip },
  })
  return issueSession(user, res)
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
