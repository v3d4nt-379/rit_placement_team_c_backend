const mongoose = require('mongoose');

const RankedCandidateSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      ref: 'Student',
      required: true
    },
    applicationId: {
      type: String,
      ref: 'Application',
      required: true
    },
    rank: {
      type: Number,
      required: true,
      min: 1
    },
    totalScore: {
      type: Number,
      required: true
    }
  },
  { _id: false }
);

const DriveRankingSchema = new mongoose.Schema(
  {
    driveId: {
      type: String,
      ref: 'Drive',
      required: true
    },

    rankingId: {
      type: String,
      required: true,
      unique: true
    },

    algorithm: {
      type: String,
      required: true
    },

    graphVersion: {
      type: String,
      required: true
    },

    tieBreakRule: {
      type: String,
      required: true
    },

    rankedCandidates: {
      type: [RankedCandidateSchema],
      required: true,
      default: []
    },

    isLatest: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Unique partial index: Guarantees at the database level that only one document per drive can have isLatest: true
DriveRankingSchema.index(
  { driveId: 1 },
  {
    unique: true,
    partialFilterExpression: { isLatest: true },
    name: 'unique_latest_drive_ranking'
  }
);
DriveRankingSchema.index({ driveId: 1, createdAt: -1 });

module.exports = mongoose.model('DriveRanking', DriveRankingSchema);


