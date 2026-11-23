import { ClipboardPaste } from 'lucide-react';
import { dateKey, addDays, taskDate, TaskRow, Section } from './shared';

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
