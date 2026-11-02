const jwt = require('jsonwebtoken');
const { randomBytes, randomUUID } = require('crypto');
const User = require('../models/User');

const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const payload = (u) => ({ user: { id: u._id, name: u.name, email: u.email, preferences: u.preferences, isGuest: u.isGuest }, token: sign(u._id) });
const validEmail = (e) => /^\S+@\S+\.\S+$/.test(e);

exports.signup = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !validEmail(email) || !password || password.length < 6)
    return res.status(400).json({ message: 'Name, valid email and a password of 6+ characters are required' });
  if (await User.findOne({ email: email.toLowerCase() }))
    return res.status(409).json({ message: 'Email already registered' });
  const user = await User.create({ name, email, password });
  res.status(201).json(payload(user));
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
  if (!user || !(await user.matchPassword(password)))
    return res.status(401).json({ message: 'Invalid email or password' });
  res.json(payload(user));
};

exports.guest = async (_req, res) => {
  const guestId = randomUUID();
  const user = await User.create({
    name: 'Tasxity Guest',
    email: `guest-${guestId}@guest.tasxity.invalid`,
    password: randomBytes(32).toString('hex'),
    isGuest: true,
  });
  res.status(201).json(payload(user));
};

exports.me = (req, res) =>
  res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email, preferences: req.user.preferences, isGuest: req.user.isGuest } });

exports.preferences = async (req, res) => {
  const { timezone, weekStartsOn, calendarView, focusMinutes, shortBreakMinutes, longBreakMinutes, browserNotifications, soundNotifications, reminderDefault, recurrenceDefault } = req.body;
  const updates = {};
  if (timezone !== undefined) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); }
    catch { return res.status(400).json({ message: 'Invalid timezone' }); }
    updates['preferences.timezone'] = timezone;
  }
  if (weekStartsOn !== undefined) {
    if (![0, 1].includes(weekStartsOn)) return res.status(400).json({ message: 'Week start must be Sunday (0) or Monday (1)' });
    updates['preferences.weekStartsOn'] = weekStartsOn;
  }
  if (calendarView !== undefined) {
    if (!['month', 'week'].includes(calendarView)) return res.status(400).json({ message: 'Calendar view must be month or week' });
    updates['preferences.calendarView'] = calendarView;
  }
  for (const [key, value, max] of [
    ['focusMinutes', focusMinutes, 240], ['shortBreakMinutes', shortBreakMinutes, 60], ['longBreakMinutes', longBreakMinutes, 120],
  ]) {
    if (value !== undefined) {
      if (!Number.isInteger(value) || value < 1 || value > max) return res.status(400).json({ message: `Invalid ${key}` });
      updates[`preferences.${key}`] = value;
    }
  }
  for (const [key, value] of [['browserNotifications', browserNotifications], ['soundNotifications', soundNotifications]]) {
    if (value !== undefined) {
      if (typeof value !== 'boolean') return res.status(400).json({ message: `Invalid ${key}` });
      updates[`preferences.${key}`] = value;
    }
  }
  if (reminderDefault !== undefined) {
    if (!['none', 'due', '10m', '30m', '1h', '1d'].includes(reminderDefault)) return res.status(400).json({ message: 'Invalid reminder default' });
    updates['preferences.reminderDefault'] = reminderDefault;
  }
  if (recurrenceDefault !== undefined) {
    if (!['none', 'daily', 'weekdays', 'weekly', 'monthly'].includes(recurrenceDefault)) return res.status(400).json({ message: 'Invalid recurrence default' });
    updates['preferences.recurrenceDefault'] = recurrenceDefault;
  }
  const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { returnDocument: 'after', runValidators: true });
  res.json({ preferences: user.preferences });
};
