import { useEffect, useState } from 'react';
import { Activity, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Plus, Target, ClipboardPaste } from 'lucide-react';
import api, { errMsg } from '../api';

const dateKey = (date, timezone) => new Intl.DateTimeFormat('en-CA', {
  timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);
const dayLabel = (key, timezone) => new Intl.DateTimeFormat('en-US', {
  timeZone: timezone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
}).format(new Date(`${key}T12:00:00Z`));
const addDays = (key, count) => {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
};
const taskDate = (task) => task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '';

function TaskRow({ task, onUpdate, onOpen, showDate = false, dateField = 'dueDate', selectionMode = false, selected = false, onToggleSelection }) {
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

function Section({ title, count, children, empty }) {
  return <section className="phase-section"><div className="phase-section-head"><h3>{title}</h3><span>{count}</span></div>{count ? children : <p className="phase-empty-note">{empty}</p>}</section>;
}

export function MyDayPage({ tasks, projects, timezone, onUpdate, onOpen, onQuickAdd }) {
  const today = dateKey(new Date(), timezone);
  const [focusError, setFocusError] = useState('');
  const daily = tasks.filter((task) => task.status !== 'done' && (task.plannedDate === today || task.focusDate === today || taskDate(task) === today));
  const overdue = tasks.filter((task) => task.status !== 'done' && taskDate(task) && taskDate(task) < today);
  const completed = tasks.filter((task) => task.status === 'done' && task.completedAt && dateKey(new Date(task.completedAt), timezone) === today);
  const focus = tasks.filter((task) => task.focusDate === today);
  const toggleFocus = async (task, focused) => {
    setFocusError('');
    try { await onUpdate(task._id, { focusDate: focused ? null : today }); }
    catch (e) { setFocusError(errMsg(e)); }
  };
  const others = tasks.filter((task) => task.status !== 'done' && task.plannedDate !== today && task.focusDate !== today && taskDate(task) !== today && taskDate(task) >= today);
  const plan = (task, plannedDate) => onUpdate(task._id, { plannedDate });
  const progress = daily.length + completed.length ? Math.round((completed.length / (daily.length + completed.length)) * 100) : 0;
  return (
    <section className="phase-page">
      <div className="phase-heading"><div><p className="greet">A fresh start</p><h1 className="big">My Day</h1><p className="muted">{dayLabel(today, timezone)}</p></div><button className="btn btn-primary" onClick={() => onQuickAdd('todo', today)}><Plus size={16} /> Quick Add Task</button></div>
      <div className="day-progress"><div><b>Today’s progress</b><span>{completed.length} of {daily.length + completed.length} complete · {progress}%</span></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div></div>
      {focusError && <p className="error">{focusError}</p>}
      <div className="phase-columns">
        <div>
          <Section title="Today’s tasks" count={daily.length} empty="Nothing planned for today. Add a task or plan one from your list.">
            {daily.map((task) => <TaskRow key={task._id} task={task} onUpdate={onUpdate} onOpen={onOpen} showDate dateField="plannedDate" />)}
          </Section>
          <Section title="Overdue · still needs attention" count={overdue.length} empty="You’re all caught up on overdue tasks.">
            {overdue.map((task) => <TaskRow key={task._id} task={task} onUpdate={onUpdate} onOpen={onOpen} showDate />)}
          </Section>
          <Section title="Completed today" count={completed.length} empty="Completed tasks will appear here.">
            {completed.map((task) => <TaskRow key={task._id} task={task} onUpdate={onUpdate} onOpen={onOpen} />)}
          </Section>
        </div>
        <aside className="phase-focus">
          <div className="phase-section-head"><h3><Target size={17} /> Top 3 focus</h3><span>{focus.length}/3</span></div>
          <p className="muted small">Choose the three tasks that matter most today.</p>
          {focus.map((task) => <TaskRow key={task._id} task={task} onUpdate={onUpdate} onOpen={onOpen} />)}
          {!focus.length && <p className="phase-empty-note">Your focus list is empty.</p>}
          <div className="focus-candidates"><b>Add a focus task</b>{tasks.filter((task) => task.status !== 'done' && task.focusDate !== today).slice(0, 12).map((task) => <button key={task._id} disabled={focus.length >= 3} onClick={() => toggleFocus(task, false)}><Plus size={13} />{task.title}</button>)}</div>
          {focus.map((task) => <button className="remove-focus" key={`remove-${task._id}`} onClick={() => toggleFocus(task, true)}>Remove “{task.title}” from focus</button>)}
          <div className="focus-candidates"><b>Plan an existing task</b>{tasks.filter((task) => task.status !== 'done' && task.plannedDate !== today && taskDate(task) !== today).slice(0, 12).map((task) => <button key={`plan-${task._id}`} onClick={() => plan(task, today)}><Plus size={13} />{task.title}</button>)}</div>
          {daily.filter((task) => task.plannedDate === today).map((task) => <button className="remove-focus" key={`unplan-${task._id}`} onClick={() => plan(task, null)}>Remove “{task.title}” from My Day</button>)}
          <button className="link-gold phase-link" onClick={() => onQuickAdd('todo', today)}><Plus size={14} /> Plan a task for today</button>
          {!!others.length && <p className="phase-muted-bottom">{others.length} other upcoming tasks stay on your list.</p>}
          {projects.length === 0 && <span className="sr-only">No projects yet</span>}
        </aside>
      </div>
    </section>
  );
}

export function CalendarPage({ tasks, projects, timezone, preferences, onPreferenceChange, onUpdate, onOpen, onQuickAdd }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => dateKey(new Date(), timezone));
  const [project, setProject] = useState('all');
  const [priority, setPriority] = useState('all');
  const view = preferences.calendarView || 'month';
  const today = dateKey(new Date(), timezone);
  const monthDate = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const anchor = new Date(`${dateKey(cursor, timezone)}T12:00:00Z`);
  const weekOffset = (anchor.getUTCDay() - (preferences.weekStartsOn || 0) + 7) % 7;
  const firstDay = view === 'week'
    ? new Date(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate() - weekOffset)
    : new Date(cursor.getFullYear(), cursor.getMonth(), 1 - ((monthDate.getDay() - (preferences.weekStartsOn || 0) + 7) % 7));
  const cells = Array.from({ length: view === 'week' ? 7 : 42 }, (_, i) => new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + i));
  const filtered = tasks.filter((task) => (project === 'all' || task.projectId === project) && (priority === 'all' || task.priority === priority));
  const forDate = (key) => filtered.filter((task) => taskDate(task) === key || task.plannedDate === key);
  const selectedTasks = forDate(selected);
  const move = (offset) => setCursor((date) => view === 'week' ? new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset * 7) : new Date(date.getFullYear(), date.getMonth() + offset, 1));
  return (
    <section className="phase-page">
      <div className="phase-heading"><div><p className="greet">Your schedule</p><h1 className="big">Calendar</h1><p className="muted">Plan deadlines and see what’s on your plate.</p></div><button className="btn btn-primary" onClick={() => onQuickAdd('todo', selected)}><Plus size={16} /> Add to {selected}</button></div>
      <div className="calendar-toolbar"><div><button className="icon-btn boxed" onClick={() => move(-1)} aria-label="Previous"><ChevronLeft size={17} /></button><button className="icon-btn boxed" onClick={() => { setCursor(new Date()); setSelected(today); }}>Today</button><button className="icon-btn boxed" onClick={() => move(1)} aria-label="Next"><ChevronRight size={17} /></button><b>{view === 'week' ? `${cells[0]?.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${cells[6]?.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}` : cursor.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</b></div>
        <div><button className={`view-toggle ${view==='month'?'selected':''}`} onClick={() => onPreferenceChange({ calendarView: 'month' })}>Month</button><button className={`view-toggle ${view==='week'?'selected':''}`} onClick={() => onPreferenceChange({ calendarView: 'week' })}>Week</button><select className="select" value={project} onChange={(e) => setProject(e.target.value)}><option value="all">All projects</option>{projects.map((p) => <option value={p._id} key={p._id}>{p.name}</option>)}</select><select className="select" value={priority} onChange={(e) => setPriority(e.target.value)}><option value="all">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
      </div>
      <div className={`calendar-grid ${view}`}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i)=><b className="calendar-weekday" key={d}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][(i+(preferences.weekStartsOn||0))%7]}</b>)}
        {cells.map((date) => {
          const key = dateKey(date, timezone), dayTasks = forDate(key);
          return <button key={key} className={`calendar-cell ${date.getMonth() !== cursor.getMonth() && view === 'month' ? 'outside' : ''} ${key === selected ? 'selected' : ''} ${key === today ? 'is-today' : ''}`} onClick={() => setSelected(key)}>
            <span className="calendar-day-number">{date.getDate()}</span>
            <span className="calendar-events">{dayTasks.slice(0, 3).map((task) => <span key={task._id} className={`calendar-event ${task.priority || 'medium'} ${task.status === 'done' ? 'event-done' : ''}`} onClick={(e) => { e.stopPropagation(); onOpen(task); }}><i />{task.title}</span>)}{dayTasks.length > 3 && <small>+{dayTasks.length - 3} more</small>}</span>
          </button>;
        })}
      </div>
      <div className="calendar-selected"><div className="phase-section-head"><h3><CalendarDays size={16} /> {dayLabel(selected, timezone)}</h3><button className="link-gold" onClick={() => onQuickAdd('todo', selected)}><Plus size={14} /> Add task</button></div>
        {!selectedTasks.length ? <p className="phase-empty-note">No tasks scheduled for this date.</p> : selectedTasks.map((task) => <TaskRow key={task._id} task={task} onUpdate={onUpdate} onOpen={onOpen} showDate />)}
      </div>
    </section>
  );
}

export function UpcomingPage({ tasks, timezone, onUpdate, onOpen, selectionMode = false, selectedTaskIds = new Set(), onToggleSelection, onToggleSelectionMode, onImport }) {
  const today = dateKey(new Date(), timezone);
  const tomorrow = addDays(today, 1), nextWeek = addDays(today, 7);
  const unfinished = tasks.filter((task) => task.status !== 'done');
  const groups = [
    ['Overdue', (t) => taskDate(t) && taskDate(t) < today],
    ['Today', (t) => taskDate(t) === today],
    ['Tomorrow', (t) => taskDate(t) === tomorrow],
    ['Next 7 days', (t) => taskDate(t) > tomorrow && taskDate(t) <= nextWeek],
    ['Later', (t) => taskDate(t) > nextWeek],
    ['Unscheduled', (t) => !taskDate(t)],
  ];
  return <section className="phase-page"><div className="phase-heading"><div><p className="greet">Keep an eye on what’s next</p><h1 className="big">Upcoming tasks</h1><p className="muted">Deadlines grouped into a clear, actionable plan.</p></div><div className="phase-heading-actions"><button className="btn btn-ghost" onClick={onImport}><ClipboardPaste size={15} /> Paste Tasks</button><button className="btn btn-ghost" onClick={onToggleSelectionMode}>{selectionMode ? 'Exit selection' : 'Select tasks'}</button></div></div>
    {groups.map(([label, matches]) => { const items = unfinished.filter(matches).sort((a,b) => (taskDate(a) || '9999').localeCompare(taskDate(b) || '9999')); return <Section key={label} title={label} count={items.length} empty="No tasks here.">{items.map((task) => <TaskRow key={task._id} task={task} onUpdate={onUpdate} onOpen={onOpen} showDate selectionMode={selectionMode} selected={selectedTaskIds.has(task._id)} onToggleSelection={onToggleSelection} />)}</Section>; })}
  </section>;
}

export function ProductivityPage({ timezone, tasks, focusRevision = 0 }) {
  const [data, setData] = useState(null);
  const [focus, setFocus] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/tasks/summary', { params: { timezone } }),
      api.get('/focus/summary', { params: { timezone } }),
    ]).then(([summary, focusSummary]) => {
      if (active) { setData(summary.data); setFocus(focusSummary.data); setError(''); }
    }).catch((e) => { if (active) setError(errMsg(e)); });
    return () => { active = false; };
  }, [timezone, tasks, focusRevision]);
  if (error) return <p className="error">{error}</p>;
  if (!data) return <div className="phase-skeleton" aria-label="Loading productivity" />;
  const metrics = [['Total tasks',data.total],['Completed',data.completed],['In progress',data.inProgress],['Overdue',data.overdue],['Due today',data.dueToday],['Completed this week',data.completedLast7Days]];
  const max = Math.max(1,...data.weekly.map((d) => d.count));
  return <section className="phase-page"><div className="phase-heading"><div><p className="greet">Your momentum</p><h1 className="big">Productivity</h1><p className="muted">A clear view of your work and progress.</p></div></div>
    <div className="productivity-grid">{metrics.map(([label,value])=><div className="stat gold" key={label}><div className="stat-ico"><Activity size={20}/></div><div><strong>{value}</strong><span>{label}</span></div></div>)}</div>
    <div className="phase-panel"><div className="phase-section-head"><h3>Completion rate</h3><b>{data.completionPercent}%</b></div><div className="progress-track"><i style={{width:`${data.completionPercent}%`}}/></div></div>
    <div className="phase-panel"><div className="phase-section-head"><h3><Clock3 size={17}/> Completed · last 7 days</h3><span>Tasks per day</span></div><div className="weekly-chart">{data.weekly.map((day)=><div className="chart-day" key={day.date}><b>{day.count}</b><div className="chart-track"><i style={{height:`${Math.max(day.count ? 8 : 2,day.count/max*100)}%`}}/></div><small>{new Date(`${day.date}T12:00:00Z`).toLocaleDateString('en-US',{timeZone:timezone,weekday:'short'})}</small></div>)}</div></div>
    {focus&&<><div className="productivity-grid focus-analytics-metrics">{[['Focus today',`${focus.todayMinutes} min`],['Focus this week',`${focus.weekMinutes} min`],['Completed sessions',focus.completedSessions]].map(([label,value])=><div className="stat gold" key={label}><div className="stat-ico"><Target size={19}/></div><div><strong>{value}</strong><span>{label}</span></div></div>)}</div>
      <div className="phase-panel"><div className="phase-section-head"><h3><Target size={17}/> Focus time · last 7 days</h3><span>Minutes per day</span></div><div className="weekly-chart">{focus.byDay.map((day)=><div className="chart-day" key={day.date}><b>{day.minutes}</b><div className="chart-track"><i style={{height:`${Math.max(day.minutes ? 8 : 2,day.minutes/Math.max(1,...focus.byDay.map((item)=>item.minutes))*100)}%`}}/></div><small>{new Date(`${day.date}T12:00:00Z`).toLocaleDateString('en-US',{timeZone:timezone,weekday:'short'})}</small></div>)}</div></div>
      <div className="phase-panel"><div className="phase-section-head"><h3>Focus time by project · last 7 days</h3></div>{focus.byProject.length ? focus.byProject.map((item)=><div className="focus-project-row" key={item.project}><span>{item.project}</span><b>{item.minutes} min</b></div>) : <p className="phase-empty-note">Complete a focus session to see project totals.</p>}</div>
    </>}
  </section>;
}

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
