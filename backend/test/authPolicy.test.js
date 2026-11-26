import test from 'node:test'
import assert from 'node:assert/strict'
import { hasAccountLockout, isAccountLocked } from '../src/utils/authPolicy.js'

test('super-admin accounts do not use failed-login lockouts', () => {
  const now = new Date()
  const superAdmin = {
    role: 'SUPER_ADMIN',
    lockedUntil: new Date(now.getTime() + 15 * 60 * 1000),
  }

  assert.equal(hasAccountLockout(superAdmin.role), false)
  assert.equal(isAccountLocked(superAdmin, now), false)
})

test('other roles retain failed-login lockouts', () => {
  const now = new Date()
  const admin = {
    role: 'ADMIN',
    lockedUntil: new Date(now.getTime() + 15 * 60 * 1000),
  }

  assert.equal(hasAccountLockout(admin.role), true)
  assert.equal(isAccountLocked(admin, now), true)
})
