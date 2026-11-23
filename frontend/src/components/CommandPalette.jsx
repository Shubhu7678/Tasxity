import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Target, Command, Search } from 'lucide-react';
import api, { errMsg } from '../api';

export function CommandPalette({ tasks, projects, timezone, onClose, onNavigate, onOpen, onUpdate, onCreate }) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [remoteResults, setRemoteResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const inputRef = useRef(null);
  useEffect(() => {
    const search = query.trim();
    if (!search) return undefined;
    let active = true;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const [taskResponse, projectResponse] = await Promise.all([
          api.get('/tasks', { params: { search, limit: 8 } }),
          api.get('/projects', { params: { search } }),
        ]);
        if (active) setRemoteResults({ query: search.toLowerCase(), tasks: taskResponse.data, projects: projectResponse.data });
      } catch (error) {
        if (active) setSearchError(errMsg(error));
      } finally {
        if (active) setSearching(false);
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);
  const items = useMemo(() => {
    const actions = [
      { type: 'action', label: 'Create a new task', hint: 'N', run: onCreate },
      ...['Overview', 'My Day', 'Calendar', 'Projects'].map((page) => ({ type: 'page', label: `Go to ${page}`, run: () => onNavigate(page) })),
    ];
    const q = query.trim().toLowerCase();
    const results = remoteResults?.query === q ? remoteResults : null;
    const foundTasks = (results ? results.tasks : tasks.filter((task) => !q || task.title.toLowerCase().includes(q))).slice(0, 8)
      .map((task) => ({ type: 'task', label: task.title, detail: `${task.project || 'Personal'} · ${task.status.replace('_', ' ')}`, run: () => onOpen(task), task }));
    const taskActions = q ? foundTasks.flatMap((item) => [
      { type: 'action', label: `${item.task.status === 'done' ? 'Reopen' : 'Complete'}: ${item.task.title}`, detail: 'Task action', run: () => onUpdate(item.task._id, { status: item.task.status === 'done' ? 'todo' : 'done' }) },
      { type: 'action', label: `Add to My Day: ${item.task.title}`, detail: 'Task action', run: () => {
        const plannedDate = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
        return onUpdate(item.task._id, { plannedDate });
      } },
    ]) : [];
    const foundProjects = (results ? results.projects : projects.filter((project) => !q || project.name.toLowerCase().includes(q))).slice(0, 5)
      .map((project) => ({ type: 'project', label: project.name, detail: 'Project', run: () => onNavigate('Projects', project) }));
    const filteredActions = actions.filter((action) => !q || action.label.toLowerCase().includes(q));
    if (q) return [...foundTasks, ...taskActions, ...foundProjects, ...filteredActions];
    return [...actions, ...foundTasks, ...foundProjects];
  }, [query, tasks, projects, timezone, remoteResults, onNavigate, onOpen, onUpdate, onCreate]);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const select = (item) => { item?.run?.(); onClose(); };
  const keyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, items.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); select(items[index]); }
  };
  return <div className="overlay palette-overlay" onMouseDown={onClose}><section className="command-palette" onMouseDown={(e) => e.stopPropagation()}>
    <div className="palette-search"><Search size={18}/><input ref={inputRef} value={query} onChange={(e)=>{setQuery(e.target.value);setIndex(0);}} onKeyDown={keyDown} placeholder="Search tasks, projects, or commands…" aria-label="Command palette search"/><kbd>ESC</kbd></div>
    <div className="palette-results" role="listbox">{searchError?<p className="error palette-empty">{searchError}</p>:items.length ? items.map((item,i)=><button role="option" aria-selected={i===index} className={`palette-item ${i===index?'selected':''}`} key={`${item.type}-${item.label}`} onMouseEnter={()=>setIndex(i)} onClick={()=>select(item)}>
      <span className="palette-item-icon">{item.type==='task'?<Check size={15}/>:item.type==='project'?<Target size={15}/>:<Command size={15}/>}</span><span>{item.label}{item.detail&&<small>{item.detail}</small>}</span>{item.hint&&<kbd>{item.hint}</kbd>}
    </button>):<p className="phase-empty-note palette-empty">{searching?'Searching…':'No tasks, projects, or commands found.'}</p>}</div>
    <div className="palette-footer"><span>↑↓ Navigate</span><span>↵ Select</span><span><kbd>⌘ K</kbd> Open palette</span></div>
  </section></div>;
}
