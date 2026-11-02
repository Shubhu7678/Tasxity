const mongoose = require('mongoose');

const subtaskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  completed: { type: Boolean, default: false },
});
const recurrenceSchema = new mongoose.Schema({
  frequency: { type: String, enum: ['daily', 'weekdays', 'weekly', 'monthly', 'custom'] },
  interval: { type: Number, min: 1, max: 365, default: 1 },
  unit: { type: String, enum: ['day', 'week', 'month'], default: 'day' },
  endDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  occurrenceLimit: { type: Number, min: 1, max: 365 },
  timezone: { type: String, default: 'Asia/Kolkata' },
  active: { type: Boolean, default: true },
}, { _id: false });

const taskSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    project: { type: String, default: 'Personal', trim: true },
    tag: { type: String, default: '', trim: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['todo', 'in_progress', 'in-progress', 'review', 'done'], default: 'todo' },
    order: { type: Number, default: 0 },
    subtasks: { type: [subtaskSchema], default: [] },
    completedAt: Date,
    dueDate: Date,
    plannedDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    focusDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    recurrence: recurrenceSchema,
    recurrenceSeriesId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringSeries', index: true },
    occurrenceDate: String,
    reminderOffset: { type: String, enum: ['none', 'due', '10m', '30m', '1h', '1d', 'custom'], default: 'none' },
    customReminderAt: Date,
  },
  { timestamps: true }
);

taskSchema.index({ user: 1, status: 1, order: 1 });
taskSchema.index({ user: 1, dueDate: 1 });
taskSchema.index({ user: 1, plannedDate: 1 });
taskSchema.index({ user: 1, focusDate: 1 });
taskSchema.index({ recurrenceSeriesId: 1, occurrenceDate: 1 }, { unique: true, partialFilterExpression: { recurrenceSeriesId: { $exists: true } } });

module.exports = mongoose.model('Task', taskSchema);
