const Task = require('../models/Task');
const Reminder = require('../models/Reminder');
const RecurringSeries = require('../models/RecurringSeries');

const dateOnly = (date) => new Date(date).toISOString().slice(0, 10);
const shiftDate = (dateString, days) => {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const zonedDateTime = (dateString, time, timezone) => {
  const [year, month, day] = dateString.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(guess)).reduce((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = Number(part.value);
      return acc;
    }, {});
    guess += target - Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  }
  return new Date(guess);
};

function nextDate(current, series) {
  const date = new Date(`${current}T12:00:00Z`);
  if (series.frequency === 'weekdays') {
    let remaining = series.interval || 1;
    while (remaining) {
      date.setUTCDate(date.getUTCDate() + 1);
      if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) remaining -= 1;
    }
  } else if (series.frequency === 'daily') date.setUTCDate(date.getUTCDate() + (series.interval || 1));
  else if (series.frequency === 'weekly') date.setUTCDate(date.getUTCDate() + 7 * (series.interval || 1));
  else if (series.frequency === 'monthly' || (series.frequency === 'custom' && series.unit === 'month')) {
    const anchorDay = series.monthDay || date.getUTCDate();
    const month = date.getUTCMonth() + (series.frequency === 'monthly' ? (series.interval || 1) : (series.interval || 1));
    const year = date.getUTCFullYear() + Math.floor(month / 12);
    const normalizedMonth = ((month % 12) + 12) % 12;
    return new Date(Date.UTC(year, normalizedMonth + 1, 0, 12)).getUTCDate() >= anchorDay
      ? `${year}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(anchorDay).padStart(2, '0')}`
      : `${year}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(new Date(Date.UTC(year, normalizedMonth + 1, 0)).getUTCDate()).padStart(2, '0')}`;
  } else {
    const multiplier = series.unit === 'week' ? 7 : 1;
    date.setUTCDate(date.getUTCDate() + (series.interval || 1) * multiplier);
  }
  return date.toISOString().slice(0, 10);
}

async function createSeries(userId, fields) {
  if (!fields.recurrence?.frequency) return fields;
  if (!fields.recurrence.endDate && !fields.recurrence.occurrenceLimit)
    throw Object.assign(new Error('Choose a recurrence end date or occurrence limit'), { status: 400 });
  const start = fields.dueDate ? dateOnly(fields.dueDate) : (fields.plannedDate || dateOnly(new Date()));
  const recurrence = { interval: 1, unit: 'day', timezone: 'Asia/Kolkata', ...fields.recurrence, active: true };
  let timezone;
  try { timezone = new Intl.DateTimeFormat('en-US', { timeZone: recurrence.timezone }); } catch { throw Object.assign(new Error('Invalid recurrence timezone'), { status: 400 }); }
  void timezone;
  const series = await RecurringSeries.create({
    user: userId, ...recurrence, occurrences: 1, nextDate: start,
    monthDay: Number(start.slice(-2)),
    template: {
      title: fields.title, description: fields.description, project: fields.project,
      projectId: fields.projectId, tag: fields.tag, priority: fields.priority, dueDate: fields.dueDate ? dateOnly(fields.dueDate) : null,
      plannedDate: fields.plannedDate, reminderOffset: fields.reminderOffset, customReminderAt: fields.customReminderAt,
      customReminderTime: fields.customReminderAt
        ? new Intl.DateTimeFormat('en-GB', { timeZone: recurrence.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(fields.customReminderAt))
        : null,
      subtasks: fields.subtasks?.map((subtask) => ({ title: subtask.title, completed: false })) || [],
    },
  });
  return { ...fields, recurrenceSeriesId: series._id, occurrenceDate: start };
}

async function scheduleReminder(task) {
  if (!task.dueDate || task.status === 'done' || !task.reminderOffset || task.reminderOffset === 'none') {
    await Reminder.deleteOne({ task: task._id, user: task.user });
    return;
  }
  const offsets = { due: 0, '10m': 10, '30m': 30, '1h': 60, '1d': 1440 };
  const due = new Date(task.dueDate);
  if (task.reminderOffset === 'custom' && !task.customReminderAt)
    throw Object.assign(new Error('Choose a custom reminder time'), { status: 400 });
  const remindAt = task.reminderOffset === 'custom' ? new Date(task.customReminderAt) : new Date(due.getTime() - (offsets[task.reminderOffset] ?? 0) * 60000);
  if (Number.isNaN(remindAt.getTime())) throw Object.assign(new Error('Invalid reminder time'), { status: 400 });
  await Reminder.findOneAndUpdate(
    { task: task._id, user: task.user },
    { $set: { remindAt, deliveredAt: null, dismissedAt: null, snoozedUntil: null } },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );
}

async function generateNext(task) {
  if (!task.recurrenceSeriesId || !task.occurrenceDate) return;
  const series = await RecurringSeries.findOne({ _id: task.recurrenceSeriesId, user: task.user, active: true });
  if (!series || series.nextDate !== task.occurrenceDate) return;
  if (series.occurrenceLimit && series.occurrences >= series.occurrenceLimit) {
    await RecurringSeries.updateOne({ _id: series._id, nextDate: series.nextDate }, { $set: { active: false } });
    return;
  }
  const occurrence = nextDate(task.occurrenceDate, series);
  if (series.endDate && occurrence > series.endDate) {
    await RecurringSeries.updateOne({ _id: series._id, nextDate: series.nextDate }, { $set: { active: false } });
    return;
  }
  const template = series.template;
  try {
    const created = await Task.create({
      ...template, user: task.user, projectId: template.projectId || undefined,
      dueDate: template.dueDate ? new Date(`${occurrence}T00:00:00Z`) : undefined,
      plannedDate: template.plannedDate ? occurrence : undefined,
      status: 'todo', order: await Task.countDocuments({ user: task.user, status: 'todo' }),
      recurrenceSeriesId: series._id, occurrenceDate: occurrence,
      recurrence: { frequency: series.frequency, interval: series.interval, unit: series.unit, endDate: series.endDate, occurrenceLimit: series.occurrenceLimit, timezone: series.timezone, active: true },
      completedAt: undefined, focusDate: undefined,
      reminderOffset: template.reminderOffset || 'none',
      customReminderAt: template.customReminderTime ? zonedDateTime(occurrence, template.customReminderTime, series.timezone) : undefined,
      subtasks: (template.subtasks || []).map((subtask) => ({ ...subtask, completed: false })),
    });
    await series.updateOne({ $set: { nextDate: occurrence }, $inc: { occurrences: 1 } });
    await scheduleReminder(created);
  } catch (error) {
    if (error.code !== 11000) throw error;
    await series.updateOne({ $set: { nextDate: occurrence }, $inc: { occurrences: 1 } });
  }
}

module.exports = { createSeries, scheduleReminder, generateNext, nextDate, shiftDate, zonedDateTime };
