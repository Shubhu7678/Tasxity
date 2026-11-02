const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, unique: true },
  remindAt: { type: Date, required: true, index: true },
  deliveredAt: Date,
  dismissedAt: Date,
  snoozedUntil: Date,
}, { timestamps: true });

reminderSchema.index({ user: 1, remindAt: 1, dismissedAt: 1 });
module.exports = mongoose.model('Reminder', reminderSchema);
