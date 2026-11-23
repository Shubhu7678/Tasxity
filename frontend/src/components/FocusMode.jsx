import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Clock3, Target, Pause, Play, X } from 'lucide-react';
import api, { errMsg } from '../api';

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
