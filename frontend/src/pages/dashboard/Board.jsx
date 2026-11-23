import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CalendarDays, Plus, ChevronLeft, ChevronRight, Check, Trash2, ArrowRight, Repeat,
} from 'lucide-react';
import { COLUMNS } from './constants';
import { fmt, timelineGroups } from './helpers';

export function KanbanColumn({ column, index, tasks, total, onUpdate, onDelete, onAdd, onOpen, dragDisabled, timezone, selectionMode, selectedTaskIds, onToggleSelection }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${column.key}` });
  return (
    <div ref={setNodeRef} className={`col ${column.key} ${isOver ? 'drop-target' : ''}`}>
      <div className="col-head"><b>{column.label}</b><span>{total}</span></div>
      <SortableContext items={tasks.map((task) => `task:${task._id}`)} strategy={verticalListSortingStrategy}>
        {tasks.map((task) => (
          <KanbanTask key={task._id} task={task} index={index} timezone={timezone} onUpdate={onUpdate}
            onDelete={onDelete} onOpen={onOpen} disabled={dragDisabled} selectionMode={selectionMode}
            selected={selectedTaskIds.has(task._id)} onToggleSelection={onToggleSelection} />
        ))}
      </SortableContext>
      <button className="add" onClick={onAdd}><Plus size={14} /> Add Task</button>
    </div>
  );
}

export function KanbanTask({ task, index, timezone, onUpdate, onDelete, onOpen, disabled, selectionMode, selected, onToggleSelection }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `task:${task._id}`,
    disabled,
  });
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const taskDue = task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '';
  const dayDistance = taskDue ? (Date.parse(`${taskDue}T00:00:00Z`) - Date.parse(`${todayKey}T00:00:00Z`)) / 86400000 : null;
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };
  return (
    <div ref={setNodeRef} style={style} className={`task ${task.status === 'done' ? 'done' : ''} ${taskDue && taskDue < todayKey && task.status !== 'done' ? 'overdue' : ''}`} onClick={() => onOpen(task)}>
      <button className="drag-handle" onClick={(e) => e.stopPropagation()} {...attributes} {...listeners} aria-label={`Drag ${task.title}`} title="Drag task">
        <span aria-hidden="true">⠿</span>
      </button>
      {selectionMode && <input className="task-select-checkbox" type="checkbox" checked={selected} aria-label={`Select ${task.title}`}
        onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}
        onChange={() => onToggleSelection(task._id)} />}
      <button className="check" disabled={disabled} onClick={(e) => { e.stopPropagation(); onUpdate(task._id, { status: task.status === 'done' ? 'todo' : 'done' }); }}>
        {task.status === 'done' && <Check size={12} />}
      </button>
      <div className="task-body">
        <p>{task.title}</p>
        <div className="tags"><span>{task.project}</span><span className={`priority-pill ${task.priority || 'medium'}`}>{task.priority || 'medium'}</span>{task.recurrenceSeriesId&&task.recurrence?.active!==false&&<span title="Recurring task"><Repeat size={11}/></span>}{task.tag && <span className="tag">{task.tag}</span>}</div>
        {task.dueDate && <small className={task.status === 'done' ? '' : dayDistance < 0 ? 'due-overdue' : dayDistance === 0 ? 'due-today' : dayDistance <= 3 ? 'due-soon' : ''}><CalendarDays size={12} /> {dayDistance === 0 && task.status !== 'done' ? 'Due today · ' : ''}{fmt(task.dueDate)}</small>}
        {task.subtasks?.length > 0 && <small>{task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} subtasks</small>}
      </div>
      <div className="task-actions" onClick={(e) => e.stopPropagation()}>
        {index < 3 && <button disabled={disabled} title="Move forward" onClick={() => onUpdate(task._id, { status: COLUMNS[index + 1].key })}><ArrowRight size={13} /></button>}
        <button disabled={disabled} title="Delete" onClick={() => onDelete(task._id)}><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

export function OverviewList({ tasks, onUpdate, onOpen, selectionMode, selectedTaskIds, onToggleSelection }) {
  if (!tasks.length) return <div className="projects-empty board-empty"><h3>No tasks match these filters</h3><p>Try adjusting your search or filters.</p></div>;
  return <section className="overview-list-view">
    <div className="overview-list-header"><span>Task</span><span>Status</span><span>Priority</span><span>Due date</span></div>
    {tasks.map((task) => (
      <div className="overview-list-row" key={task._id}>
        <div className="overview-list-task">
          {selectionMode && <input className="task-select-checkbox" type="checkbox" checked={selectedTaskIds.has(task._id)} aria-label={`Select ${task.title}`} onChange={() => onToggleSelection(task._id)} />}
          <button className={`task-check ${task.status === 'done' ? 'checked' : ''}`} onClick={() => onUpdate(task._id, { status: task.status === 'done' ? 'todo' : 'done' })} aria-label={task.status === 'done' ? 'Reopen task' : 'Complete task'}>
            {task.status === 'done' && <Check size={12} />}
          </button>
          <button className="overview-list-title" onClick={() => onOpen(task)}>
            <b>{task.title}{task.recurrenceSeriesId && task.recurrence?.active !== false && <Repeat size={12} className="recurring-mark" aria-label="Recurring task" />}</b>
            <small>{task.project || 'Personal'}{task.tag ? ` · ${task.tag}` : ''}</small>
          </button>
        </div>
        <select className="overview-list-select" value={task.status} aria-label={`Status for ${task.title}`} onChange={(event) => onUpdate(task._id, { status: event.target.value })}>
          {COLUMNS.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}
        </select>
        <select className="overview-list-select" value={task.priority || 'medium'} aria-label={`Priority for ${task.title}`} onChange={(event) => onUpdate(task._id, { priority: event.target.value })}>
          <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <span className="overview-list-date">{task.dueDate ? fmt(task.dueDate) : '—'}</span>
      </div>
    ))}
  </section>;
}

export function OverviewTimeline({ tasks, timezone, onUpdate, onOpen, selectionMode, selectedTaskIds, onToggleSelection }) {
  const groups = timelineGroups(tasks, timezone);
  if (!groups.length) return <div className="projects-empty board-empty"><h3>No tasks match these filters</h3><p>Try adjusting your search or filters.</p></div>;
  return <section className="overview-timeline">
    {groups.map((group) => <div className="timeline-group" key={group.date}>
      <div className="timeline-date"><i /><b>{group.label}</b><span>{group.tasks.length}</span></div>
      <div className="timeline-tasks">{group.tasks.map((task) => (
        <article className="timeline-task" key={task._id}>
          {selectionMode && <input className="task-select-checkbox" type="checkbox" checked={selectedTaskIds.has(task._id)} aria-label={`Select ${task.title}`} onChange={() => onToggleSelection(task._id)} />}
          <button className={`task-check ${task.status === 'done' ? 'checked' : ''}`} onClick={() => onUpdate(task._id, { status: task.status === 'done' ? 'todo' : 'done' })} aria-label={task.status === 'done' ? 'Reopen task' : 'Complete task'}>
            {task.status === 'done' && <Check size={12} />}
          </button>
          <button className="timeline-task-title" onClick={() => onOpen(task)}><b>{task.title}</b><small>{task.project || 'Personal'}</small></button>
          <span className={`priority-pill ${task.priority || 'medium'}`}>{task.priority || 'medium'}</span>
          <select className="overview-list-select" value={task.status} aria-label={`Status for ${task.title}`} onChange={(event) => onUpdate(task._id, { status: event.target.value })}>
            {COLUMNS.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}
          </select>
        </article>
      ))}</div>
    </div>)}
  </section>;
}

export function MiniCalendar({ tasks }) {
  const [cur, setCur] = useState(() => new Date());
  const y = cur.getFullYear(), m = cur.getMonth();
  const first = new Date(y, m, 1).getDay();
  const cells = Array.from({ length: 42 }, (_, i) => new Date(y, m, i - first + 1));
  const due = new Set(tasks.filter((t) => t.dueDate).map((t) => new Date(t.dueDate).toDateString()));
  const today = new Date().toDateString();
  return (
    <div className="panel">
      <div className="panel-head">
        <h4>{cur.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h4>
        <div>
          <button className="icon-btn" onClick={() => setCur(new Date(y, m - 1, 1))}><ChevronLeft size={16} /></button>
          <button className="icon-btn" onClick={() => setCur(new Date(y, m + 1, 1))}><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="cal">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <b key={d}>{d}</b>)}
        {cells.map((d) => (
          <span key={d.toISOString()}
            className={`${d.getMonth() !== m ? 'dim' : ''} ${d.toDateString() === today ? 'today' : ''} ${due.has(d.toDateString()) ? 'has' : ''}`}>
            {d.getDate()}
          </span>
        ))}
      </div>
    </div>
  );
}
