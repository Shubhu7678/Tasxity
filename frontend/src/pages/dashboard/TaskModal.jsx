import { useState } from 'react';
import { X } from 'lucide-react';
import { zonedDateTimeToISO } from '../../utils/dates';
import { COLUMNS } from './constants';

export function TaskModal({ status, plannedDate, projects, selectedProjectId, timezone, preferences, onClose, onSave }) {
  const defaultProject = projects.find((p) => p._id === selectedProjectId && !p.archived) || projects.find((p) => !p.archived);
  const defaultRepeat = preferences.recurrenceDefault && preferences.recurrenceDefault !== 'none' ? preferences.recurrenceDefault : 'none';
  const [f, setF] = useState({ title: '', description: '', projectId: defaultProject?._id || '', project: defaultProject?.name || 'Personal', tag: '', priority: 'medium', plannedDate: plannedDate || '', dueDate: '', status, recurrenceFrequency: defaultRepeat, recurrenceInterval: 1, recurrenceUnit: 'day', recurrenceEndDate: '', recurrenceLimit: defaultRepeat === 'none' ? '' : '12', reminderOffset: preferences.reminderDefault || 'none', customReminderAt: '' });
  const [busy, setBusy] = useState(false);
  const [recurrenceError, setRecurrenceError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const recurrence = f.recurrenceFrequency === 'none' ? undefined : {
      frequency: f.recurrenceFrequency, interval: Number(f.recurrenceInterval), unit: f.recurrenceUnit,
      endDate: f.recurrenceEndDate || undefined, occurrenceLimit: f.recurrenceLimit ? Number(f.recurrenceLimit) : undefined, timezone,
    };
    if (recurrence && !recurrence.endDate && !recurrence.occurrenceLimit) {
      setRecurrenceError('Set an end date or occurrence limit for this recurring task.');
      setBusy(false);
      return;
    }
    if (f.reminderOffset !== 'none' && !f.dueDate) {
      setRecurrenceError('Set a due date before adding a reminder.');
      setBusy(false);
      return;
    }
    if (f.reminderOffset === 'custom' && !f.customReminderAt) {
      setRecurrenceError('Choose a custom reminder time.');
      setBusy(false);
      return;
    }
    setRecurrenceError('');
    let customReminderAt;
    try { customReminderAt = f.customReminderAt ? zonedDateTimeToISO(f.customReminderAt, timezone) : undefined; }
    catch (error) { setRecurrenceError(error.message); setBusy(false); return; }
    await onSave({ ...f, recurrence, reminderOffset: f.reminderOffset, customReminderAt, projectId: f.projectId || undefined, plannedDate: f.plannedDate || undefined, dueDate: f.dueDate || undefined });
    setBusy(false);
  };
  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal task-create-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="panel-head"><h4>New Task</h4><button type="button" className="icon-btn" onClick={onClose}><X size={16} /></button></div>
        <input className="input task-title-input" autoFocus placeholder="What needs to be done?" value={f.title} onChange={set('title')} required />
        <textarea className="input task-description-input" placeholder="Add a description (optional)" value={f.description} onChange={set('description')} />
        <div className="tf-grid">
          <label className="phase-date-label">Status<select className="input" value={f.status} onChange={set('status')}>{COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
          <label className="phase-date-label">Priority<select className="input" value={f.priority} onChange={set('priority')}><option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option></select></label>
          <label className="phase-date-label">Project<select className="input" value={f.projectId} onChange={(e) => { const p = projects.find((item) => item._id === e.target.value); setF({ ...f, projectId: e.target.value, project: p?.name || 'Personal' }); }}>
            <option value="">Personal</option>{projects.filter((p) => !p.archived).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select></label>
          <label className="phase-date-label">Tag<input className="input" placeholder="e.g. Design" value={f.tag} onChange={set('tag')} /></label>
        </div>
        <p className="tf-section">Schedule</p>
        <div className="tf-grid">
          <label className="phase-date-label">Due date<input className="input" type="date" value={f.dueDate} onChange={set('dueDate')} /></label>
          <label className="phase-date-label">Plan for day<input className="input" type="date" value={f.plannedDate} onChange={set('plannedDate')} /></label>
          <label className="phase-date-label">Reminder<select className="input" value={f.reminderOffset} onChange={set('reminderOffset')}><option value="none">No reminder</option><option value="due">At due time</option><option value="10m">10 minutes before</option><option value="30m">30 minutes before</option><option value="1h">1 hour before</option><option value="1d">1 day before</option><option value="custom">Custom time</option></select></label>
          {f.reminderOffset === 'custom' && <label className="phase-date-label">Remind at ({timezone})<input className="input" type="datetime-local" value={f.customReminderAt} onChange={set('customReminderAt')}/></label>}
        </div>
        <p className="tf-section">Repeat</p>
        <div className="tf-grid">
          <label className="phase-date-label">Frequency<select className="input" value={f.recurrenceFrequency} onChange={set('recurrenceFrequency')}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekdays">Every weekday</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="custom">Custom interval</option></select></label>
          {f.recurrenceFrequency !== 'none' && <label className="phase-date-label">Every (interval)<input className="input" type="number" min="1" max="365" value={f.recurrenceInterval} onChange={set('recurrenceInterval')}/></label>}
          {f.recurrenceFrequency === 'custom' && <label className="phase-date-label">Interval unit<select className="input" value={f.recurrenceUnit} onChange={set('recurrenceUnit')}><option value="day">Days</option><option value="week">Weeks</option><option value="month">Months</option></select></label>}
          {f.recurrenceFrequency !== 'none' && <label className="phase-date-label">Repeat until<input className="input" type="date" value={f.recurrenceEndDate} onChange={set('recurrenceEndDate')}/></label>}
          {f.recurrenceFrequency !== 'none' && <label className="phase-date-label">Or total occurrences<input className="input" type="number" min="1" max="365" value={f.recurrenceLimit} onChange={set('recurrenceLimit')}/></label>}
        </div>
        {recurrenceError&&<p className="error">{recurrenceError}</p>}
        <button className="btn btn-primary full" disabled={busy}>{busy ? 'Creating…' : 'Create Task'}</button>
      </form>
    </div>
  );
}
