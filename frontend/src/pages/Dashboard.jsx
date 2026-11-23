import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import {
  Columns3, GanttChart, CalendarDays, Search, Bell, Plus, Target, Activity, Check, ListTodo, LogOut, X, Filter, Keyboard, Copy, ClipboardPaste,
} from 'lucide-react';
import Mountain from '../components/Mountain';
import SmartPasteModal from '../components/SmartPasteModal';
import Onboarding, { HelpMenu, useOnboarding } from '../components/Onboarding';
import { useAuth } from '../context/AuthContext';
import api, { errMsg } from '../api';
import { CalendarPage } from './work/CalendarPage';
import { MyDayPage } from './work/MyDayPage';
import { ProductivityPage } from './work/ProductivityPage';
import { SettingsPage } from './work/SettingsPage';
import { UpcomingPage } from './work/UpcomingPage';
import { CommandPalette } from '../components/CommandPalette';
import { FocusMode } from '../components/FocusMode';
import { ShortcutsDialog } from '../components/ShortcutsDialog';
import ProfilePage from './ProfilePage';
import { formatTasksForCopy } from '../utils/smartPaste';
import { COLUMNS } from './dashboard/constants';
import { fmt, ago, isTypingTarget, upcomingTaskOrder } from './dashboard/helpers';
import { Sidebar } from './dashboard/Sidebar';
import { KanbanColumn, OverviewList, OverviewTimeline, MiniCalendar } from './dashboard/Board';
import { TaskModal } from './dashboard/TaskModal';
import { TaskDetail } from './dashboard/TaskDetail';
import { ProjectTasksPage } from './dashboard/ProjectTasksPage';
import { ProjectsPage } from './dashboard/ProjectsPage';

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
  const ob = useOnboarding(user);
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
  const showProjects = () => { navigateToPage('Projects'); setActiveProject(null); setShowArchived(false); };
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

  useEffect(() => { if (paletteOpen) ob.mark('palette'); }, [paletteOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (importOpen) ob.mark('paste'); }, [importOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (focusOpen) ob.mark('focus'); }, [focusOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const addSampleTasks = async () => {
    const samples = [
      { title: 'Welcome to Tasxity. Drag me to Done', status: 'todo', priority: 'high' },
      { title: 'Click any task to edit its details', status: 'todo', priority: 'medium' },
      { title: 'Try the Focus timer on this task', status: 'in_progress', priority: 'medium' },
      { title: 'Plan tomorrow in My Day', status: 'todo', priority: 'low' },
    ];
    try {
      const created = [];
      for (const task of samples) created.push((await api.post('/tasks', task)).data);
      setTasks((list) => [...created.reverse(), ...list]);
    } catch (e) { setError(errMsg(e)); }
  };

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
      <Sidebar user={user} initials={initials} activePage={activePage} tasks={tasks} projects={projects} projectFilter={projectFilter}
        onNavigate={navigateToPage} onOpenWorkspace={openWorkspace} onOpenPalette={() => setPaletteOpen(true)} onShowProjects={showProjects} />

      <main className="main">
        <Mountain className="main-bg" />
        <div className="topbar">
          <label className="search"><Search size={16} />
            <input ref={searchInput} placeholder="Search tasks, projects or people..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button type="button" className="search-clear" onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}
            <kbd>⌘ K</kbd>
          </label>
          <button className="btn btn-ghost focus-launch" data-tour="focus" onClick={() => setFocusOpen(true)}><Target size={15}/> Focus</button>
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
          <HelpMenu ob={ob} onShortcuts={() => setShortcutsOpen(true)} />
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
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`select ${filter !== 'all' ? 'is-set' : ''}`} aria-label="Filter by status">
                <option value="all">Status</option>
                {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className={`select ${projectFilter !== 'all' ? 'is-set' : ''}`} aria-label="Filter by project">
                <option value="all">All projects</option>
                {projects.filter((p) => !p.archived).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className={`select ${priorityFilter !== 'all' ? 'is-set' : ''}`} aria-label="Filter by priority">
                <option value="all">Priority</option><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option>
              </select>
              <select value={dueFilter} onChange={(e) => setDueFilter(e.target.value)} className={`select ${dueFilter !== 'all' ? 'is-set' : ''}`} aria-label="Filter by due date">
                <option value="all">Any due date</option><option value="today">Due today</option><option value="overdue">Overdue</option><option value="none">No due date</option>
              </select>
              {!dragEnabled && <button className="link-gold clear-filters" onClick={clearFilters}>Clear filters</button>}
              <button className="btn btn-ghost" data-tour="paste" onClick={() => setImportOpen(true)}><ClipboardPaste size={15} /> Paste Tasks</button>
              {activeOverviewView !== 'calendar' && <button className="btn btn-ghost" onClick={toggleSelectionMode}>{selectionMode ? 'Exit selection' : 'Select tasks'}</button>}
              <button className="btn btn-primary" data-tour="new-task" onClick={() => setModal({ status: 'todo' })}><Plus size={15} /> New Task</button>
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
              {!visible.length && <div className="projects-empty board-empty"><div className="empty-icon"><ListTodo size={25} /></div><h3>{tasks.length ? 'No tasks match these filters' : 'Your board is ready'}</h3><p>{tasks.length ? 'Try adjusting your search or filters.' : 'Tasks live here and move left to right as you work on them.'}</p>
                {tasks.length > 0 && <button className="btn btn-ghost" onClick={clearFilters}>Clear filters</button>}
                {tasks.length === 0 && <>
                  <div className="empty-steps"><span><b>1</b> Add a task</span><span><b>2</b> Drag it as you progress</span><span><b>3</b> Mark it Done</span></div>
                  <div className="empty-actions">
                    <button className="btn btn-primary" onClick={() => setModal({ status: 'todo' })}><Plus size={15} /> Add your first task</button>
                    <button className="btn btn-ghost" onClick={() => setImportOpen(true)}><ClipboardPaste size={15} /> Paste a list</button>
                    <button className="btn btn-ghost" onClick={addSampleTasks}>Add example tasks</button>
                  </div>
                </>}</div>}
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
              <div className="panel-head"><h4><Target size={16} color="#7c7ff8" /> Today’s Focus</h4><span className="badge">{focus.length} tasks</span></div>
              {focus.length === 0 && <p className="muted small">Nothing pending. Add a task!</p>}
              {focus.map((t) => (
                <label key={t._id} className="focus"><input type="checkbox" onChange={() => update(t._id, { status: 'done' })} /> {t.title}</label>
              ))}
            </div>
            <div className="panel">
              <div className="panel-head"><h4><Activity size={16} color="#7c7ff8" /> Recent Activity</h4><a className="link-gold">View all →</a></div>
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
      <Onboarding ob={ob} ready={!tasksLoading} user={user} tasks={tasks} projects={projects}
        actions={{
          go: navigateToPage, addSamples: addSampleTasks,
          newTask: () => setModal({ status: 'todo' }), openPaste: () => setImportOpen(true), openFocus: () => setFocusOpen(true), openPalette: () => setPaletteOpen(true),
          createSpace: () => { showProjects(); ob.mark('space'); },
        }} />
      <FocusMode open={focusOpen} onClose={()=>setFocusOpen(false)} tasks={tasks} preferences={preferences}
        onCompleteTask={(id)=>update(id,{status:'done'})} onSessionChange={()=>setFocusRevision((value)=>value+1)}/>
    </div>
  );
}
