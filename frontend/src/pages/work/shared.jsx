import { Check } from 'lucide-react';

export const dateKey = (date, timezone) => new Intl.DateTimeFormat('en-CA', {
  timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);
export const dayLabel = (key, timezone) => new Intl.DateTimeFormat('en-US', {
  timeZone: timezone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
}).format(new Date(`${key}T12:00:00Z`));
export const addDays = (key, count) => {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
};
export const taskDate = (task) => task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '';

export function TaskRow({ task, onUpdate, onOpen, showDate = false, dateField = 'dueDate', selectionMode = false, selected = false, onToggleSelection }) {
  return (
    <div className="phase-task">
      {selectionMode && <input className="task-select-checkbox" type="checkbox" checked={selected} aria-label={`Select ${task.title}`} onChange={() => onToggleSelection(task._id)} />}
      <button className={`task-check ${task.status === 'done' ? 'checked' : ''}`} onClick={() => onUpdate(task._id, { status: task.status === 'done' ? 'todo' : 'done' })} aria-label={task.status === 'done' ? 'Reopen task' : 'Complete task'}>
        {task.status === 'done' && <Check size={12} />}
      </button>
      <button className="phase-task-main" onClick={() => onOpen(task)}>
        <b>{task.title}</b><span>{task.project || 'Personal'} · <i className={`priority-pill ${task.priority || 'medium'}`}>{task.priority || 'medium'}</i></span>
      </button>
      {showDate && <input className="phase-date" type="date" value={dateField === 'plannedDate' ? (task.plannedDate || taskDate(task)) : taskDate(task)} aria-label={dateField === 'plannedDate' ? 'Reschedule planned day' : 'Change due date'} onChange={(e) => onUpdate(task._id, { [dateField]: e.target.value || null })} />}
      <select className="phase-priority" value={task.priority || 'medium'} aria-label="Task priority" onChange={(e) => onUpdate(task._id, { priority: e.target.value })}>
        <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
      </select>
    </div>
  );
}

export function Section({ title, count, children, empty }) {
  return <section className="phase-section"><div className="phase-section-head"><h3>{title}</h3><span>{count}</span></div>{count ? children : <p className="phase-empty-note">{empty}</p>}</section>;
}
