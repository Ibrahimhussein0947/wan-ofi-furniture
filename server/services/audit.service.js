const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

// Captures who is acting, from where. Services receive this instead of `req`.
function actorFrom(req) {
  return {
    user: req.user
      ? { _id: req.user._id, name: req.user.name, role: req.user.role, workerRole: req.user.workerRole, permissions: req.user.permissions, branch: req.user.branch }
      : null,
    ip: req.ip,
    userAgent: req.get?.('user-agent'),
  };
}

/**
 * Records an audit entry. Failures are logged but never break the business operation
 * that triggered them.
 */
async function audit(actor, { action, entity, entityId, reference, description, amount, changes }) {
  try {
    await AuditLog.create({
      user: actor?.user?._id,
      userName: actor?.user?.name,
      userRole: actor?.user?.role,
      action,
      entity,
      entityId,
      reference,
      description,
      amount,
      changes,
      ip: actor?.ip,
      userAgent: actor?.userAgent?.slice(0, 300),
    });
  } catch (err) {
    logger.error('Audit log write failed:', err.message);
  }
}

// Shallow diff of the fields that actually changed, for UPDATE entries.
function diff(before, after, fields) {
  const changes = {};
  for (const f of fields) {
    const a = before?.[f];
    const b = after?.[f];
    if (JSON.stringify(a) !== JSON.stringify(b)) changes[f] = { from: a, to: b };
  }
  return Object.keys(changes).length ? changes : undefined;
}

module.exports = { audit, actorFrom, diff };
