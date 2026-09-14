const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
  },
  entityType: {
    type: String,
    required: true, // 'hostel', 'user', 'rule', 'payment', etc.
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  changes: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
  },
  ipAddress: String,
  userAgent: String,
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ performedBy: 1, timestamp: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
