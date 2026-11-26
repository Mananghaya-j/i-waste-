export function hasAccountLockout(role) {
  return role !== 'SUPER_ADMIN'
}

export function isAccountLocked(user, now) {
  return hasAccountLockout(user.role) && Boolean(user.lockedUntil && user.lockedUntil > now)
}
