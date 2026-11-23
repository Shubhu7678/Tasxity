import { useEffect, useState } from 'react';
import { Activity, Clock3, Target } from 'lucide-react';
import api, { errMsg } from '../../api';

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
