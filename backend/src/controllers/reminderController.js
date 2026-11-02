const Reminder = require('../models/Reminder');
const Task = require('../models/Task');
const mongoose = require('mongoose');
const validDateOnly = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

const zonedDateTime = (date, time, timezone) => {
  const [year, month, day] = date.split('-').map(Number);
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

exports.list = async (req, res) => {
  const due = await Reminder.find({ user: req.user._id, remindAt: { $lte: new Date() }, deliveredAt: null, dismissedAt: null })
    .sort({ remindAt: 1 }).limit(25).select('_id task');
  const notifications = [];
  for (const reminder of due) {
    const task = await Task.findOne({ _id: reminder.task, user: req.user._id, status: { $ne: 'done' } }).select('title dueDate project');
    if (!task) { await Reminder.deleteOne({ _id: reminder._id, user: req.user._id }); continue; }
    const delivered = await Reminder.findOneAndUpdate(
      { _id: reminder._id, user: req.user._id, deliveredAt: null, dismissedAt: null },
      { $set: { deliveredAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (delivered) notifications.push({ ...delivered.toObject(), task });
  }
  const recent = await Reminder.find({
    user: req.user._id, deliveredAt: { $gte: new Date(Date.now() - 86400000) }, dismissedAt: null,
  }).sort({ deliveredAt: -1 }).limit(30).populate({ path: 'task', select: 'title dueDate project status', match: { status: { $ne: 'done' } } });
  const upcoming = await Reminder.find({
    user: req.user._id, remindAt: { $gt: new Date(), $lte: new Date(Date.now() + 7 * 86400000) },
    deliveredAt: null, dismissedAt: null,
  }).sort({ remindAt: 1 }).limit(20).populate({ path: 'task', select: 'title dueDate project status', match: { status: { $ne: 'done' } } });
  res.json({ notifications: recent.filter((r) => r.task), newlyDelivered: notifications, upcoming: upcoming.filter((r) => r.task) });
};

exports.update = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid reminder ID' });
  const reminder = await Reminder.findOne({ _id: req.params.id, user: req.user._id });
  if (!reminder) return res.status(404).json({ message: 'Reminder not found' });
  const task = await Task.findOne({ _id: reminder.task, user: req.user._id });
  if (!task || task.status === 'done') {
    await Reminder.deleteOne({ _id: reminder._id, user: req.user._id });
    return res.status(410).json({ message: 'This task no longer needs a reminder' });
  }
  const { action, minutes, remindAt, timezone } = req.body;
  if (action === 'dismiss') {
    reminder.dismissedAt = new Date();
    await reminder.save();
    return res.json({ message: 'Reminder dismissed' });
  }
  if (action !== 'snooze') return res.status(400).json({ message: 'Invalid reminder action' });
  let until;
  if (minutes === 'tomorrow') {
    try { new Intl.DateTimeFormat('en-US', { timeZone: timezone || 'UTC' }); }
    catch { return res.status(400).json({ message: 'Invalid timezone' }); }
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const next = new Date(`${parts}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    until = zonedDateTime(next.toISOString().slice(0, 10), '09:00', timezone || 'UTC');
  } else if (minutes === 'custom') {
    if (typeof remindAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(remindAt)) {
      const [hour, minute] = remindAt.slice(11).split(':').map(Number);
      if (!validDateOnly(remindAt.slice(0, 10)) || hour > 23 || minute > 59)
        return res.status(400).json({ message: 'Choose a valid custom reminder time' });
      try { new Intl.DateTimeFormat('en-US', { timeZone: timezone || 'UTC' }); }
      catch { return res.status(400).json({ message: 'Invalid timezone' }); }
      until = zonedDateTime(remindAt.slice(0, 10), remindAt.slice(11), timezone || 'UTC');
    } else until = new Date(remindAt);
    if (!remindAt || Number.isNaN(until.getTime()) || until <= new Date()) return res.status(400).json({ message: 'Choose a future reminder time' });
  } else {
    if (![10, 60].includes(Number(minutes))) return res.status(400).json({ message: 'Snooze must be 10 or 60 minutes' });
    until = new Date(Date.now() + Number(minutes) * 60000);
  }
  reminder.remindAt = until;
  reminder.snoozedUntil = until;
  reminder.deliveredAt = null;
  await reminder.save();
  res.json({ reminder });
};
