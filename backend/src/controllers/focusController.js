const mongoose = require('mongoose');
const FocusSession = require('../models/FocusSession');
const Task = require('../models/Task');
const Project = require('../models/Project');

exports.active = async (req, res) => {
  const session = await FocusSession.findOne({ user: req.user._id, status: { $in: ['active', 'paused'] } }).populate('task', 'title project');
  res.json({ session });
};

exports.start = async (req, res) => {
  const { taskId, durationMinutes, kind = 'focus' } = req.body;
  if (!['focus', 'short_break', 'long_break'].includes(kind)) return res.status(400).json({ message: 'Invalid focus session type' });
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 240)
    return res.status(400).json({ message: 'Focus duration must be from 1 to 240 minutes' });
  if (taskId && !mongoose.isValidObjectId(taskId)) return res.status(400).json({ message: 'Invalid task ID' });
  if (taskId && kind !== 'focus') return res.status(400).json({ message: 'Break sessions cannot be linked to a task' });
  const existing = await FocusSession.findOne({ user: req.user._id, status: { $in: ['active', 'paused'] } });
  if (existing) return res.status(409).json({ message: 'A focus session is already active' });
  const task = taskId ? await Task.findOne({ _id: taskId, user: req.user._id }) : null;
  if (taskId && !task) return res.status(404).json({ message: 'Task not found' });
  const now = new Date();
  let session;
  try { session = await FocusSession.create({
    user: req.user._id, task: task?._id, project: task?.projectId, kind,
    activeForUser: req.user._id,
    durationMinutes, remainingSeconds: durationMinutes * 60,
    startedAt: now, endsAt: new Date(now.getTime() + durationMinutes * 60000),
  }); } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'A focus session is already active' });
    throw error;
  }
  res.status(201).json({ session });
};

exports.control = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid session ID' });
  const session = await FocusSession.findOne({ _id: req.params.id, user: req.user._id });
  if (!session) return res.status(404).json({ message: 'Focus session not found' });
  const { action } = req.body;
  const now = new Date();
  if (action === 'pause' && session.status === 'active') {
    session.remainingSeconds = Math.max(0, Math.ceil((session.endsAt - now) / 1000));
    session.elapsedSeconds = session.durationMinutes * 60 - session.remainingSeconds;
    session.status = 'paused'; session.pausedAt = now; session.endsAt = null;
  } else if (action === 'resume' && session.status === 'paused') {
    session.status = 'active'; session.pausedAt = null;
    session.endsAt = new Date(now.getTime() + session.remainingSeconds * 1000);
  } else if (action === 'finish' && ['active', 'paused'].includes(session.status)) {
    const remaining = session.status === 'active' ? Math.max(0, Math.ceil((session.endsAt - now) / 1000)) : session.remainingSeconds;
    session.elapsedSeconds = Math.max(0, session.durationMinutes * 60 - remaining);
    session.remainingSeconds = remaining;
    session.status = 'completed'; session.completedAt = now; session.endsAt = null; session.activeForUser = undefined;
  } else if (action === 'cancel' && ['active', 'paused'].includes(session.status)) {
    session.status = 'cancelled'; session.endsAt = null; session.activeForUser = undefined;
  } else return res.status(409).json({ message: 'This focus session cannot perform that action' });
  await session.save();
  res.json({ session });
};

exports.summary = async (req, res) => {
  const timezone = req.query.timezone || 'UTC';
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); } catch { return res.status(400).json({ message: 'Invalid timezone' }); }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - 6 + i); return date.toISOString().slice(0, 10);
  });
  const queryStart = new Date(`${days[0]}T00:00:00Z`);
  queryStart.setUTCDate(queryStart.getUTCDate() - 1);
  const sessions = await FocusSession.find({ user: req.user._id, kind: 'focus', status: 'completed', completedAt: { $gte: queryStart } })
    .sort({ completedAt: -1 }).limit(500).populate('project', 'name');
  const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const sessionsInRange = sessions.filter((session) => days.includes(dateFormatter.format(session.completedAt)));
  const byDay = days.map((date) => ({ date, minutes: Math.round(sessionsInRange.filter((s) => dateFormatter.format(s.completedAt) === date).reduce((sum, s) => sum + s.elapsedSeconds, 0) / 60) }));
  const byProjectMap = new Map();
  sessionsInRange.forEach((s) => { const name = s.project?.name || 'Personal'; byProjectMap.set(name, (byProjectMap.get(name) || 0) + s.elapsedSeconds); });
  const todayMinutes = byDay.at(-1)?.minutes || 0;
  res.json({ todayMinutes, weekMinutes: Math.round(sessionsInRange.reduce((sum, s) => sum + s.elapsedSeconds, 0) / 60),
    completedSessions: await FocusSession.countDocuments({ user: req.user._id, kind: 'focus', status: 'completed' }),
    byDay, byProject: [...byProjectMap].map(([project, seconds]) => ({ project, minutes: Math.round(seconds / 60) })) });
};
