const mongoose = require('mongoose');

const EligibilityRuleSchema = new mongoose.Schema(
  {
    ruleId: {
      type: String,
      required: true
    },

    ruleType: {
      type: String,
      enum: [
        'min_cgpa',
        'max_backlogs',
        'allowed_branches',
        'min_attendance',
        'required_skills'
      ],
      required: true
    },

    threshold: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },

    weight: {
      type: Number,
      default: 1.0
    }
  },
  { _id: false }
);

const DriveSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true
    },

    company: {
      type: String,
      required: true
    },

    package: {
      type: Number,
      required: true
    },

    seats: {
      type: Number,
      required: true,
      min: 0
    },

    ruleSet: {
      version: {
        type: String,
        default: 'v1.0'
      },

      rules: {
        type: [EligibilityRuleSchema],
        default: []
      }
    },

    state: {
      type: String,
      enum: ['ACTIVE', 'CLOSED'],
      default: 'ACTIVE'
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

DriveSchema.index({
  state: 1,
  createdAt: -1
});

module.exports = mongoose.model('Drive', DriveSchema);