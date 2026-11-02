const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    isGuest: { type: Boolean, default: false },
    preferences: {
      timezone: { type: String, default: 'Asia/Kolkata' },
      weekStartsOn: { type: Number, enum: [0, 1], default: 0 },
      calendarView: { type: String, enum: ['month', 'week'], default: 'month' },
      focusMinutes: { type: Number, min: 1, max: 240, default: 25 },
      shortBreakMinutes: { type: Number, min: 1, max: 60, default: 5 },
      longBreakMinutes: { type: Number, min: 1, max: 120, default: 15 },
      browserNotifications: { type: Boolean, default: false },
      soundNotifications: { type: Boolean, default: false },
      reminderDefault: { type: String, enum: ['none', 'due', '10m', '30m', '1h', '1d'], default: 'none' },
      recurrenceDefault: { type: String, enum: ['none', 'daily', 'weekdays', 'weekly', 'monthly'], default: 'none' },
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
