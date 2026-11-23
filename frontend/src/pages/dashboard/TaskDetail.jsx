import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { zonedDateTimeToISO, zonedDateTimeValue } from '../../utils/dates';
import { COLUMNS } from './constants';

export function TaskDetail({ task, projects, timezone, onClose, onSave, onDelete, onStopRecurrence }) {
  const [form, setForm] = useState({ ...task, subtasks: task.subtasks || [] });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  useEffect(() => setForm({ ...task, subtasks: task.subtasks || [] }), [task]);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    const frequency = form.recurrenceFrequency ?? (form.recurrence?.active === false ? 'none' : form.recurrence?.frequency ?? 'none');
    const endDate = form.recurrenceEndDate || form.recurrence?.endDate;
    const occurrenceLimit = form.recurrenceLimit || form.recurrence?.occurrenceLimit;
    if (frequency !== 'none' && !endDate && !occurrenceLimit) {
      setFormError('Set an end date or occurrence limit for this recurring task.');
      setBusy(false);
      return;
    }
    if ((form.reminderOffset || 'none') !== 'none' && !form.dueDate) {
      setFormError('Set a due date before adding a reminder.');
      setBusy(false);
      return;
    }
    if (form.reminderOffset === 'custom' && !form.customReminderAt) {
      setFormError('Choose a custom reminder time.');
      setBusy(false);
      return;
    }
    const recurrence = form.recurrenceFrequency === 'none' ? undefined : form.recurrenceFrequency ? {
      frequency: form.recurrenceFrequency, interval: Number(form.recurrenceInterval || 1),
      unit: form.recurrenceUnit || 'day', endDate: form.recurrenceEndDate || undefined,
      occurrenceLimit: form.recurrenceLimit ? Number(form.recurrenceLimit) : undefined,
      timezone: form.recurrence?.timezone || timezone, active: form.recurrence?.active !== false,
    } : form.recurrence;
    try {
      await onSave(task._id, {
        ...form, recurrence, subtasks: form.subtasks,
        dueDate: form.dueDate || null,
        plannedDate: form.plannedDate || null,
        customReminderAt: form.customReminderAt ? zonedDateTimeToISO(form.customReminderAt, timezone) : undefined,
      });
    } catch (error) { setFormError(error.message); }
    setBusy(false);
  };
  const addSubtask = () => setForm((f) => ({ ...f, subtasks: [...f.subtasks, { title: '', completed: false }] }));
  const repeatFrequency = form.recurrenceFrequency ?? (form.recurrence?.active === false ? 'none' : form.recurrence?.frequency ?? 'none');
  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal task-detail-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="panel-head"><h4>Task details</h4><button type="button" className="icon-btn" onClick={onClose}><X size={16} /></button></div>
        {formError&&<p className="error">{formError}</p>}
        <input className="input task-title-input" required aria-label="Task title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea className="input task-description-input" placeholder="Add a description" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="tf-grid">
          <label className="phase-date-label">Status<select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
          <label className="phase-date-label">Priority<select className="input" value={form.priority || 'medium'} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option></select></label>
          <label className="phase-date-label">Project<select className="input" value={form.projectId || ''} onChange={(e) => { const p = projects.find((item) => item._id === e.target.value); setForm({ ...form, projectId: e.target.value || undefined, project: p?.name || 'Personal' }); }}>
            <option value="">Personal</option>{projects.filter((p) => !p.archived).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select></label>
          <label className="phase-date-label">Tag<input className="input" placeholder="e.g. Design" value={form.tag || ''} onChange={(e) => setForm({ ...form, tag: e.target.value })} /></label>
        </div>
        <p className="tf-section">Schedule</p>
        <div className="tf-grid">
          <label className="phase-date-label">Due date<input className="input" type="date" value={form.dueDate ? new Date(form.dueDate).toISOString().slice(0, 10) : ''} onChange={(e) => setForm({ ...form, dueDate: e.target.value || null })} /></label>
          <label className="phase-date-label">Plan for day<input className="input" type="date" value={form.plannedDate || ''} onChange={(e) => setForm({ ...form, plannedDate: e.target.value || null })} /></label>
          <label className="phase-date-label">Reminder<select className="input" value={form.reminderOffset || 'none'} onChange={(e) => setForm({ ...form, reminderOffset: e.target.value })}><option value="none">No reminder</option><option value="due">At due time</option><option value="10m">10 minutes before</option><option value="30m">30 minutes before</option><option value="1h">1 hour before</option><option value="1d">1 day before</option><option value="custom">Custom time</option></select></label>
          {form.reminderOffset === 'custom' && <label className="phase-date-label">Remind at ({timezone})<input className="input" type="datetime-local" value={form.customReminderAt ? zonedDateTimeValue(form.customReminderAt, timezone) : ''} onChange={(e) => setForm({ ...form, customReminderAt: e.target.value })} /></label>}
        </div>
        <p className="tf-section">Repeat</p>
        <div className="tf-grid">
          <label className="phase-date-label">Frequency<select className="input" value={form.recurrenceFrequency ?? (form.recurrence?.active === false ? 'none' : form.recurrence?.frequency) ?? 'none'} onChange={(e) => setForm({ ...form, recurrenceFrequency: e.target.value })}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekdays">Every weekday</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="custom">Custom interval</option></select></label>
          {repeatFrequency !== 'none' && <label className="phase-date-label">Every (interval)<input className="input" type="number" min="1" max="365" value={form.recurrenceInterval || form.recurrence?.interval || 1} onChange={(e) => setForm({ ...form, recurrenceInterval: e.target.value })}/></label>}
          {repeatFrequency === 'custom' && <label className="phase-date-label">Interval unit<select className="input" value={form.recurrenceUnit || form.recurrence?.unit || 'day'} onChange={(e)=>setForm({...form,recurrenceUnit:e.target.value})}><option value="day">Days</option><option value="week">Weeks</option><option value="month">Months</option></select></label>}
          {repeatFrequency !== 'none' && <label className="phase-date-label">Repeat until<input className="input" type="date" value={form.recurrenceEndDate || form.recurrence?.endDate || ''} onChange={(e) => setForm({ ...form, recurrenceEndDate: e.target.value })}/></label>}
          {repeatFrequency !== 'none' && <label className="phase-date-label">Or total occurrences<input className="input" type="number" min="1" max="365" value={form.recurrenceLimit || form.recurrence?.occurrenceLimit || ''} onChange={(e) => setForm({ ...form, recurrenceLimit: e.target.value })}/></label>}
        </div>
        <div className="subtask-editor">
          <div className="tf-sub-head"><p className="tf-section">Subtasks</p><button type="button" className="link-gold" onClick={addSubtask}>+ Add subtask</button></div>
          {(form.subtasks || []).map((subtask, index) => <label className="subtask-edit-row" key={subtask._id || index}>
            <input type="checkbox" checked={subtask.completed} onChange={(e) => setForm({ ...form, subtasks: form.subtasks.map((s, i) => i === index ? { ...s, completed: e.target.checked } : s) })} />
            <input className="input" required placeholder="Subtask title" value={subtask.title} onChange={(e) => setForm({ ...form, subtasks: form.subtasks.map((s, i) => i === index ? { ...s, title: e.target.value } : s) })} />
            <button type="button" className="icon-btn" onClick={() => setForm({ ...form, subtasks: form.subtasks.filter((_, i) => i !== index) })}><X size={14} /></button>
          </label>)}
        </div>
        <div className="task-detail-actions"><div><button type="button" className="btn btn-ghost" onClick={() => onDelete(task._id)}>Delete task</button>{task.recurrenceSeriesId&&task.recurrence?.active!==false&&<button type="button" className="btn btn-ghost" onClick={()=>onStopRecurrence(task._id)}>Stop series</button>}</div><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
      </form>
    </div>
  );
}
