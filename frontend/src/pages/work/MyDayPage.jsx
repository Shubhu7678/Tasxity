import { useState } from 'react';
import { Plus, Target } from 'lucide-react';
import { errMsg } from '../../api';
import { dateKey, dayLabel, taskDate, TaskRow, Section } from './shared';

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
