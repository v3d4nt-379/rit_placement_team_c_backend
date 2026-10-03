const mongoose = require('mongoose');

const EligibilitySchema = new mongoose.Schema(
  {
    requestId: { type: String },
    decisionId: { type: String },
    result: {
      type: String,
      enum: ['ELIGIBLE', 'CONDITIONAL', 'NOT_ELIGIBLE']
    },
    ruleSetVersion: { type: String },
    failedRules: [{ type: String }],
    leaseId: { type: String }
  },
  { _id: false }
);

const ApplicationSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true
    },

    studentId: {
      type: String,
      ref: 'Student',
      required: true
    },

    driveId: {
      type: String,
      ref: 'Drive',
      required: true
    },

    idempotencyKey: {
      type: String,
      required: true
    },

    state: {
      type: String,
      enum: [
        'APPLIED',
        'SCREENING',
        'RULE_EVALUATED',
        'SHORTLISTED',
        'INTERVIEW_SCHEDULED',
        'SELECTED',
        'OFFER_ISSUED',
        'WAITLISTED',
        'NOT_ELIGIBLE',
        'WITHDRAWN',
        'EXPIRED',
        'REJECTED',
        'COMPENSATION_REQUIRED'
      ],
      default: 'APPLIED'
    },

    eligibility: EligibilitySchema,

    rankingId: {
      type: String
    },

    rankingStatus: {
      type: String,
      enum: ['PENDING', 'READY', 'DEGRADED'],
      default: 'PENDING'
    },

    version: {
      type: Number,
      default: 1
    }
  },
  {
    timestamps: true
  }
);

// One application per student per drive
ApplicationSchema.index(
  { studentId: 1, driveId: 1 },
  { unique: true }
);

// Retry with same idempotency key must not create another application
ApplicationSchema.index(
  { idempotencyKey: 1 },
  { unique: true }
);

module.exports = mongoose.model('Application', ApplicationSchema);