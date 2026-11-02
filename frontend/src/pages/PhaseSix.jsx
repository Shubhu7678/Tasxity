import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock3, Command, Pause, Play, Search, Target, X } from 'lucide-react';
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

export function ShortcutsDialog({ onClose }) {
  const shortcuts = [['⌘ / Ctrl + K','Open command palette'],['⌘ / Ctrl + Shift + V','Open Paste Tasks'],['N','Create a task'],['/','Focus task search'],['G then O','Overview'],['G then M','My Day'],['G then C','Calendar'],['Escape','Close dialog or selection mode']];
  return <div className="overlay" onMouseDown={onClose}><section className="modal shortcuts-modal" onMouseDown={(e)=>e.stopPropagation()}><div className="panel-head"><h4>Keyboard shortcuts</h4><button className="icon-btn" onClick={onClose}><X size={16}/></button></div>{shortcuts.map(([key,label])=><div className="shortcut-row" key={key}><span>{label}</span><kbd>{key}</kbd></div>)}</section></div>;
}

const fmtTime = (seconds) => `${String(Math.floor(Math.max(0,seconds)/60)).padStart(2,'0')}:${String(Math.max(0,seconds)%60).padStart(2,'0')}`;
export function FocusMode({ open, onClose, tasks, preferences, onCompleteTask, onSessionChange }) {
  const [session,setSession]=useState(null);
  const [selected,setSelected]=useState('');
  const [error,setError]=useState('');
  const [now,setNow]=useState(()=>Date.now());
  const [loading,setLoading]=useState(true);
  const completing=useRef(false);
  useEffect(()=>{api.get('/focus/active').then((r)=>setSession(r.data.session)).catch((e)=>setError(errMsg(e))).finally(()=>setLoading(false));},[]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const remaining=session?.status==='active'?Math.max(0,Math.ceil((new Date(session.endsAt).getTime()-now)/1000)):session?.remainingSeconds||0;
  const action=useCallback(async(name)=>{if(!session)return;setError('');try{const {data}=await api.post(`/focus/${session._id}/action`,{action:name});setSession(data.session);if(name==='finish'){setNow(Date.now());onSessionChange();}if(name==='cancel')setSession(null);}catch(e){setError(errMsg(e));}},[session,onSessionChange]);
  useEffect(()=>{if(session?.status==='active'&&remaining===0&&!completing.current){completing.current=true;action('finish').finally(()=>{completing.current=false;});}},[session?.status,remaining,action]);
  const start=async(kind='focus',taskId=selected)=>{setError('');const durations={focus:preferences.focusMinutes||25,short_break:preferences.shortBreakMinutes||5,long_break:preferences.longBreakMinutes||15};try{const {data}=await api.post('/focus',{kind,taskId:kind==='focus'?(taskId||undefined):undefined,durationMinutes:durations[kind]});setSession(data.session);onSessionChange();}catch(e){setError(errMsg(e));}};
  if(!open)return null;
  return <div className="overlay focus-overlay" onMouseDown={onClose}><section className="focus-window" onMouseDown={(e)=>e.stopPropagation()}>
    <div className="panel-head"><div><p className="greet">FOCUS MODE</p><h2><Target size={18}/> Stay with one thing</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close focus mode"><X size={17}/></button></div>
    {error&&<p className="error">{error}</p>}
    {loading?<div className="phase-skeleton"/>:session?<><p className="focus-task-name">{session.kind!=='focus'?session.kind==='short_break'?'Short break':'Long break':tasks.find((task)=>String(task._id)===String(session.task?._id||session.task))?.title||session.task?.title||'Focus session'}</p><div className="focus-clock" aria-live="polite">{fmtTime(remaining)}</div><p className="muted">{session.status==='completed'?'Session complete.':session.status==='paused'?'Paused':session.kind==='focus'?'One focused session. Your task will not be auto-completed.':'Take a moment away from your task.'}</p>
      {session.status==='completed'?<div className="focus-controls"><button className="btn btn-primary" onClick={()=>start('focus',session.task?._id||session.task||'')}><Play size={15}/> Focus again</button><button className="btn btn-ghost" onClick={()=>start('short_break')}><Clock3 size={15}/> Short break</button><button className="btn btn-ghost" onClick={()=>start('long_break')}><Clock3 size={15}/> Long break</button></div>:<div className="focus-controls">{session.status==='active'?<button className="btn btn-ghost" onClick={()=>action('pause')}><Pause size={15}/> Pause</button>:<button className="btn btn-primary" onClick={()=>action('resume')}><Play size={15}/> Resume</button>}<button className="btn btn-primary" onClick={()=>action('finish')}><Check size={15}/> Finish session</button><button className="btn btn-ghost" onClick={()=>action('cancel')}><X size={15}/> Cancel</button></div>}
      {session.status==='completed'&&session.task&&<button className="link-gold" onClick={()=>onCompleteTask(session.task._id)}>Mark task complete</button>}
    </>:<><p className="muted">Choose a task to focus on. You can also start without one.</p><select className="input focus-task-select" value={selected} onChange={(e)=>setSelected(e.target.value)}><option value="">No task selected</option>{tasks.filter((task)=>task.status!=='done').map((task)=><option value={task._id} key={task._id}>{task.title}</option>)}</select><div className="timer-presets"><span><Clock3 size={15}/> Focus {preferences.focusMinutes||25}m</span><span>Breaks {preferences.shortBreakMinutes||5}m / {preferences.longBreakMinutes||15}m</span></div><button className="btn btn-primary full" onClick={()=>start('focus')}><Play size={15}/> Start focus session</button></>}
  </section></div>;
}
