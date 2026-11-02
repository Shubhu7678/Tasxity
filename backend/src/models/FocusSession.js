const mongoose = require('mongoose');

const focusSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  kind: { type: String, enum: ['focus', 'short_break', 'long_break'], default: 'focus', index: true },
  status: { type: String, enum: ['active', 'paused', 'completed', 'cancelled'], default: 'active', index: true },
  activeForUser: { type: mongoose.Schema.Types.ObjectId, unique: true, sparse: true },
  durationMinutes: { type: Number, min: 1, max: 240, required: true },
  remainingSeconds: { type: Number, min: 0, required: true },
  startedAt: { type: Date, required: true },
  endsAt: Date,
  pausedAt: Date,
  completedAt: Date,
  elapsedSeconds: { type: Number, default: 0 },
}, { timestamps: true });

focusSessionSchema.index({ user: 1, status: 1 });
focusSessionSchema.index({ user: 1, completedAt: 1 });
module.exports = mongoose.model('FocusSession', focusSessionSchema);
