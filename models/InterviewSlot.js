const mongoose = require('mongoose');

// Embedded lease mapping to Team A's SlotLease
const SlotLeaseSchema = new mongoose.Schema({
  leaseId: { type: String },
  holderId: { type: String, ref: 'Student' },
  createdAt: { type: Date },
  expiresAt: { type: Date },
  status: { type: String, enum: ['ACTIVE', 'RELEASED', 'EXPIRED'] }
}, { _id: false });

const InterviewSlotSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Maps to slotId
  driveId: { type: String, ref: 'Drive', required: true },
  date: { type: String, required: true }, // e.g., "YYYY-MM-DD"
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  capacity: { type: Number, default: 1 },
  currentHolder: { type: String, ref: 'Student' }, // Maps to holderId
  
  // Maps to Team A's SlotState
  state: { 
    type: String, 
    enum: ['AVAILABLE', 'LOCKED', 'BOOKED'], 
    default: 'AVAILABLE' 
  },
  
  lease: SlotLeaseSchema,
  version: { type: Number, default: 1 } // Optimistic locking for concurrency
}, { timestamps: true });

// Prevent double-booking a slot at the database level
InterviewSlotSchema.index({ driveId: 1, date: 1, startTime: 1 });

module.exports = mongoose.model('InterviewSlot', InterviewSlotSchema);