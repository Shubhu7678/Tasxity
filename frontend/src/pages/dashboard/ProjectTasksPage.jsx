import { useEffect, useState } from 'react';
import {
  Plus, ChevronLeft, Check, ListTodo, X, Trash2, Pencil, Repeat, Copy, ClipboardPaste,
} from 'lucide-react';
import api, { errMsg } from '../../api';
import { zonedDateTimeToISO, zonedDateTimeValue } from '../../utils/dates';
import { COLUMNS } from './constants';
import { fmt } from './helpers';

export function ProjectTasksPage({
  project, timezone, preferences, onBack, onError, onChange, onTasksReplace, selectionMode,
  selectedTaskIds, onToggleSelection, onToggleSelectionMode, onSelectVisibleTasks, onDeselectTasks,
  onImport, onCopyTasks, onCopyProject, copyFormat,
  setCopyFormat, tasksRevision,
}) {
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const newTaskForm = () => ({
    title: '', status: 'todo', tag: '', dueDate: '',
    repeatFrequency: preferences.recurrenceDefault && preferences.recurrenceDefault !== 'none' ? preferences.recurrenceDefault : 'none',
    repeatLimit: preferences.recurrenceDefault && preferences.recurrenceDefault !== 'none' ? 12 : '',
    reminderOffset: preferences.reminderDefault || 'none',
  });
  const editTaskForm = (task) => ({
    ...task, repeatFrequency: task.recurrence?.active === false ? 'none' : task.recurrence?.frequency || 'none',
    repeatInterval: task.recurrence?.interval || 1, repeatUnit: task.recurrence?.unit || 'day',
    repeatEndDate: task.recurrence?.endDate || '', repeatLimit: task.recurrence?.occurrenceLimit || '',
    customReminderAt: task.customReminderAt ? zonedDateTimeValue(task.customReminderAt, timezone) : '',
  });
  const refreshAllTasks = async () => {
    const { data } = await api.get('/tasks');
    onTasksReplace(data);
    setTasks(data.filter((task) => task.projectId === project._id));
  };
  useEffect(() => {
    let active = true;
    api.get('/tasks', { params: { projectId: project._id } })
      .then((response) => { if (active) setTasks(response.data); })
      .catch((requestError) => { if (active) onError(errMsg(requestError)); });
    return () => { active = false; };
  }, [project._id, tasksRevision, onError]);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const recurrence = form.repeatFrequency && form.repeatFrequency !== 'none' ? {
        frequency: form.repeatFrequency, interval: Number(form.repeatInterval || 1),
        unit: form.repeatUnit || 'day', endDate: form.repeatEndDate || undefined,
        occurrenceLimit: form.repeatLimit ? Number(form.repeatLimit) : undefined, timezone,
      } : undefined;
      if (recurrence && !recurrence.endDate && !recurrence.occurrenceLimit) {
        onError('Set an end date or occurrence limit for this recurring task.');
        return;
      }
      if (form.reminderOffset && form.reminderOffset !== 'none' && !form.dueDate) {
        onError('A due date is required to set a reminder.');
        return;
      }
      if (form.reminderOffset === 'custom' && !form.customReminderAt) {
        onError('Choose a custom reminder time.');
        return;
      }
      const body = { ...form, recurrence, customReminderAt: form.customReminderAt ? zonedDateTimeToISO(form.customReminderAt, timezone) : undefined, reminderOffset: form.reminderOffset || 'none', projectId: project._id, project: project.name };
      const { data } = form._id ? await api.put(`/tasks/${form._id}`, body) : await api.post('/tasks', body);
      setTasks((list) => form._id ? list.map((t) => t._id === data._id ? data : t) : [data, ...list]);
      onChange(data._id, data);
      if (form._id && (form.recurrenceSeriesId || recurrence)) await refreshAllTasks();
      setForm(null);
    } catch (e) { onError(errMsg(e)); }
    finally { setBusy(false); }
  };
  const remove = async (task) => {
    try { await api.delete(`/tasks/${task._id}`); setTasks((list) => list.filter((t) => t._id !== task._id)); onChange(task._id, null); }
    catch (e) { onError(errMsg(e)); }
  };
  const setStatus = async (task, status) => {
    try {
      const { data } = await api.put(`/tasks/${task._id}`, { status });
      setTasks((list) => list.map((t) => t._id === task._id ? data : t));
      onChange(task._id, data);
      if (task.recurrenceSeriesId && status === 'done' && task.status !== 'done') await refreshAllTasks();
    } catch (e) { onError(errMsg(e)); }
  };
  return (
    <section className="projects-page">
      <button className="back-link" onClick={onBack}><ChevronLeft size={16} /> All projects</button>
      <div className="projects-heading">
        <div><p className="greet">Project workspace</p><h1 className="big"><i className="project-title-dot" style={{ background: project.color }} />{project.name}</h1><p className="muted">{project.description || 'Tasks and progress for this project.'}</p></div>
        <div className="project-task-actions">
          <button className="btn btn-ghost" onClick={onImport}><ClipboardPaste size={15} /> Paste Tasks</button>
          <button className="btn btn-ghost" onClick={onToggleSelectionMode}>{selectionMode ? 'Exit selection' : 'Select tasks'}</button>
          <select className="select" value={copyFormat} onChange={(event) => setCopyFormat(event.target.value)} aria-label="Project copy format">
            <option value="plain">Plain list</option><option value="markdown">Markdown checklist</option><option value="detailed">Detailed</option>
          </select>
          <button className="btn btn-ghost" disabled={busy} onClick={() => onCopyProject(copyFormat)}><Copy size={14} /> Copy Project Tasks</button>
          <button className="btn btn-primary" onClick={() => setForm(newTaskForm())}><Plus size={16} /> Add task</button>
        </div>
      </div>
      {selectionMode && <div className="task-selection-toolbar">
        <strong>{tasks.filter((task) => selectedTaskIds.has(task._id)).length} selected</strong>
        <button className="btn btn-ghost" onClick={() => onSelectVisibleTasks(tasks)}>Select all visible ({tasks.length})</button>
        <button className="btn btn-ghost" onClick={onDeselectTasks}>Deselect all</button>
        <select className="select" value={copyFormat} onChange={(event) => setCopyFormat(event.target.value)} aria-label="Copy format">
          <option value="plain">Plain list</option><option value="markdown">Markdown checklist</option><option value="detailed">Detailed</option>
        </select>
        <button className="btn btn-primary" disabled={!tasks.some((task) => selectedTaskIds.has(task._id))}
          onClick={() => onCopyTasks(tasks.filter((task) => selectedTaskIds.has(task._id)), copyFormat)}><Copy size={14} /> Copy tasks</button>
        <button className="icon-btn" onClick={onToggleSelectionMode} aria-label="Exit selection mode" title="Exit selection mode"><X size={15} /></button>
      </div>}
      <div className="project-task-summary"><span><ListTodo size={16} /> {tasks.length} tasks</span><span><Check size={16} /> {tasks.filter((t) => t.status === 'done').length} completed</span></div>
      {form && <form className="project-editor" onSubmit={save}>
        <div className="editor-title"><div className="project-swatch" style={{ background: project.color }} /><div><h3>{form._id ? 'Edit task' : 'Add a task'}</h3><p className="muted">This task will be saved in {project.name}.</p></div></div>
        <div className="project-editor-fields task-editor-fields">
          <label>Task name<input className="input" placeholder="What needs to get done?" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label>Status<select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
          <label>Due date<input className="input" type="date" value={form.dueDate ? new Date(form.dueDate).toISOString().slice(0, 10) : ''} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
          <label>Tag<input className="input" placeholder="e.g. Design" value={form.tag || ''} onChange={(e) => setForm({ ...form, tag: e.target.value })} /></label>
          <label>Repeat<select className="input" value={form.repeatFrequency ?? form.recurrence?.frequency ?? 'none'} onChange={(e) => setForm({ ...form, repeatFrequency: e.target.value })}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekdays">Every weekday</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="custom">Custom interval</option></select></label>
          <label>Repeat interval<input className="input" type="number" min="1" max="365" value={form.repeatInterval || form.recurrence?.interval || 1} onChange={(e) => setForm({ ...form, repeatInterval: e.target.value })} /></label>
          {(form.repeatFrequency ?? form.recurrence?.frequency) && (form.repeatFrequency ?? form.recurrence?.frequency) !== 'none' && <><label>Repeat until<input className="input" type="date" value={form.repeatEndDate || form.recurrence?.endDate || ''} onChange={(e) => setForm({ ...form, repeatEndDate: e.target.value })} /></label><label>Or total occurrences<input className="input" type="number" min="1" max="365" value={form.repeatLimit || form.recurrence?.occurrenceLimit || ''} onChange={(e) => setForm({ ...form, repeatLimit: e.target.value })} /></label></>}
          {(form.repeatFrequency === 'custom') && <label>Interval unit<select className="input" value={form.repeatUnit || 'day'} onChange={(e)=>setForm({...form,repeatUnit:e.target.value})}><option value="day">Days</option><option value="week">Weeks</option><option value="month">Months</option></select></label>}
          <label>Reminder<select className="input" value={form.reminderOffset || 'none'} onChange={(e) => setForm({ ...form, reminderOffset: e.target.value })}><option value="none">No reminder</option><option value="due">At due time</option><option value="10m">10 minutes before</option><option value="30m">30 minutes before</option><option value="1h">1 hour before</option><option value="1d">1 day before</option><option value="custom">Custom time</option></select></label>
          {form.reminderOffset === 'custom' && <label>Remind at ({timezone})<input className="input" type="datetime-local" value={form.customReminderAt || ''} onChange={(e)=>setForm({...form,customReminderAt:e.target.value})}/></label>}
        </div>
        <div className="editor-actions"><button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : form._id ? 'Save task' : 'Create task'}</button></div>
      </form>}
      {tasks.length ? <div className="project-task-list"><div className="task-list-head"><span>Task</span><span>Status</span><span>Due date</span><span>Actions</span></div>
        {tasks.map((task) => <div className="project-task-row" key={task._id}>
          <div className="task-list-title">{selectionMode && <input className="task-select-checkbox" type="checkbox" checked={selectedTaskIds.has(task._id)} aria-label={`Select ${task.title}`} onChange={() => onToggleSelection(task._id)} />}<button className={`task-check ${task.status === 'done' ? 'checked' : ''}`} onClick={() => setStatus(task, task.status === 'done' ? 'todo' : 'done')}>{task.status === 'done' && <Check size={12} />}</button><div><b>{task.title}{task.recurrenceSeriesId&&task.recurrence?.active!==false&&<Repeat size={12} className="recurring-mark" aria-label="Recurring task"/>}</b>{task.tag && <small>{task.tag}</small>}</div></div>
          <select className={`status-select ${task.status}`} value={task.status} onChange={(e) => setStatus(task, e.target.value)}>{COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
          <span className="task-date">{task.dueDate ? fmt(task.dueDate) : '—'}</span>
          <div className="task-row-actions"><button className="icon-btn" title="Edit task" onClick={() => setForm(editTaskForm(task))}><Pencil size={14} /></button><button className="icon-btn" title="Delete task" onClick={() => { if (window.confirm(`Delete “${task.title}”?`)) remove(task); }}><Trash2 size={14} /></button></div>
        </div>)}
      </div> : !form && <div className="projects-empty"><div className="empty-icon"><ListTodo size={26} /></div><h3>No tasks in this project yet</h3><p>Add a task to start tracking work in {project.name}.</p><button className="btn btn-primary" onClick={() => setForm(newTaskForm())}><Plus size={15} /> Add the first task</button></div>}
    </section>
  );
}
