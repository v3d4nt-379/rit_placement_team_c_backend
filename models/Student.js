const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Maps to studentId
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  branch: { type: String, required: true }, // Mapped directly to Team A's 'branch'
  academic: {
    cgpa: { type: Number, required: true },
    backlogs: { type: Number, default: 0 },
    attendancePct: { type: Number, required: true, default: 100.0 }, 
    aptitudeScore: { type: Number, default: 0 }, // Optional for future rules
    batch: { type: Number, required: true }
  },
  skills: [{ type: String }], // Maps to List<String> skills
  resumes: [{
    version: { type: Number, required: true },
    url: { type: String, required: true }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Student', StudentSchema);