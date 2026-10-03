const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true
    },

    correlationId: {
      type: String,
      required: true
    },

    actorId: {
      type: String
    },

    actorRole: {
      type: String,
      required: true
    },

    action: {
      type: String,
      required: true
    },

    entityName: {
      type: String,
      required: true
    },

    entityId: {
      type: String,
      required: true
    },

    sourceService: {
      type: String,
      enum: ['TEAM_A', 'TEAM_B', 'TEAM_C', 'TEAM_D'],
      default: 'TEAM_C'
    },

    beforeState: {
      type: mongoose.Schema.Types.Mixed
    },

    afterState: {
      type: mongoose.Schema.Types.Mixed
    },

    timestamp: {
      type: Date,
      default: Date.now
    }
  }
);

AuditLogSchema.index({ correlationId: 1 });
AuditLogSchema.index({ entityName: 1, entityId: 1 });
AuditLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);