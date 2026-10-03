const mongoose = require('mongoose');

const OfferSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true
    },

    applicationId: {
      type: String,
      ref: 'Application',
      required: true,
      unique: true
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

    packageOffered: {
      type: Number,
      required: true
    },

    offerLetterUrl: {
      type: String
    },

    status: {
      type: String,
      enum: [
        'OFFER_ISSUED',
        'ACCEPTED',
        'REJECTED',
        'REVOKED'
      ],
      default: 'OFFER_ISSUED'
    },

    issuedAt: {
      type: Date,
      default: Date.now
    },

    respondedAt: {
      type: Date
    },

    decisionId: {
      type: String
    },

    leaseId: {
      type: String
    },

    rankingId: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Offer', OfferSchema);