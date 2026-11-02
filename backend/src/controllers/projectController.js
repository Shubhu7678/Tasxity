const Project = require('../models/Project');
const Task = require('../models/Task');
const Reminder = require('../models/Reminder');
const RecurringSeries = require('../models/RecurringSeries');

exports.list = async (req, res) => {
  const query = { user: req.user._id };
  if (req.query.search !== undefined) {
    if (typeof req.query.search !== 'string' || req.query.search.length > 100)
      return res.status(400).json({ message: 'Search must be 100 characters or fewer' });
    const escaped = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (escaped) query.name = { $regex: escaped, $options: 'i' };
  }
  const projects = Project.find(query).sort({ createdAt: -1 });
  if (req.query.search) projects.limit(20);
  res.json(await projects);
};

exports.create = async (req, res) => {
  const { name, description, color } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: 'Project name is required' });
  res.status(201).json(await Project.create({ user: req.user._id, name, description, color }));
};

exports.update = async (req, res) => {
  const project = await Project.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { $set: Object.fromEntries(['name', 'description', 'color', 'archived'].filter((key) => key in req.body).map((key) => [key, req.body[key]])) },
    { returnDocument: 'after', runValidators: true }
  );
  if (!project) return res.status(404).json({ message: 'Project not found' });
  res.json(project);
};

exports.remove = async (req, res) => {
  const project = await Project.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!project) return res.status(404).json({ message: 'Project not found' });
  const tasks = await Task.find({ projectId: project._id, user: req.user._id }).select('_id recurrenceSeriesId');
  await Reminder.deleteMany({ user: req.user._id, task: { $in: tasks.map((task) => task._id) } });
  await RecurringSeries.updateMany({ user: req.user._id, _id: { $in: tasks.map((task) => task.recurrenceSeriesId).filter(Boolean) } }, { $set: { active: false } });
  await Task.deleteMany({ projectId: project._id, user: req.user._id });
  res.json({ message: 'Deleted' });
};
