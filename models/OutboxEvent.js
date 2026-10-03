const mongoose = require('mongoose');

const OutboxEventSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true
    },

    correlationId: {
      type: String,
      required: true
    },

    eventType: {
      type: String,
      required: true
    },

    aggregateType: {
      type: String,
      required: true
    },

    aggregateId: {
      type: String,
      required: true
    },

    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },

    isPublished: {
      type: Boolean,
      default: false
    },

    createdAt: {
      type: Date,
      default: Date.now
    },

    publishedAt: {
      type: Date
    }
  }
);

OutboxEventSchema.index({
  isPublished: 1,
  createdAt: 1
});

OutboxEventSchema.index({
  correlationId: 1
});

module.exports = mongoose.model(
  'OutboxEvent',
  OutboxEventSchema
);