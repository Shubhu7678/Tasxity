import { useEffect, useState } from 'react';
import { errMsg } from '../../api';

export function SettingsPage({ preferences, onSave, onShowShortcuts }) {
  const [form,setForm]=useState(preferences);
  const [saved,setSaved]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>setForm(preferences),[preferences]);
  const submit=async(e)=>{e.preventDefault();setError('');try{await onSave(form);setSaved(true);setTimeout(()=>setSaved(false),2000);}catch(e){setError(errMsg(e));}};
  const enableBrowser = async (enabled) => {
    if (enabled && !('Notification' in window)) {
      setError('This browser does not support desktop notifications.');
      return;
    }
    if (enabled) {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') { setError('Browser permission was not granted. In-app reminders will still work.'); return; }
      } catch {
        setError('Could not request browser notification permission. In-app reminders will still work.');
        return;
      }
    }
    setForm({ ...form, browserNotifications: enabled });
  };
  return <section className="phase-page"><div className="phase-heading"><div><p className="greet">Make Tasxity yours</p><h1 className="big">Preferences</h1><p className="muted">Choose how dates and calendars work for you.</p></div></div>
    <form className="phase-panel preferences-form" onSubmit={submit}>{error&&<p className="error">{error}</p>}<label>Timezone<select className="input" value={form.timezone} onChange={(e)=>setForm({...form,timezone:e.target.value})}>{['Asia/Kolkata','America/Los_Angeles','America/New_York','Europe/London','Europe/Paris','UTC'].map((tz)=><option key={tz}>{tz}</option>)}{form.timezone && !['Asia/Kolkata','America/Los_Angeles','America/New_York','Europe/London','Europe/Paris','UTC'].includes(form.timezone) && <option>{form.timezone}</option>}</select></label>
      <label>Week starts on<select className="input" value={form.weekStartsOn} onChange={(e)=>setForm({...form,weekStartsOn:Number(e.target.value)})}><option value={0}>Sunday</option><option value={1}>Monday</option></select></label>
      <label>Default calendar view<select className="input" value={form.calendarView} onChange={(e)=>setForm({...form,calendarView:e.target.value})}><option value="month">Month</option><option value="week">Week</option></select></label>
      <label>Focus duration (minutes)<input className="input" type="number" min="1" max="240" value={form.focusMinutes || 25} onChange={(e)=>setForm({...form,focusMinutes:Number(e.target.value)})}/></label>
      <label>Short break (minutes)<input className="input" type="number" min="1" max="60" value={form.shortBreakMinutes || 5} onChange={(e)=>setForm({...form,shortBreakMinutes:Number(e.target.value)})}/></label>
      <label>Long break (minutes)<input className="input" type="number" min="1" max="120" value={form.longBreakMinutes || 15} onChange={(e)=>setForm({...form,longBreakMinutes:Number(e.target.value)})}/></label>
      <label>Default reminder<select className="input" value={form.reminderDefault || 'none'} onChange={(e)=>setForm({...form,reminderDefault:e.target.value})}><option value="none">None</option><option value="due">At due time</option><option value="10m">10 minutes before</option><option value="30m">30 minutes before</option><option value="1h">1 hour before</option><option value="1d">1 day before</option></select></label>
      <label>Recurring task default<select className="input" value={form.recurrenceDefault || 'none'} onChange={(e)=>setForm({...form,recurrenceDefault:e.target.value})}><option value="none">None</option><option value="daily">Daily</option><option value="weekdays">Every weekday</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
      <label className="preference-check"><input type="checkbox" checked={!!form.browserNotifications} onChange={(e)=>enableBrowser(e.target.checked)}/> Browser notifications (only while Tasxity is open)</label>
      <label className="preference-check"><input type="checkbox" checked={!!form.soundNotifications} onChange={(e)=>setForm({...form,soundNotifications:e.target.checked})}/> Sound notifications</label>
      <button type="button" className="btn btn-ghost" onClick={onShowShortcuts}>Keyboard shortcuts</button>
      <button className="btn btn-primary">{saved?'Saved':'Save preferences'}</button>
    </form>
  </section>;
}
