const Task = require('../models/Task');
const Project = require('../models/Project');
const RecurringSeries = require('../models/RecurringSeries');
const Reminder = require('../models/Reminder');
const BulkTaskBatch = require('../models/BulkTaskBatch');
const automation = require('../services/taskAutomation');

const FIELDS = ['title', 'description', 'project', 'projectId', 'tag', 'priority', 'status', 'dueDate', 'plannedDate', 'focusDate', 'completedAt', 'subtasks', 'order', 'recurrence', 'reminderOffset', 'customReminderAt'];
const pick = (body) => Object.fromEntries(FIELDS.filter((k) => k in body).map((k) => [k, body[k]]));
const STATUSES = new Set(['todo', 'in_progress', 'in-progress', 'review', 'done']);
const PRIORITIES = new Set(['low', 'medium', 'high']);
const normalize = (task) => ({ ...task, status: task.status === 'in-progress' ? 'in_progress' : task.status });
const validId = (id) => require('mongoose').isValidObjectId(id);
const validDateOnly = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const validDate = (value) => value === null || value === '' || (typeof value === 'string' && !Number.isNaN(new Date(value).getTime()));
const validateRecurrence = (recurrence) => {
  if (!recurrence?.frequency) return 'Choose a recurrence frequency';
  if (!['daily', 'weekdays', 'weekly', 'monthly', 'custom'].includes(recurrence.frequency)) return 'Invalid recurrence frequency';
  const interval = recurrence.interval === undefined ? 1 : recurrence.interval;
  if (!Number.isInteger(interval) || interval < 1 || interval > 365) return 'Invalid recurrence interval';
  if (!['day', 'week', 'month'].includes(recurrence.unit || 'day')) return 'Invalid recurrence interval unit';
  if (recurrence.endDate && !validDateOnly(recurrence.endDate)) return 'Invalid recurrence end date';
  if (recurrence.occurrenceLimit !== undefined && (!Number.isInteger(recurrence.occurrenceLimit) || recurrence.occurrenceLimit < 1 || recurrence.occurrenceLimit > 365)) return 'Occurrence limit must be from 1 to 365';
  if (!recurrence.endDate && !recurrence.occurrenceLimit) return 'Choose a recurrence end date or occurrence limit';
  try { new Intl.DateTimeFormat('en-US', { timeZone: recurrence.timezone || 'Asia/Kolkata' }); }
  catch { return 'Invalid recurrence timezone'; }
  return '';
};
const validateReminder = (body, existing = {}) => {
  const offset = body.reminderOffset === undefined ? existing.reminderOffset || 'none' : body.reminderOffset;
  const dueDate = body.dueDate === undefined ? existing.dueDate : body.dueDate;
  const customReminderAt = body.customReminderAt === undefined ? existing.customReminderAt : body.customReminderAt;
  if (!['none', 'due', '10m', '30m', '1h', '1d', 'custom'].includes(offset)) return 'Invalid reminder setting';
  if ('dueDate' in body && !body.dueDate && body.reminderOffset === undefined) return '';
  if (offset !== 'none' && !dueDate) return 'A due date is required to set a reminder';
  if (offset === 'custom' && (!customReminderAt || Number.isNaN(new Date(customReminderAt).getTime()))) return 'Choose a valid custom reminder time';
  return '';
};
const localDate = (date, timezone) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

exports.summary = async (req, res) => {
  const timezone = req.query.timezone || 'Asia/Kolkata';
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); }
  catch { return res.status(400).json({ message: 'Invalid timezone' }); }
  const today = localDate(new Date(), timezone);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const grouped = await Task.aggregate([
    { $match: { user: req.user._id } },
    { $project: {
      status: 1, dueDay: { $cond: ['$dueDate', { $dateToString: { date: '$dueDate', format: '%Y-%m-%d' } }, null] },
      completedDay: { $cond: ['$completedAt', { $dateToString: { date: '$completedAt', format: '%Y-%m-%d', timezone } }, null] },
      completedAt: 1,
    } },
    { $group: { _id: null, total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
      inProgress: { $sum: { $cond: [{ $in: ['$status', ['in_progress', 'in-progress']] }, 1, 0] } },
      overdue: { $sum: { $cond: [{ $and: [{ $ne: ['$status', 'done'] }, { $ne: ['$dueDay', null] }, { $lt: ['$dueDay', today] }] }, 1, 0] } },
      dueToday: { $sum: { $cond: [{ $eq: ['$dueDay', today] }, 1, 0] } },
      completedLast7Days: { $sum: { $cond: [{ $and: [{ $ne: ['$completedAt', null] }, { $gte: ['$completedDay', week[0]] }] }, 1, 0] } },
      rows: { $push: { completedDay: '$completedDay' } } } },
  ]);
  const result = grouped[0] || { total: 0, completed: 0, inProgress: 0, overdue: 0, dueToday: 0, completedLast7Days: 0, rows: [] };
  const weekly = week.map((date) => ({ date, count: result.rows.filter((row) => row.completedDay === date).length }));
  res.json({ total: result.total, completed: result.completed, inProgress: result.inProgress,
    overdue: result.overdue, dueToday: result.dueToday,
    completionPercent: result.total ? Math.round((result.completed / result.total) * 100) : 0,
    completedLast7Days: result.completedLast7Days, weekly });
};

exports.myDay = async (req, res) => {
  const { date } = req.query;
  if (!validDateOnly(date || '')) return res.status(400).json({ message: 'A valid date is required' });
  const timezone = req.query.timezone || 'Asia/Kolkata';
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); } catch { return res.status(400).json({ message: 'Invalid timezone' }); }
  const start = new Date(`${date}T00:00:00Z`), end = new Date(`${date}T23:59:59.999Z`);
  const tasks = await Task.find({ user: req.user._id, $or: [
    { plannedDate: date }, { focusDate: date }, { dueDate: { $gte: start, $lte: end } },
    { dueDate: { $lt: start }, status: { $ne: 'done' } },
    { $expr: { $eq: [{ $dateToString: { date: '$completedAt', format: '%Y-%m-%d', timezone } }, date] } },
  ] }).sort({ status: 1, order: 1 }).limit(200).lean();
  res.json(tasks.map(normalize));
};

exports.list = async (req, res) => {
  const query = { user: req.user._id };
  if (req.query.search !== undefined) {
    if (typeof req.query.search !== 'string' || req.query.search.length > 100)
      return res.status(400).json({ message: 'Search must be 100 characters or fewer' });
    const escaped = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (escaped) query.$or = [{ title: { $regex: escaped, $options: 'i' } }, { description: { $regex: escaped, $options: 'i' } }];
  }
  if (req.query.projectId) {
    if (!validId(req.query.projectId)) return res.status(400).json({ message: 'Invalid project ID' });
    const project = await Project.findOne({ _id: req.query.projectId, user: req.user._id });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    query.projectId = project._id;
  }
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 500, 1), 500);
  const tasks = await Task.find(query).sort({ status: 1, order: 1, createdAt: 1, _id: 1 }).limit(limit).lean();
  res.json(tasks.map(normalize));
};

exports.projectExport = async (req, res) => {
  const { projectId } = req.query;
  if (!validId(projectId)) return res.status(400).json({ message: 'A valid project ID is required' });
  const project = await Project.findOne({ _id: projectId, user: req.user._id }).select('_id');
  if (!project) return res.status(404).json({ message: 'Project not found' });
  const { offset, limit } = req.query;
  if ((offset !== undefined && (typeof offset !== 'string' || !/^\d+$/.test(offset)))
    || (limit !== undefined && (typeof limit !== 'string' || !/^\d+$/.test(limit))))
    return res.status(400).json({ message: 'Invalid project task page' });
  const parsedOffset = offset === undefined ? 0 : Number(offset);
  const parsedLimit = limit === undefined ? 200 : Number(limit);
  if (!Number.isSafeInteger(parsedOffset) || parsedOffset > 1000000
    || !Number.isSafeInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 200)
    return res.status(400).json({ message: 'Invalid project task page' });
  const query = { user: req.user._id, projectId: project._id };
  const [tasks, total] = await Promise.all([
    Task.find(query).sort({ status: 1, order: 1, createdAt: 1, _id: 1 }).skip(parsedOffset).limit(parsedLimit).lean(),
    Task.countDocuments(query),
  ]);
  res.json({ tasks: tasks.map(normalize), total, offset: parsedOffset, limit: parsedLimit });
};

exports.bulkCreate = async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))
    return res.status(400).json({ message: 'A valid import payload is required' });
  const { tasks, projectId, status = 'todo', priority = 'medium', dueDate = null } = req.body;
  if (!Array.isArray(tasks) || !tasks.length || tasks.length > 100)
    return res.status(400).json({ message: 'Choose between 1 and 100 tasks to import' });
  if (tasks.some((task) => !task || typeof task.title !== 'string' || !task.title.trim() || task.title.trim().length > 200))
    return res.status(400).json({ message: 'Each task title must be between 1 and 200 characters' });
  if (!STATUSES.has(status)) return res.status(400).json({ message: 'Invalid task status' });
  if (!PRIORITIES.has(priority)) return res.status(400).json({ message: 'Invalid task priority' });
  if (dueDate !== null && dueDate !== '' && !validDate(dueDate))
    return res.status(400).json({ message: 'Invalid due date' });

  let project;
  if (projectId) {
    if (!validId(projectId)) return res.status(400).json({ message: 'Invalid project ID' });
    project = await Project.findOne({ _id: projectId, user: req.user._id }).select('_id name');
    if (!project) return res.status(404).json({ message: 'Project not found' });
  }

  const key = req.get('Idempotency-Key');
  if (typeof key !== 'string' || !/^[a-zA-Z0-9-]{8,128}$/.test(key))
    return res.status(400).json({ message: 'A valid Idempotency-Key header is required' });

  let batch;
  try {
    batch = await BulkTaskBatch.create({ user: req.user._id, key });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const previous = await BulkTaskBatch.findOne({ user: req.user._id, key });
    if (!previous) throw error;
    if (previous.status !== 'completed') return res.status(409).json({ message: 'This import is already being processed' });
    return res.status(previous.response.statusCode).json(previous.response.body);
  }

  const normalizedStatus = status === 'in-progress' ? 'in_progress' : status;
  const lastTask = await Task.findOne({ user: req.user._id, status: normalizedStatus }).sort({ order: -1 }).select('order').lean();
  let order = (lastTask?.order ?? -1) + 1;
  const createdTasks = [];
  const failures = [];
  for (const [index, item] of tasks.entries()) {
    try {
      const task = await Task.create({
        user: req.user._id,
        title: item.title.trim(),
        projectId: project?._id,
        project: project?.name || 'Personal',
        status: normalizedStatus,
        priority,
        dueDate: dueDate || undefined,
        order: order++,
        completedAt: normalizedStatus === 'done' ? new Date() : undefined,
      });
      createdTasks.push(normalize(task.toObject()));
    } catch (error) {
      console.error(`Bulk task creation failed for item ${index + 1}`, error);
      failures.push({
        index,
        message: error.name === 'ValidationError' ? error.message : 'Task could not be saved because of a server error',
      });
    }
  }

  const body = { requested: tasks.length, createdTasks, failures };
  const statusCode = failures.length ? 207 : 201;
  batch.status = 'completed';
  batch.response = { statusCode, body };
  await batch.save();
  res.status(statusCode).json(body);
};

exports.create = async (req, res) => {
  if (!req.body.title?.trim()) return res.status(400).json({ message: 'Title is required' });
  if (req.body.status && !STATUSES.has(req.body.status)) return res.status(400).json({ message: 'Invalid task status' });
  if (req.body.priority && !PRIORITIES.has(req.body.priority)) return res.status(400).json({ message: 'Invalid task priority' });
  if (req.body.dueDate !== undefined && !validDate(req.body.dueDate)) return res.status(400).json({ message: 'Invalid due date' });
  if (req.body.customReminderAt !== undefined && !validDate(req.body.customReminderAt)) return res.status(400).json({ message: 'Invalid custom reminder time' });
  const reminderError = validateReminder(req.body);
  if (reminderError) return res.status(400).json({ message: reminderError });
  if (req.body.recurrence?.frequency) {
    const recurrenceError = validateRecurrence(req.body.recurrence);
    if (recurrenceError) return res.status(400).json({ message: recurrenceError });
  }
  for (const key of ['plannedDate', 'focusDate']) {
    if (req.body[key] != null && !validDateOnly(req.body[key])) return res.status(400).json({ message: `Invalid ${key}; use YYYY-MM-DD` });
  }
  if (req.body.focusDate && await Task.countDocuments({ user: req.user._id, focusDate: req.body.focusDate }) >= 3)
    return res.status(409).json({ message: 'You can choose up to three focus tasks per day' });
  if (req.body.projectId && !(await Project.exists({ _id: req.body.projectId, user: req.user._id })))
    return res.status(404).json({ message: 'Project not found' });
  let fields = pick(req.body);
  if (fields.status === 'in-progress') fields.status = 'in_progress';
  fields.order = await Task.countDocuments({ user: req.user._id, status: fields.status || 'todo' });
  if ((fields.status || 'todo') === 'done') fields.completedAt = new Date();
  fields = await automation.createSeries(req.user._id, fields);
  let task;
  try { task = await Task.create({ ...fields, user: req.user._id }); }
  catch (error) {
    if (fields.recurrenceSeriesId) await RecurringSeries.deleteOne({ _id: fields.recurrenceSeriesId, user: req.user._id });
    throw error;
  }
  await automation.scheduleReminder(task);
  if (task.status === 'done') await automation.generateNext(task);
  res.status(201).json(normalize(task.toObject()));
};

exports.update = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid task ID' });
  if (req.body.status && !STATUSES.has(req.body.status)) return res.status(400).json({ message: 'Invalid task status' });
  if (req.body.priority && !PRIORITIES.has(req.body.priority)) return res.status(400).json({ message: 'Invalid task priority' });
  if (req.body.dueDate !== undefined && !validDate(req.body.dueDate)) return res.status(400).json({ message: 'Invalid due date' });
  if (req.body.customReminderAt !== undefined && !validDate(req.body.customReminderAt)) return res.status(400).json({ message: 'Invalid custom reminder time' });
  if (req.body.recurrence?.frequency) {
    const recurrenceError = validateRecurrence(req.body.recurrence);
    if (recurrenceError) return res.status(400).json({ message: recurrenceError });
  }
  if (req.body.projectId && !(await Project.exists({ _id: req.body.projectId, user: req.user._id })))
    return res.status(404).json({ message: 'Project not found' });
  const changes = pick(req.body);
  if (changes.status === 'in-progress') changes.status = 'in_progress';
  const existing = await Task.findOne({ _id: req.params.id, user: req.user._id });
  if (!existing) return res.status(404).json({ message: 'Task not found' });
  const reminderError = validateReminder(req.body, existing);
  if (reminderError) return res.status(400).json({ message: reminderError });
  for (const key of ['plannedDate', 'focusDate']) {
    if (changes[key] != null && !validDateOnly(changes[key]))
      return res.status(400).json({ message: `Invalid ${key}; use YYYY-MM-DD` });
  }
  if ('focusDate' in changes && changes.focusDate) {
    const focused = await Task.countDocuments({ user: req.user._id, focusDate: changes.focusDate, _id: { $ne: existing._id } });
    if (focused >= 3) return res.status(409).json({ message: 'You can choose up to three focus tasks per day' });
  }
  if ('recurrence' in changes && changes.recurrence?.frequency && !existing.recurrenceSeriesId) {
    let recurrenceFields;
    try {
      recurrenceFields = await automation.createSeries(req.user._id, { ...existing.toObject(), ...changes });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ message: error.message });
      throw error;
    }
    changes.recurrenceSeriesId = recurrenceFields.recurrenceSeriesId;
    changes.occurrenceDate = recurrenceFields.occurrenceDate;
  }
  if ('recurrence' in changes && existing.recurrenceSeriesId) {
    const recurrence = changes.recurrence || { active: false };
    if (!changes.recurrence) changes.recurrence = { ...(existing.recurrence?.toObject?.() || existing.recurrence || {}), active: false };
    const series = await RecurringSeries.findOne({ _id: existing.recurrenceSeriesId, user: req.user._id });
    if (series) {
      const template = { ...series.template };
      ['title', 'description', 'project', 'projectId', 'tag', 'priority', 'subtasks', 'dueDate', 'plannedDate', 'reminderOffset', 'customReminderAt'].forEach((key) => {
        if (key in changes) template[key] = changes[key];
      });
      if ('subtasks' in changes) template.subtasks = changes.subtasks.map((subtask) => ({ title: subtask.title, completed: false }));
      if ('customReminderAt' in changes) {
        template.customReminderTime = changes.customReminderAt
          ? new Intl.DateTimeFormat('en-GB', {
            timeZone: recurrence.timezone || series.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
          }).format(new Date(changes.customReminderAt))
          : null;
        delete template.customReminderAt;
      }
      const newAnchorDate = changes.dueDate || changes.plannedDate;
      const monthDay = newAnchorDate && ['monthly'].includes(recurrence.frequency || series.frequency)
        ? Number(new Date(newAnchorDate).toISOString().slice(0, 10).slice(-2))
        : undefined;
      await series.updateOne({ $set: {
        active: Boolean(recurrence.frequency) && recurrence.active !== false,
        ...(recurrence.frequency ? {
          frequency: recurrence.frequency,
          interval: recurrence.interval || series.interval,
          unit: recurrence.unit || series.unit,
          endDate: recurrence.endDate || null,
          occurrenceLimit: recurrence.occurrenceLimit || null,
          timezone: recurrence.timezone || series.timezone,
        } : {}),
        ...(monthDay ? { monthDay } : {}),
        template,
      } });
      if (!recurrence.frequency || recurrence.active === false) {
        await Task.updateMany({ recurrenceSeriesId: series._id, user: req.user._id }, { $set: { 'recurrence.active': false } });
      } else {
        const futureTasks = await Task.find({
          recurrenceSeriesId: series._id, user: req.user._id,
          occurrenceDate: { $gt: existing.occurrenceDate || '' }, status: { $ne: 'done' },
        }).limit(365);
        for (const futureTask of futureTasks) {
          ['title', 'description', 'project', 'projectId', 'tag', 'priority', 'reminderOffset'].forEach((key) => {
            if (key in changes) futureTask[key] = changes[key];
          });
          if ('subtasks' in changes) futureTask.subtasks = changes.subtasks.map((subtask) => ({ title: subtask.title, completed: false }));
          if ('dueDate' in changes) futureTask.dueDate = changes.dueDate ? new Date(`${futureTask.occurrenceDate}T00:00:00Z`) : undefined;
          if ('plannedDate' in changes) futureTask.plannedDate = changes.plannedDate ? futureTask.occurrenceDate : undefined;
          if ('customReminderAt' in changes || 'reminderOffset' in changes) {
            futureTask.customReminderAt = series.template.customReminderTime
              ? automation.zonedDateTime(futureTask.occurrenceDate, series.template.customReminderTime, series.timezone)
              : undefined;
          }
          futureTask.recurrence = {
            frequency: series.frequency, interval: series.interval, unit: series.unit,
            endDate: series.endDate, occurrenceLimit: series.occurrenceLimit,
            timezone: series.timezone, active: series.active,
          };
          await futureTask.save();
          await automation.scheduleReminder(futureTask);
        }
      }
    }
  }
  if (changes.status && changes.status !== existing.status && changes.order === undefined) {
    changes.order = await Task.countDocuments({
      user: req.user._id, status: changes.status,
      _id: { $ne: existing._id },
    });
  }
  if (changes.status === 'done' && existing.status !== 'done') changes.completedAt = new Date();
  else if (changes.status && changes.status !== 'done') changes.completedAt = null;
  else if (changes.status === 'done') changes.completedAt = existing.completedAt || new Date();
  const task = await Task.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, changes, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!task) return res.status(404).json({ message: 'Task not found' });
  await automation.scheduleReminder(task);
  if (changes.status === 'done' && existing.status !== 'done') await automation.generateNext(task);
  if (task.status === 'in-progress') task.status = 'in_progress';
  res.json(normalize(task.toObject()));
};

exports.reorder = async (req, res) => {
  const { tasks } = req.body;
  if (!Array.isArray(tasks) || !tasks.length || tasks.length > 500)
    return res.status(400).json({ message: 'A non-empty task ordering is required' });
  const ids = tasks.map((item) => item?.id);
  if (ids.some((id) => !validId(id)) || new Set(ids).size !== ids.length)
    return res.status(400).json({ message: 'Task IDs must be valid and unique' });
  if (tasks.some((item) => !STATUSES.has(item.status) || !Number.isInteger(item.order) || item.order < 0))
    return res.status(400).json({ message: 'Invalid task status or order' });
  const owned = await Task.find({ _id: { $in: ids }, user: req.user._id }).select('_id projectId status completedAt');
  if (owned.length !== ids.length) return res.status(404).json({ message: 'One or more tasks were not found' });
  const positions = tasks.map((item) => `${item.status === 'in-progress' ? 'in_progress' : item.status}:${item.order}`);
  if (new Set(positions).size !== positions.length) return res.status(400).json({ message: 'Task positions must be unique within each column' });
  const projectIds = [...new Set(owned.map((task) => String(task.projectId || '')))].filter(Boolean);
  if (projectIds.length && await Project.countDocuments({ _id: { $in: projectIds }, user: req.user._id }) !== projectIds.length)
    return res.status(404).json({ message: 'Project not found' });
  const previous = new Map(owned.map((task) => [String(task._id), task]));
  const changes = tasks.map((item) => ({
    updateOne: {
      filter: { _id: item.id, user: req.user._id },
      update: { $set: {
        status: item.status === 'in-progress' ? 'in_progress' : item.status,
        order: item.order,
        completedAt: item.status === 'done'
          ? previous.get(String(item.id)).completedAt || new Date()
          : null,
      } },
    },
  }));
  await Task.bulkWrite(changes, { ordered: true });
  const updated = await Task.find({ _id: { $in: ids }, user: req.user._id });
  for (const task of updated) {
    const wasDone = previous.get(String(task._id)).status === 'done';
    await automation.scheduleReminder(task);
    if (!wasDone && task.status === 'done') await automation.generateNext(task);
  }
  res.json({ message: 'Task order saved' });
};

exports.remove = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid task ID' });
  const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!task) return res.status(404).json({ message: 'Task not found' });
  await Reminder.deleteOne({ task: task._id, user: req.user._id });
  if (task.recurrenceSeriesId) {
    await RecurringSeries.updateOne({ _id: task.recurrenceSeriesId, user: req.user._id }, { $set: { active: false } });
    await Task.updateMany({ recurrenceSeriesId: task.recurrenceSeriesId, user: req.user._id }, { $set: { 'recurrence.active': false } });
  }
  res.json({ message: 'Deleted' });
};

exports.stopRecurrence = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid task ID' });
  const task = await Task.findOne({ _id: req.params.id, user: req.user._id });
  if (!task || !task.recurrenceSeriesId) return res.status(404).json({ message: 'Recurring task not found' });
  await RecurringSeries.updateOne({ _id: task.recurrenceSeriesId, user: req.user._id }, { $set: { active: false } });
  await Task.updateMany({ recurrenceSeriesId: task.recurrenceSeriesId, user: req.user._id }, { $set: { 'recurrence.active': false } });
  res.json({ message: 'Recurrence stopped' });
};

exports.updateRecurrence = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid recurrence ID' });
  const series = await RecurringSeries.findOne({ _id: req.params.id, user: req.user._id });
  if (!series) return res.status(404).json({ message: 'Recurring series not found' });
  const allowed = ['frequency', 'interval', 'unit', 'endDate', 'occurrenceLimit', 'timezone', 'active'];
  const updates = Object.fromEntries(allowed.filter((key) => key in req.body).map((key) => [key, req.body[key]]));
  if (updates.endDate && !validDateOnly(updates.endDate)) return res.status(400).json({ message: 'Invalid end date' });
  if (updates.frequency && !['daily', 'weekdays', 'weekly', 'monthly', 'custom'].includes(updates.frequency))
    return res.status(400).json({ message: 'Invalid recurrence frequency' });
  if (updates.unit && !['day', 'week', 'month'].includes(updates.unit))
    return res.status(400).json({ message: 'Invalid recurrence interval unit' });
  if (updates.active !== undefined && typeof updates.active !== 'boolean')
    return res.status(400).json({ message: 'Active must be a boolean' });
  if (updates.interval !== undefined && (!Number.isInteger(updates.interval) || updates.interval < 1 || updates.interval > 365))
    return res.status(400).json({ message: 'Invalid recurrence interval' });
  if (updates.occurrenceLimit !== undefined && updates.occurrenceLimit !== null && (!Number.isInteger(updates.occurrenceLimit) || updates.occurrenceLimit < 1 || updates.occurrenceLimit > 365))
    return res.status(400).json({ message: 'Invalid occurrence limit' });
  if ((updates.active ?? series.active)
    && !(updates.endDate ?? series.endDate)
    && !(updates.occurrenceLimit ?? series.occurrenceLimit))
    return res.status(400).json({ message: 'Choose a recurrence end date or occurrence limit' });
  if (updates.timezone) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: updates.timezone }); } catch { return res.status(400).json({ message: 'Invalid timezone' }); }
  }
  Object.assign(series, updates);
  await series.save();
  await Task.updateMany({ recurrenceSeriesId: series._id, user: req.user._id }, { $set: { recurrence: {
    frequency: series.frequency, interval: series.interval, unit: series.unit, endDate: series.endDate,
    occurrenceLimit: series.occurrenceLimit, timezone: series.timezone, active: series.active,
  } } });
  res.json({ series });
};
