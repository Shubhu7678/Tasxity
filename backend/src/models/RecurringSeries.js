const mongoose = require('mongoose');

const seriesSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  active: { type: Boolean, default: true },
  frequency: { type: String, enum: ['daily', 'weekdays', 'weekly', 'monthly', 'custom'], required: true },
  interval: { type: Number, min: 1, max: 365, default: 1 },
  unit: { type: String, enum: ['day', 'week', 'month'], default: 'day' },
  timezone: { type: String, default: 'Asia/Kolkata' },
  endDate: String,
  occurrenceLimit: { type: Number, min: 1, max: 365 },
  occurrences: { type: Number, default: 1 },
  nextDate: { type: String, required: true },
  monthDay: { type: Number, min: 1, max: 31 },
  template: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

module.exports = mongoose.model('RecurringSeries', seriesSchema);
