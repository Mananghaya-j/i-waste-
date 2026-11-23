export function writeAudit(tx, req, { actorId = req.user?.id, action, entityType, entityId, metadata = {} }) {
  return tx.auditLog.create({
    data: {
      actorId: actorId || null,
      action,
      entityType,
      entityId: entityId || null,
      metadata,
      ipAddress: req.ip,
    },
  })
}
