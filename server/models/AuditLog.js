const mongoose = require('mongoose');
const { AUDIT_ACTIONS } = require('../config/constants');

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    userName: String,
    userRole: String,
    action: { type: String, enum: Object.values(AUDIT_ACTIONS), required: true, index: true },
    entity: { type: String, index: true },
    entityId: mongoose.Schema.Types.ObjectId,
    reference: String,
    description: String,
    amount: Number,
    changes: mongoose.Schema.Types.Mixed,
    ip: String,
    userAgent: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
