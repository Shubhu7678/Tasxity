import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Home, CheckSquare, FolderKanban, Columns3, GanttChart, CalendarDays, BarChart3, Search, Bell,
  Plus, ChevronLeft, ChevronRight, ChevronDown, Target, Activity, Check, ListTodo, LogOut, X, Trash2, ArrowRight, Filter, Archive, Pencil, Repeat, Keyboard, Copy, ClipboardPaste,
} from 'lucide-react';
import Logo from '../components/Logo';
import Mountain from '../components/Mountain';
import SmartPasteModal from '../components/SmartPasteModal';
import { useAuth } from '../context/AuthContext';
import api, { errMsg } from '../api';
import { CalendarPage, MyDayPage, ProductivityPage, SettingsPage, UpcomingPage } from './PhaseFive';
import { CommandPalette, FocusMode, ShortcutsDialog } from './PhaseSix';
import ProfilePage from './ProfilePage';
import { zonedDateTimeToISO, zonedDateTimeValue } from '../utils/dates';
import { formatTasksForCopy } from '../utils/smartPaste';

const COLUMNS = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
];
const NAV = [
  ['Overview', Home], ['My Day', CheckSquare], ['My Tasks', ListTodo], ['Projects', FolderKanban], ['Boards', Columns3], ['Calendar', CalendarDays],
];
const SIDEBAR_FOOTER_NAV = [['Reports', BarChart3], ['Settings', Activity]];
const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const ago = (d) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(d)) / 60000));
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} hours ago` : `${Math.round(m / 1440)} days ago`;
};
const isTypingTarget = (target) => target instanceof HTMLElement
  && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
const upcomingTaskOrder = (tasks, timezone) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const addDays = (date, amount) => {
    const next = new Date(`${date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + amount);
    return next.toISOString().slice(0, 10);
  };
  const tomorrow = addDays(today, 1), nextWeek = addDays(today, 7);
  const due = (task) => task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '';
  const openTasks = tasks.filter((task) => task.status !== 'done');
  const groups = [
    (task) => due(task) && due(task) < today,
    (task) => due(task) === today,
    (task) => due(task) === tomorrow,
    (task) => due(task) > tomorrow && due(task) <= nextWeek,
    (task) => due(task) > nextWeek,
    (task) => !due(task),
  ];
  return groups.flatMap((matches) => openTasks.filter(matches).sort((a, b) => (due(a) || '9999').localeCompare(due(b) || '9999')));
};
const timelineGroups = (tasks, timezone) => {
  const dateKey = (date) => new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
  const today = dateKey(new Date());
  const dueDate = (task) => task.plannedDate || (task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '');
  const groups = new Map();
  tasks.forEach((task) => {
    const key = dueDate(task) || 'unscheduled';
    groups.set(key, [...(groups.get(key) || []), task]);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => a === 'unscheduled' ? 1 : b === 'unscheduled' ? -1 : a.localeCompare(b))
    .map(([date, items]) => ({
      date,
      label: date === 'unscheduled'
        ? 'No scheduled date'
        : date === today
          ? 'Today'
          : new Intl.DateTimeFormat('en-US', {
            timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
          }).format(new Date(`${date}T12:00:00Z`)),
      tasks: items,
    }));
};

function KanbanColumn({ column, index, tasks, total, onUpdate, onDelete, onAdd, onOpen, dragDisabled, timezone, selectionMode, selectedTaskIds, onToggleSelection }) {
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

function KanbanTask({ task, index, timezone, onUpdate, onDelete, onOpen, disabled, selectionMode, selected, onToggleSelection }) {
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

function OverviewList({ tasks, onUpdate, onOpen, selectionMode, selectedTaskIds, onToggleSelection }) {
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

function OverviewTimeline({ tasks, timezone, onUpdate, onOpen, selectionMode, selectedTaskIds, onToggleSelection }) {
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

function MiniCalendar({ tasks }) {
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

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [dueFilter, setDueFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [activePage, setActivePage] = useState('Overview');
  const [overviewView, setOverviewView] = useState('board');
  const [activeProject, setActiveProject] = useState(null);
  const [draggedTask, setDraggedTask] = useState(null);
  const [reordering, setReordering] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [preferences, setPreferences] = useState(user.preferences || { timezone: 'Asia/Kolkata', weekStartsOn: 0, calendarView: 'month' });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [upcomingReminders, setUpcomingReminders] = useState([]);
  const [snoozeTimes, setSnoozeTimes] = useState({});
  const [focusRevision, setFocusRevision] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState(() => new Set());
  const [copyFormat, setCopyFormat] = useState('plain');
  const [success, setSuccess] = useState('');
  const [projectCopyPending, setProjectCopyPending] = useState(null);
  const [projectCopyBusy, setProjectCopyBusy] = useState(false);
  const [tasksRevision, setTasksRevision] = useState(0);
  const searchInput = useRef(null);
  const goSequence = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const resetTaskSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedTaskIds(new Set());
  }, []);
  const navigateToPage = useCallback((page) => {
    resetTaskSelection();
    if (page === 'Timeline') setOverviewView('timeline');
    if (page === 'Boards') setOverviewView('board');
    setActivePage(page);
  }, [resetTaskSelection]);
  const changeOverviewView = (view) => {
    if (view === 'calendar') resetTaskSelection();
    setOverviewView(view);
  };
  const openWorkspace = (projectId) => {
    navigateToPage('Overview');
    setActiveProject(null);
    setOverviewView('board');
    setProjectFilter(projectId);
    setFilter('all');
    setPriorityFilter('all');
    setDueFilter('all');
    setSearch('');
  };

  useEffect(() => {
    api.get('/tasks').then((r) => setTasks(r.data)).catch((e) => setError(errMsg(e))).finally(() => setTasksLoading(false));
    api.get('/projects').then((r) => setProjects(r.data)).catch((e) => setError(errMsg(e)));
  }, []);

  useEffect(() => {
    const handler = (event) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && key === 'v' && !isTypingTarget(event.target)) {
        event.preventDefault(); setImportOpen(true); return;
      }
      if ((event.metaKey || event.ctrlKey) && key === 'k' && !isTypingTarget(event.target)) { event.preventDefault(); setPaletteOpen(true); return; }
      if (key === 'escape') {
        setPaletteOpen(false); setShortcutsOpen(false); setFocusOpen(false); setNotificationsOpen(false);
        setModal(null); setEditingTask(null); setImportOpen(false); setProjectCopyPending(null);
        resetTaskSelection(); return;
      }
      if (isTypingTarget(event.target)) return;
      if (goSequence.current) {
        goSequence.current = false;
        const page = { o: 'Overview', m: 'My Day', c: 'Calendar' }[key];
        if (page) navigateToPage(page);
        return;
      }
      if (key === 'g') { goSequence.current = true; window.setTimeout(() => { goSequence.current = false; }, 900); }
      if (key === 'n') setModal({ status: 'todo' });
      if (key === '/') { event.preventDefault(); searchInput.current?.focus(); }
      if (key === '?') setShortcutsOpen(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigateToPage, resetTaskSelection]);

  useEffect(() => {
    let active = true;
    const loadNotifications = async () => {
      try {
        const { data } = await api.get('/reminders');
        if (!active) return;
        setNotifications(data.notifications);
        setUpcomingReminders(data.upcoming || []);
        if (preferences.browserNotifications && 'Notification' in window && Notification.permission === 'granted') {
          data.newlyDelivered.forEach((reminder) => new Notification('Tasxity reminder', { body: reminder.task.title }));
        }
        if (preferences.soundNotifications && data.newlyDelivered.length) {
          const AudioContextType = window.AudioContext || window.webkitAudioContext;
          if (AudioContextType) {
            const context = new AudioContextType();
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.frequency.value = 660;
            gain.gain.setValueAtTime(0.06, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
            oscillator.connect(gain); gain.connect(context.destination);
            oscillator.start(); oscillator.stop(context.currentTime + 0.18);
            oscillator.onended = () => context.close();
          }
        }
      } catch (e) { setError(errMsg(e)); }
    };
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 60000);
    const focusListener = () => loadNotifications();
    window.addEventListener('focus', focusListener);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', focusListener); };
  }, [preferences.browserNotifications, preferences.soundNotifications]);

  const updateReminder = async (notice, action, options = {}) => {
    try {
      await api.patch(`/reminders/${notice._id}`, { action, ...options, timezone: preferences.timezone });
      setNotifications((list) => list.filter((item) => item._id !== notice._id));
      setUpcomingReminders((list) => list.filter((item) => item._id !== notice._id));
      setSnoozeTimes((current) => { const next = { ...current }; delete next[notice._id]; return next; });
    } catch (e) { setError(errMsg(e)); }
  };

  const create = async (data) => {
    try {
      const { data: t } = await api.post('/tasks', data);
      setTasks((p) => [t, ...p]);
      if (t.status === 'done' && t.recurrenceSeriesId) {
        try { const refreshed = await api.get('/tasks'); setTasks(refreshed.data); }
        catch (refreshError) { setError(errMsg(refreshError)); }
      }
      setModal(null);
      return true;
    } catch (e) { setError(errMsg(e)); }
  };
  const update = async (id, patch) => {
    try {
      const { data: t } = await api.put(`/tasks/${id}`, patch);
      setTasks((p) => p.map((x) => (x._id === id ? t : x)));
      const current = tasks.find((task) => task._id === id);
      if ((patch.status === 'done' && current?.status !== 'done' && current?.recurrenceSeriesId)
        || ('recurrence' in patch && (current?.recurrenceSeriesId || patch.recurrence?.frequency))) {
        try { const refreshed = await api.get('/tasks'); setTasks(refreshed.data); }
        catch (refreshError) { setError(errMsg(refreshError)); }
      }
      return true;
    } catch (e) { setError(errMsg(e)); return false; }
  };
  const remove = async (id) => {
    try {
      await api.delete(`/tasks/${id}`);
      setTasks((p) => p.filter((x) => x._id !== id));
      return true;
    } catch (e) { setError(errMsg(e)); return false; }
  };
  const stopRecurrence = async (id) => {
    try {
      await api.patch(`/tasks/${id}/stop-recurrence`);
      const { data } = await api.get('/tasks');
      setTasks(data);
      setEditingTask((current) => current?._id === id ? data.find((task) => task._id === id) || current : current);
      return true;
    } catch (e) { setError(errMsg(e)); return false; }
  };
  const finishDrag = async ({ active, over }) => {
    setDraggedTask(null);
    if (!over || active.id === over.id) return;
    const taskId = String(active.id).replace('task:', '');
    const targetId = String(over.id);
    const targetStatus = targetId.startsWith('column:')
      ? targetId.slice(7)
      : tasks.find((task) => `task:${task._id}` === targetId)?.status;
    const task = tasks.find((item) => item._id === taskId);
    if (!task || !targetStatus || reordering || !dragEnabled) return;
    const snapshot = tasks;
    const source = tasks.filter((item) => item.status === task.status).sort((a, b) => a.order - b.order);
    const target = targetStatus === task.status ? source : tasks.filter((item) => item.status === targetStatus).sort((a, b) => a.order - b.order);
    const from = source.findIndex((item) => item._id === taskId);
    const to = targetStatus === task.status
      ? (targetId.startsWith('task:') ? target.findIndex((item) => `task:${item._id}` === targetId) : target.length - 1)
      : (targetId.startsWith('task:') ? target.findIndex((item) => `task:${item._id}` === targetId) : target.length);
    const moved = targetStatus === task.status
      ? arrayMove(source, from, Math.max(0, to))
      : (() => { const remaining = source.filter((item) => item._id !== taskId); const next = [...target]; next.splice(Math.max(0, to), 0, task); return { source: remaining, target: next }; })();
    const sourceResult = targetStatus === task.status ? moved : moved.source;
    const targetResult = targetStatus === task.status ? moved : moved.target;
    const changed = [
      ...sourceResult.map((item, order) => ({ id: item._id, status: task.status, order })),
      ...(targetStatus === task.status ? [] : targetResult.map((item, order) => ({ id: item._id, status: targetStatus, order }))),
    ];
    setReordering(true);
    setTasks((list) => list.map((item) => {
      const position = changed.find((entry) => entry.id === item._id);
      return position ? { ...item, status: position.status, order: position.order,
        completedAt: position.status === 'done' ? item.completedAt || new Date().toISOString() : null } : item;
    }));
    try {
      await api.put('/tasks/reorder', { tasks: changed });
      if (targetStatus === 'done' && task.status !== 'done' && task.recurrenceSeriesId) {
        try { const refreshed = await api.get('/tasks'); setTasks(refreshed.data); }
        catch (refreshError) { setError(errMsg(refreshError)); }
      }
    } catch (e) {
      setTasks((list) => list.map((item) => {
        const previous = snapshot.find((entry) => entry._id === item._id);
        return previous && changed.some((entry) => entry.id === item._id)
          ? { ...item, status: previous.status, order: previous.order, completedAt: previous.completedAt }
          : item;
      }));
      if (e.response?.status === 404) {
        api.get('/tasks').then((r) => setTasks(r.data)).catch((fetchError) => setError(errMsg(fetchError)));
      }
      setError(errMsg(e));
      window.setTimeout(() => setError(''), 4500);
    } finally {
      setReordering(false);
    }
  };

  const clearFilters = () => { setFilter('all'); setPriorityFilter('all'); setProjectFilter('all'); setDueFilter('all'); setSearch(''); };
  const dragEnabled = filter === 'all' && priorityFilter === 'all' && projectFilter === 'all' && dueFilter === 'all' && !search;
  const visible = useMemo(
    () => tasks.filter((t) => (filter === 'all' || t.status === filter)
      && (priorityFilter === 'all' || t.priority === priorityFilter)
      && (projectFilter === 'all' || t.projectId === projectFilter)
      && (dueFilter === 'all' || (dueFilter === 'overdue' ? t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done'
        : dueFilter === 'today' ? t.dueDate && new Date(t.dueDate).toDateString() === new Date().toDateString()
          : !t.dueDate))
      && t.title.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => COLUMNS.findIndex((column) => column.key === a.status) - COLUMNS.findIndex((column) => column.key === b.status)
        || (a.order ?? 0) - (b.order ?? 0)),
    [tasks, filter, priorityFilter, projectFilter, dueFilter, search]
  );
  const count = (s) => visible.filter((t) => t.status === s).length;
  const weekEnd = Date.now() + 7 * 864e5;
  const dueWeek = tasks.filter((t) => t.dueDate && t.status !== 'done' && new Date(t.dueDate) <= weekEnd).length;
  const focus = tasks.filter((t) => t.status !== 'done').slice(0, 3);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const initials = user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const stats = [
    ['Total Tasks', tasks.length, ListTodo, 'gold'],
    ['In Progress', count('in_progress'), Activity, 'blue'],
    ['Completed', count('done'), Check, 'green'],
    ['Due This Week', dueWeek, CalendarDays, 'red'],
  ];
  const upcomingTasks = upcomingTaskOrder(tasks, preferences.timezone);
  const canSelectTasks = activePage === 'Overview' || activePage === 'Timeline' || activePage === 'Boards'
    || activePage === 'My Tasks' || (activePage === 'Projects' && activeProject);
  const visibleSelectionTasks = activePage === 'My Tasks'
    ? upcomingTasks
    : activePage === 'Projects' && activeProject
      ? tasks.filter((task) => task.projectId === activeProject._id)
      : visible;
  const activeOverviewView = overviewView;
  const selectedVisibleTasks = visibleSelectionTasks.filter((task) => selectedTaskIds.has(task._id));
  const toggleSelection = (id) => setSelectedTaskIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const toggleSelectionMode = () => {
    setSelectionMode((enabled) => !enabled);
    setSelectedTaskIds(new Set());
  };
  const copyTasks = async (copyList, format = copyFormat, projectName = '') => {
    if (!copyList.length) {
      setError('There are no tasks to copy.');
      return false;
    }
    if (!navigator.clipboard?.writeText) {
      setError('Clipboard access is unavailable. Use a secure browser context and try again.');
      return false;
    }
    try {
      await navigator.clipboard.writeText(formatTasksForCopy(copyList, format, projectName));
      setError('');
      setSuccess(`${copyList.length} task${copyList.length === 1 ? '' : 's'} copied.`);
      window.setTimeout(() => setSuccess(''), 3500);
      return true;
    } catch (copyError) {
      setError(copyError.message || errMsg(copyError) || 'Could not write tasks to the clipboard.');
      return false;
    }
  };
  const importCreatedTasks = (createdTasks) => {
    if (!createdTasks.length) return;
    setTasks((current) => {
      const createdIds = new Set(createdTasks.map((task) => task._id));
      return [...createdTasks, ...current.filter((task) => !createdIds.has(task._id))];
    });
    setTasksRevision((revision) => revision + 1);
    setSuccess(`${createdTasks.length} task${createdTasks.length === 1 ? '' : 's'} created.`);
    window.setTimeout(() => setSuccess(''), 3500);
  };
  const copyProjectTasks = async (project, format) => {
    setProjectCopyBusy(true);
    setError('');
    try {
      const params = { projectId: project._id, offset: 0, limit: 200 };
      const firstPage = await api.get('/tasks/project-export', { params });
      if (firstPage.data.total > 500) {
        setProjectCopyPending({ project, format, total: firstPage.data.total });
        return;
      }
      await finishProjectCopy(project, format, firstPage.data);
    } catch (copyError) {
      setError(copyError.response?.data?.message || copyError.message || errMsg(copyError));
    } finally {
      setProjectCopyBusy(false);
    }
  };
  const finishProjectCopy = async (project, format, initialPage = null) => {
    setProjectCopyBusy(true);
    setError('');
    try {
      const firstPage = initialPage || (await api.get('/tasks/project-export', {
        params: { projectId: project._id, offset: 0, limit: 200 },
      })).data;
      const allTasks = [...firstPage.tasks];
      let total = firstPage.total;
      while (allTasks.length < total) {
        const page = await api.get('/tasks/project-export', {
          params: { projectId: project._id, offset: allTasks.length, limit: 200 },
        });
        if (!page.data.tasks.length) throw new Error('Project task pagination ended before every task was retrieved.');
        allTasks.push(...page.data.tasks);
        total = page.data.total;
      }
      if (allTasks.length !== total) throw new Error('The project task list changed while copying. Please try again.');
      if (await copyTasks(allTasks, format, project.name)) setProjectCopyPending(null);
    } catch (copyError) {
      setError(copyError.response?.data?.message || copyError.message || errMsg(copyError));
    } finally {
      setProjectCopyBusy(false);
    }
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <Logo />
        <button className="sidebar-search" type="button" onClick={() => setPaletteOpen(true)}>
          <Search size={14} /><span>Quick search</span><kbd>⌘ K</kbd>
        </button>
        <div className="sidebar-scroll">
          <div className="sidebar-section-label">Workspace</div>
          <nav>
            {NAV.map(([n, Icon]) => (
              <a key={n} className={activePage === n ? 'active' : ''} onClick={() => navigateToPage(n)}><Icon size={17} /> {n}{n === 'My Tasks' && <em>{tasks.length}</em>}</a>
            ))}
          </nav>
          <div className="sidebar-workspaces">
            <div className="ws-head"><span>My Spaces</span><button onClick={() => { navigateToPage('Projects'); setActiveProject(null); setShowArchived(false); }} aria-label="Add workspace"><Plus size={15} /></button></div>
            <a className={`ws ${activePage === 'Overview' && projectFilter === 'all' ? 'active' : ''}`}
              role="button" tabIndex={0} aria-current={activePage === 'Overview' && projectFilter === 'all' ? 'page' : undefined}
              onClick={() => openWorkspace('all')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openWorkspace('all');
                }
              }}><i style={{ background: 'var(--gold)' }} /> All tasks</a>
            {projects.filter((p) => !p.archived).map((p) => (
              <a key={p._id} className={`ws ${activePage === 'Overview' && projectFilter === p._id ? 'active' : ''}`}
                role="button" tabIndex={0} aria-current={activePage === 'Overview' && projectFilter === p._id ? 'page' : undefined}
                onClick={() => openWorkspace(p._id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openWorkspace(p._id);
                  }
                }}><i style={{ background: p.color }} /> {p.name}</a>
            ))}
            {!projects.some((project) => !project.archived) && <button className="sidebar-empty-space" onClick={() => { navigateToPage('Projects'); setActiveProject(null); setShowArchived(false); }}>
                <Plus size={13} /> Create a space
            </button>}
          </div>
        </div>
        <div className="sidebar-footer">
          <nav className="sidebar-utility-nav">
            {SIDEBAR_FOOTER_NAV.map(([name, Icon]) => (
                <a key={name} className={activePage === name ? 'active' : ''} onClick={() => navigateToPage(name)}><Icon size={16} /> {name}</a>
            ))}
          </nav>
          <button className={`sidebar-account ${activePage === 'Profile' ? 'active' : ''}`} onClick={() => navigateToPage('Profile')}>
            <span className="sidebar-account-avatar">{initials}</span>
            <span className="sidebar-account-copy"><b>My Account</b><small>{user.isGuest ? 'Guest workspace' : 'Personal workspace'}</small></span>
            <ChevronDown size={14} />
          </button>
        </div>
      </aside>

      <main className="main">
        <Mountain className="main-bg" />
        <div className="topbar">
          <label className="search"><Search size={16} />
            <input ref={searchInput} placeholder="Search tasks, projects or people..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button type="button" className="search-clear" onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}
            <kbd>⌘ K</kbd>
          </label>
          <button className="btn btn-ghost focus-launch" onClick={() => setFocusOpen(true)}><Target size={15}/> Focus</button>
          <div className="notification-wrap"><button className="icon-btn bell" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="Notifications"><Bell size={18} />{(notifications.length+upcomingReminders.length)>0&&<i/>}</button>
            {notificationsOpen&&<div className="notification-popover"><div className="panel-head"><h4>Reminders</h4><span>{notifications.length+upcomingReminders.length}</span></div>
              {!notifications.length&&!upcomingReminders.length?<p className="phase-empty-note">No scheduled reminders. Tasxity checks while the app is open.</p>:<>
                {notifications.map((notice)=><div className="notification-item" key={notice._id}>
                  <b><button className="notification-title" onClick={()=>{setEditingTask(tasks.find((task)=>task._id===notice.task?._id)||notice.task);setNotificationsOpen(false);}}>{notice.task?.title}</button></b>
                  <small>{notice.task?.project||'Personal'} · due {notice.task?.dueDate?fmt(notice.task.dueDate):'soon'}</small>
                  <div><button onClick={()=>updateReminder(notice,'snooze',{minutes:10})}>Snooze 10m</button><button onClick={()=>updateReminder(notice,'snooze',{minutes:60})}>1h</button><button onClick={()=>updateReminder(notice,'snooze',{minutes:'tomorrow'})}>Tomorrow</button><button onClick={()=>updateReminder(notice,'dismiss')}>Dismiss</button></div>
                  <div className="notification-custom"><input type="datetime-local" value={snoozeTimes[notice._id]||''} aria-label={`Custom snooze time for ${notice.task?.title} (${preferences.timezone})`} title={`Time in ${preferences.timezone}`} onChange={(e)=>setSnoozeTimes((current)=>({...current,[notice._id]:e.target.value}))}/><button disabled={!snoozeTimes[notice._id]} onClick={()=>updateReminder(notice,'snooze',{minutes:'custom',remindAt:snoozeTimes[notice._id]})}>Custom</button></div>
                </div>)}
                {upcomingReminders.length>0&&<><h5 className="notification-subhead">Upcoming</h5>{upcomingReminders.map((notice)=><div className="notification-item upcoming-notice" key={notice._id}>
                  <b><button className="notification-title" onClick={()=>{setEditingTask(tasks.find((task)=>task._id===notice.task?._id)||notice.task);setNotificationsOpen(false);}}>{notice.task?.title}</button></b>
                  <small>{notice.task?.project||'Personal'} · {new Date(notice.remindAt).toLocaleString([], {timeZone:preferences.timezone, dateStyle:'medium',timeStyle:'short'})}</small>
                  <div><button onClick={()=>updateReminder(notice,'snooze',{minutes:10})}>Snooze 10m</button><button onClick={()=>updateReminder(notice,'snooze',{minutes:'tomorrow'})}>Tomorrow</button><button onClick={()=>updateReminder(notice,'dismiss')}>Dismiss</button></div>
                  <div className="notification-custom"><input type="datetime-local" value={snoozeTimes[notice._id]||''} aria-label={`Custom snooze time for ${notice.task?.title} (${preferences.timezone})`} title={`Time in ${preferences.timezone}`} onChange={(e)=>setSnoozeTimes((current)=>({...current,[notice._id]:e.target.value}))}/><button disabled={!snoozeTimes[notice._id]} onClick={()=>updateReminder(notice,'snooze',{minutes:'custom',remindAt:snoozeTimes[notice._id]})}>Custom</button></div>
                </div>)}</>}
              </>}
            </div>}
          </div>
          <button className="icon-btn" onClick={()=>setShortcutsOpen(true)} title="Keyboard shortcuts"><Keyboard size={17}/></button>
          <button className="avatar" title={user.isGuest ? 'Guest profile' : 'Open profile'} aria-label="Open profile" onClick={() => navigateToPage('Profile')}>{initials}</button>
          <button className="icon-btn" onClick={logout} title="Log out"><LogOut size={18} /></button>
        </div>

        {error && <div className="error task-toast" role="alert">{error}</div>}
        {success && <div className="success task-toast" role="status">{success}</div>}
        {selectionMode && canSelectTasks && !(activePage === 'Projects' && activeProject) && <div className="task-selection-toolbar">
          <strong>{selectedVisibleTasks.length} selected</strong>
          <button className="btn btn-ghost" onClick={() => setSelectedTaskIds(new Set(visibleSelectionTasks.map((task) => task._id)))}>Select all visible ({visibleSelectionTasks.length})</button>
          <button className="btn btn-ghost" onClick={() => setSelectedTaskIds(new Set())}>Deselect all</button>
          <select className="select" value={copyFormat} onChange={(event) => setCopyFormat(event.target.value)} aria-label="Copy format">
            <option value="plain">Plain list</option><option value="markdown">Markdown checklist</option><option value="detailed">Detailed</option>
          </select>
          <button className="btn btn-primary" disabled={!selectedVisibleTasks.length} onClick={() => copyTasks(selectedVisibleTasks)}><Copy size={14} /> Copy tasks</button>
          <button className="icon-btn" onClick={toggleSelectionMode} aria-label="Exit selection mode" title="Exit selection mode"><X size={15} /></button>
        </div>}
        {activePage === 'Projects' ? (
          activeProject
            ? <ProjectTasksPage project={activeProject} timezone={preferences.timezone} preferences={preferences} onBack={() => { resetTaskSelection(); setActiveProject(null); }} onError={setError} onTasksReplace={setTasks}
              selectionMode={selectionMode} selectedTaskIds={selectedTaskIds} onToggleSelection={toggleSelection}
              onToggleSelectionMode={toggleSelectionMode} onImport={() => setImportOpen(true)}
              onSelectVisibleTasks={(list) => setSelectedTaskIds(new Set(list.map((task) => task._id)))}
              onDeselectTasks={() => setSelectedTaskIds(new Set())}
              onCopyTasks={(list, format) => copyTasks(list, format)}
              onCopyProject={(format) => copyProjectTasks(activeProject, format)} copyFormat={copyFormat} setCopyFormat={setCopyFormat}
              tasksRevision={tasksRevision}
              onChange={(id, task) => setTasks((list) => task ? (list.some((item) => item._id === id) ? list.map((item) => item._id === id ? task : item) : [task, ...list]) : list.filter((item) => item._id !== id))} />
            : <ProjectsPage projects={projects} setProjects={setProjects} archived={showArchived} setArchived={setShowArchived} onError={setError} onSelect={(project) => { resetTaskSelection(); setActiveProject(project); }} />
        ) : activePage === 'My Day' ? (
          <MyDayPage tasks={tasks} projects={projects} timezone={preferences.timezone} onUpdate={update} onOpen={setEditingTask} onQuickAdd={(status, plannedDate) => setModal({ status, plannedDate })} />
        ) : activePage === 'Calendar' ? (
          <CalendarPage tasks={tasks} projects={projects} timezone={preferences.timezone} preferences={preferences}
            onPreferenceChange={async (next) => { try { const { data } = await api.put('/auth/preferences', next); setPreferences(data.preferences); } catch (e) { setError(errMsg(e)); } }}
            onUpdate={update} onOpen={setEditingTask} onQuickAdd={(status, plannedDate) => setModal({ status, plannedDate })} />
        ) : activePage === 'My Tasks' ? (
          <UpcomingPage tasks={tasks} timezone={preferences.timezone} onUpdate={update} onOpen={setEditingTask}
            selectionMode={selectionMode} selectedTaskIds={selectedTaskIds} onToggleSelection={toggleSelection}
            onToggleSelectionMode={toggleSelectionMode} onImport={() => setImportOpen(true)} />
        ) : activePage === 'Reports' ? (
          <ProductivityPage timezone={preferences.timezone} tasks={tasks} focusRevision={focusRevision} />
        ) : activePage === 'Profile' ? (
          <ProfilePage user={user} tasks={tasks} projects={projects} timezone={preferences.timezone} />
        ) : activePage === 'Settings' ? (
          <SettingsPage preferences={preferences} onShowShortcuts={()=>setShortcutsOpen(true)} onSave={async (next) => {
            try { const { data } = await api.put('/auth/preferences', next); setPreferences(data.preferences); }
            catch (e) { setError(errMsg(e)); throw e; }
          }} />
        ) : <div className="content">
          <section className="center">
            <p className="greet">{greet}, {user.name.split(' ')[0]} 👋</p>
            <h1 className="big">Let’s make <em>progress</em> today.</h1>
            <p className="muted">Here’s what’s happening across your workspace.</p>

            <div className="stats">
              {stats.map(([label, n, Icon, tone]) => (
                <div key={label} className={`stat ${tone}`}>
                  <div className="stat-ico"><Icon size={22} /></div>
                  <div><strong>{n}</strong><span>{label}</span></div>
                </div>
              ))}
            </div>

            <div className="toolbar">
              <div className="tabs">
                <button className={activeOverviewView === 'board' ? 'on' : ''} aria-pressed={activeOverviewView === 'board'} onClick={() => changeOverviewView('board')}><Columns3 size={14} /> Board</button>
                <button className={activeOverviewView === 'list' ? 'on' : ''} aria-pressed={activeOverviewView === 'list'} onClick={() => changeOverviewView('list')}><ListTodo size={14} /> List</button>
                <button className={activeOverviewView === 'timeline' ? 'on' : ''} aria-pressed={activeOverviewView === 'timeline'} onClick={() => changeOverviewView('timeline')}><GanttChart size={14} /> Timeline</button>
                <button className={activeOverviewView === 'calendar' ? 'on' : ''} aria-pressed={activeOverviewView === 'calendar'} onClick={() => changeOverviewView('calendar')}><CalendarDays size={14} /> Calendar</button>
              </div>
              <span className="grow" />
              <button className="icon-btn boxed" title="Filters"><Filter size={15} /></button>
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="select">
                <option value="all">Status</option>
                {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="select">
                <option value="all">All projects</option>
                {projects.filter((p) => !p.archived).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="select">
                <option value="all">Priority</option><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option>
              </select>
              <select value={dueFilter} onChange={(e) => setDueFilter(e.target.value)} className="select">
                <option value="all">Any due date</option><option value="today">Due today</option><option value="overdue">Overdue</option><option value="none">No due date</option>
              </select>
              {!dragEnabled && <button className="link-gold clear-filters" onClick={clearFilters}>Clear filters</button>}
              <button className="btn btn-ghost" onClick={() => setImportOpen(true)}><ClipboardPaste size={15} /> Paste Tasks</button>
              {activeOverviewView !== 'calendar' && <button className="btn btn-ghost" onClick={toggleSelectionMode}>{selectionMode ? 'Exit selection' : 'Select tasks'}</button>}
              <button className="btn btn-primary" onClick={() => setModal({ status: 'todo' })}><Plus size={15} /> New Task</button>
            </div>
            {tasksLoading ? <div className="phase-skeleton board-loading" aria-label="Loading tasks" /> : activeOverviewView === 'board' ? <>
              <DndContext sensors={sensors} collisionDetection={closestCenter}
                onDragStart={({ active }) => setDraggedTask(tasks.find((t) => `task:${t._id}` === active.id) || null)}
                onDragCancel={() => setDraggedTask(null)} onDragEnd={finishDrag}>
                <div className="board">
                  {COLUMNS.map((col, ci) => (
                    <KanbanColumn key={col.key} column={col} index={ci}
                      tasks={visible.filter((t) => t.status === col.key)}
                      total={count(col.key)} onUpdate={update} onDelete={remove} onOpen={setEditingTask}
                      onAdd={() => setModal({ status: col.key, plannedDate: '' })} dragDisabled={!dragEnabled || reordering || selectionMode}
                      timezone={preferences.timezone} selectionMode={selectionMode} selectedTaskIds={selectedTaskIds} onToggleSelection={toggleSelection} />
                  ))}
                </div>
                <DragOverlay dropAnimation={null}>
                  {draggedTask && <div className="task task-drag-overlay"><div className="task-body"><p>{draggedTask.title}</p><div className="tags"><span>{draggedTask.project}</span></div></div></div>}
                </DragOverlay>
              </DndContext>
              {!visible.length && <div className="projects-empty board-empty"><div className="empty-icon"><ListTodo size={25} /></div><h3>{tasks.length ? 'No tasks match these filters' : 'Your board is ready'}</h3><p>{tasks.length ? 'Try adjusting your search or filters.' : 'Add a task to get your workflow started.'}</p>{tasks.length > 0 && <button className="btn btn-ghost" onClick={clearFilters}>Clear filters</button>}</div>}
            </> : activeOverviewView === 'list' ? <OverviewList tasks={visible} onUpdate={update} onOpen={setEditingTask}
              selectionMode={selectionMode} selectedTaskIds={selectedTaskIds} onToggleSelection={toggleSelection} />
              : activeOverviewView === 'timeline' ? <OverviewTimeline tasks={visible} timezone={preferences.timezone} onUpdate={update} onOpen={setEditingTask}
                selectionMode={selectionMode} selectedTaskIds={selectedTaskIds} onToggleSelection={toggleSelection} />
                : <CalendarPage tasks={visible} projects={projects} timezone={preferences.timezone} preferences={preferences}
                  onPreferenceChange={async (next) => { try { const { data } = await api.put('/auth/preferences', next); setPreferences(data.preferences); } catch (e) { setError(errMsg(e)); } }}
                  onUpdate={update} onOpen={setEditingTask} onQuickAdd={(status, plannedDate) => setModal({ status, plannedDate })} />}
          </section>

          <aside className="right">
            <MiniCalendar tasks={tasks} />
            <div className="panel">
              <div className="panel-head"><h4><Target size={16} color="#f5b04c" /> Today’s Focus</h4><span className="badge">{focus.length} tasks</span></div>
              {focus.length === 0 && <p className="muted small">Nothing pending. Add a task!</p>}
              {focus.map((t) => (
                <label key={t._id} className="focus"><input type="checkbox" onChange={() => update(t._id, { status: 'done' })} /> {t.title}</label>
              ))}
            </div>
            <div className="panel">
              <div className="panel-head"><h4><Activity size={16} color="#f5b04c" /> Recent Activity</h4><a className="link-gold">View all →</a></div>
              {tasks.slice(0, 3).map((t) => (
                <div key={t._id} className="act">
                  <div className={`act-ico ${t.status === 'done' ? 'g' : 'p'}`}>{t.status === 'done' ? <Check size={14} /> : <Plus size={14} />}</div>
                  <div><p>{t.status === 'done' ? 'Completed' : 'Added'} “{t.title}”</p><small>{ago(t.updatedAt)}</small></div>
                </div>
              ))}
              {tasks.length === 0 && <p className="muted small">No activity yet.</p>}
            </div>
          </aside>
        </div>}
      </main>

      {modal && <TaskModal status={modal.status} plannedDate={modal.plannedDate} projects={projects} selectedProjectId={projectFilter} timezone={preferences.timezone} preferences={preferences} onClose={() => setModal(null)} onSave={create} />}
      {importOpen && <SmartPasteModal projects={projects}
        defaultProjectId={activePage === 'Projects' && activeProject ? activeProject._id : activePage === 'Overview' && projectFilter !== 'all' ? projectFilter : ''}
        onClose={() => setImportOpen(false)} onCreated={importCreatedTasks} />}
      {projectCopyPending && <div className="overlay" role="presentation"><section className="modal project-copy-confirm" role="dialog" aria-modal="true" aria-labelledby="project-copy-title">
        <div className="panel-head"><h3 id="project-copy-title">Copy a large project?</h3><button className="icon-btn" onClick={() => setProjectCopyPending(null)} aria-label="Close"><X size={16} /></button></div>
        <p className="muted">This project contains {projectCopyPending.total} tasks. All pages will be loaded before copying so none are silently omitted.</p>
        <label>Copy format<select className="input" value={copyFormat} onChange={(event) => { setCopyFormat(event.target.value); setProjectCopyPending({ ...projectCopyPending, format: event.target.value }); }}>
          <option value="plain">Plain list</option><option value="markdown">Markdown checklist</option><option value="detailed">Detailed by status</option>
        </select></label>
        <div className="editor-actions"><button className="btn btn-ghost" onClick={() => setProjectCopyPending(null)}>Cancel</button><button className="btn btn-primary" disabled={projectCopyBusy} onClick={() => finishProjectCopy(projectCopyPending.project, projectCopyPending.format)}>{projectCopyBusy ? 'Loading…' : `Load and copy ${projectCopyPending.total} tasks`}</button></div>
      </section></div>}
      {editingTask && <TaskDetail task={tasks.find((task) => task._id === editingTask._id) || editingTask} projects={projects} timezone={preferences.timezone} onClose={() => setEditingTask(null)} onSave={async (id, patch) => { if (await update(id, patch)) setEditingTask(null); }} onDelete={async (id) => { if (await remove(id)) setEditingTask(null); }} onStopRecurrence={stopRecurrence} />}
      {paletteOpen&&<CommandPalette tasks={tasks} projects={projects} timezone={preferences.timezone} onClose={()=>setPaletteOpen(false)}
        onNavigate={(page,project)=>{navigateToPage(page);if(page==='Projects')setActiveProject(project||null);}}
        onOpen={(task)=>setEditingTask(task)} onUpdate={update} onCreate={()=>setModal({status:'todo'})}/>}
      {shortcutsOpen&&<ShortcutsDialog onClose={()=>setShortcutsOpen(false)}/>}
      <FocusMode open={focusOpen} onClose={()=>setFocusOpen(false)} tasks={tasks} preferences={preferences}
        onCompleteTask={(id)=>update(id,{status:'done'})} onSessionChange={()=>setFocusRevision((value)=>value+1)}/>
    </div>
  );
}

function TaskModal({ status, plannedDate, projects, selectedProjectId, timezone, preferences, onClose, onSave }) {
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
        <input className="input" autoFocus placeholder="Task title" value={f.title} onChange={set('title')} required />
        <textarea className="input task-description-input" placeholder="Description (optional)" value={f.description} onChange={set('description')} />
        <div className="two">
          <select className="input" value={f.projectId} onChange={(e) => { const p = projects.find((item) => item._id === e.target.value); setF({ ...f, projectId: e.target.value, project: p?.name || 'Personal' }); }}>
            <option value="">Personal</option>{projects.filter((p) => !p.archived).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <select className="input" value={f.priority} onChange={set('priority')}><option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option></select>
        </div>
        <div className="two">
          <select className="input" value={f.status} onChange={set('status')}>
            {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <label className="phase-date-label">Due date<input className="input" type="date" value={f.dueDate} onChange={set('dueDate')} /></label>
        </div>
        <label className="phase-date-label">Plan for day<input className="input" type="date" value={f.plannedDate} onChange={set('plannedDate')} /></label>
        <input className="input" placeholder="Tag (e.g. Design)" value={f.tag} onChange={set('tag')} />
        <div className="two">
          <label className="phase-date-label">Repeat<select className="input" value={f.recurrenceFrequency} onChange={set('recurrenceFrequency')}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekdays">Every weekday</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="custom">Custom interval</option></select></label>
          {f.recurrenceFrequency !== 'none' && <label className="phase-date-label">Interval<input className="input" type="number" min="1" max="365" value={f.recurrenceInterval} onChange={set('recurrenceInterval')}/></label>}
        </div>
        {f.recurrenceFrequency === 'custom' && <label className="phase-date-label">Interval unit<select className="input" value={f.recurrenceUnit} onChange={set('recurrenceUnit')}><option value="day">Days</option><option value="week">Weeks</option><option value="month">Months</option></select></label>}
        {f.recurrenceFrequency !== 'none' && <div className="two"><label className="phase-date-label">Repeat until<input className="input" type="date" value={f.recurrenceEndDate} onChange={set('recurrenceEndDate')}/></label><label className="phase-date-label">Or total occurrences<input className="input" type="number" min="1" max="365" value={f.recurrenceLimit} onChange={set('recurrenceLimit')}/></label></div>}
        <label className="phase-date-label">Reminder<select className="input" value={f.reminderOffset} onChange={set('reminderOffset')}><option value="none">No reminder</option><option value="due">At due time</option><option value="10m">10 minutes before</option><option value="30m">30 minutes before</option><option value="1h">1 hour before</option><option value="1d">1 day before</option><option value="custom">Custom time</option></select></label>
        {f.reminderOffset === 'custom' && <label className="phase-date-label">Remind at ({timezone})<input className="input" type="datetime-local" value={f.customReminderAt} onChange={set('customReminderAt')}/></label>}
        {recurrenceError&&<p className="error">{recurrenceError}</p>}
        <button className="btn btn-primary full" disabled={busy}>{busy ? 'Creating…' : 'Create Task'}</button>
      </form>
    </div>
  );
}

function TaskDetail({ task, projects, timezone, onClose, onSave, onDelete, onStopRecurrence }) {
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
        <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea className="input task-description-input" placeholder="Description" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="two">
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
          <select className="input" value={form.priority || 'medium'} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option></select>
        </div>
        <div className="two">
          <select className="input" value={form.projectId || ''} onChange={(e) => { const p = projects.find((item) => item._id === e.target.value); setForm({ ...form, projectId: e.target.value || undefined, project: p?.name || 'Personal' }); }}>
            <option value="">Personal</option>{projects.filter((p) => !p.archived).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <label className="phase-date-label">Due date<input className="input" type="date" value={form.dueDate ? new Date(form.dueDate).toISOString().slice(0, 10) : ''} onChange={(e) => setForm({ ...form, dueDate: e.target.value || null })} /></label>
        </div>
        <label className="phase-date-label">Plan for day<input className="input" type="date" value={form.plannedDate || ''} onChange={(e) => setForm({ ...form, plannedDate: e.target.value || null })} /></label>
        <div className="two">
          <label className="phase-date-label">Reminder<select className="input" value={form.reminderOffset || 'none'} onChange={(e) => setForm({ ...form, reminderOffset: e.target.value })}><option value="none">No reminder</option><option value="due">At due time</option><option value="10m">10 minutes before</option><option value="30m">30 minutes before</option><option value="1h">1 hour before</option><option value="1d">1 day before</option><option value="custom">Custom time</option></select></label>
          {form.reminderOffset === 'custom' && <label className="phase-date-label">Remind at ({timezone})<input className="input" type="datetime-local" value={form.customReminderAt ? zonedDateTimeValue(form.customReminderAt, timezone) : ''} onChange={(e) => setForm({ ...form, customReminderAt: e.target.value })} /></label>}
        </div>
        <div className="two">
          <label className="phase-date-label">Repeat<select className="input" value={form.recurrenceFrequency ?? (form.recurrence?.active === false ? 'none' : form.recurrence?.frequency) ?? 'none'} onChange={(e) => setForm({ ...form, recurrenceFrequency: e.target.value })}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekdays">Every weekday</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="custom">Custom interval</option></select></label>
          {repeatFrequency !== 'none' && <label className="phase-date-label">Interval<input className="input" type="number" min="1" max="365" value={form.recurrenceInterval || form.recurrence?.interval || 1} onChange={(e) => setForm({ ...form, recurrenceInterval: e.target.value })}/></label>}
        </div>
        {repeatFrequency === 'custom' && <label className="phase-date-label">Interval unit<select className="input" value={form.recurrenceUnit || form.recurrence?.unit || 'day'} onChange={(e)=>setForm({...form,recurrenceUnit:e.target.value})}><option value="day">Days</option><option value="week">Weeks</option><option value="month">Months</option></select></label>}
        {repeatFrequency !== 'none' && <div className="two"><label className="phase-date-label">Repeat until<input className="input" type="date" value={form.recurrenceEndDate || form.recurrence?.endDate || ''} onChange={(e) => setForm({ ...form, recurrenceEndDate: e.target.value })}/></label><label className="phase-date-label">Or total occurrences<input className="input" type="number" min="1" max="365" value={form.recurrenceLimit || form.recurrence?.occurrenceLimit || ''} onChange={(e) => setForm({ ...form, recurrenceLimit: e.target.value })}/></label></div>}
        <input className="input" placeholder="Tag" value={form.tag || ''} onChange={(e) => setForm({ ...form, tag: e.target.value })} />
        <div className="subtask-editor">
          <div className="panel-head"><b>Subtasks</b><button type="button" className="link-gold" onClick={addSubtask}>+ Add subtask</button></div>
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

function ProjectTasksPage({
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

function ProjectsPage({ projects, setProjects, archived, setArchived, onError, onSelect }) {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const visible = projects.filter((p) => p.archived === archived);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = form._id
        ? await api.put(`/projects/${form._id}`, form)
        : await api.post('/projects', form);
      setProjects((list) => form._id ? list.map((p) => p._id === data._id ? data : p) : [data, ...list]);
      setForm(null);
    } catch (e) { onError(errMsg(e)); }
    finally { setBusy(false); }
  };
  const change = async (p, patch) => {
    try {
      const { data } = await api.put(`/projects/${p._id}`, patch);
      setProjects((list) => list.map((item) => item._id === p._id ? data : item));
    } catch (e) { onError(errMsg(e)); }
  };
  const remove = async (p) => {
    try {
      await api.delete(`/projects/${p._id}`);
      setProjects((list) => list.filter((item) => item._id !== p._id));
    } catch (e) { onError(errMsg(e)); }
  };
  return (
    <section className="projects-page">
      <div className="projects-heading">
        <div><p className="greet">Your workspace</p><h1 className="big">Projects</h1><p className="muted">Organize work into focused spaces and keep every plan moving.</p></div>
        {!archived && <button className="btn btn-primary" onClick={() => setForm({ name: '', description: '', color: '#f5b04c' })}><Plus size={16} /> New Project</button>}
      </div>
      <div className="project-toolbar">
        <div className="tabs"><button className={!archived ? 'on' : ''} onClick={() => { setArchived(false); setForm(null); }}>Active <span>{projects.filter((p) => !p.archived).length}</span></button><button className={archived ? 'on' : ''} onClick={() => { setArchived(true); setForm(null); }}>Archived <span>{projects.filter((p) => p.archived).length}</span></button></div>
      </div>
      {form && <form className="project-editor" onSubmit={save}>
        <div className="editor-title"><div className="project-swatch" style={{ background: form.color }} /><div><h3>{form._id ? 'Edit project' : 'Create a project'}</h3><p className="muted">Give this workspace a name and a little context.</p></div></div>
        <div className="project-editor-fields">
          <label>Project name<input className="input" placeholder="e.g. Website redesign" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Description<input className="input" placeholder="What are you working on?" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label className="color-field">Color<input aria-label="Project color" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></label>
        </div>
        <div className="editor-actions"><button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : form._id ? 'Save changes' : 'Create project'}</button></div>
      </form>}
      {visible.length ? <div className="project-grid">{visible.map((p) => (
        <article className="project-card project-card-clickable" key={p._id} onClick={() => onSelect(p)}>
          <div className="project-card-accent" style={{ background: p.color }} />
          <div className="project-card-top"><div className="project-icon" style={{ color: p.color, background: `${p.color}20` }}><FolderKanban size={20} /></div><div className="project-card-actions">
            <button className="icon-btn" title="Edit" onClick={(e) => { e.stopPropagation(); setForm(p); }}><Pencil size={15} /></button>
            <button className="icon-btn" title={archived ? 'Restore project' : 'Archive project'} onClick={(e) => { e.stopPropagation(); change(p, { archived: !archived }); }}><Archive size={15} /></button>
            <button className="icon-btn" title="Delete project" onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete “${p.name}”?`)) remove(p); }}><Trash2 size={15} /></button>
          </div></div>
          <h3>{p.name}</h3><p className="project-description">{p.description || 'No description yet.'}</p>
          <div className="project-card-footer"><span><i style={{ background: p.color }} />{archived ? 'Archived' : 'Active'}</span><small>Created {fmt(p.createdAt)}</small></div>
        </article>
      ))}</div> : !form && <div className="projects-empty"><div className="empty-icon"><FolderKanban size={26} /></div><h3>{archived ? 'No archived projects' : 'A fresh space for your next big idea'}</h3><p>{archived ? 'Projects you archive will be kept here.' : 'Create your first project to give related tasks a home.'}</p>{!archived && <button className="btn btn-primary" onClick={() => setForm({ name: '', description: '', color: '#f5b04c' })}><Plus size={15} /> Create your first project</button>}</div>}
    </section>
  );
}
