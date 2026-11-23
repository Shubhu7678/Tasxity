export const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const ago = (d) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(d)) / 60000));
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} hours ago` : `${Math.round(m / 1440)} days ago`;
};
export const isTypingTarget = (target) => target instanceof HTMLElement
  && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
export const upcomingTaskOrder = (tasks, timezone) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const addDays = (date, amount) => {
    const next = new Date(`${date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + amount);
    return next.toISOString().slice(0, 10);
  };
  const tomorrow = addDays(today, 1), nextWeek = addDays(today, 7);
  const due = (task) => task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '';
  const openTasks = tasks.filter((task) => task.status !== 'done');
  const groups = [
    (task) => due(task) && due(task) < today,
    (task) => due(task) === today,
    (task) => due(task) === tomorrow,
    (task) => due(task) > tomorrow && due(task) <= nextWeek,
    (task) => due(task) > nextWeek,
    (task) => !due(task),
  ];
  return groups.flatMap((matches) => openTasks.filter(matches).sort((a, b) => (due(a) || '9999').localeCompare(due(b) || '9999')));
};
export const timelineGroups = (tasks, timezone) => {
  const dateKey = (date) => new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
  const today = dateKey(new Date());
  const dueDate = (task) => task.plannedDate || (task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '');
  const groups = new Map();
  tasks.forEach((task) => {
    const key = dueDate(task) || 'unscheduled';
    groups.set(key, [...(groups.get(key) || []), task]);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => a === 'unscheduled' ? 1 : b === 'unscheduled' ? -1 : a.localeCompare(b))
    .map(([date, items]) => ({
      date,
      label: date === 'unscheduled'
        ? 'No scheduled date'
        : date === today
          ? 'Today'
          : new Intl.DateTimeFormat('en-US', {
            timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
          }).format(new Date(`${date}T12:00:00Z`)),
      tasks: items,
    }));
};
