import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { dateKey, dayLabel, taskDate, TaskRow } from './shared';

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
