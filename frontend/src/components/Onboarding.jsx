import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowRight, Check, ChevronDown, ChevronUp, CircleHelp, Compass, Keyboard, ListChecks, Sparkles, X,
  FolderKanban, Target, Layers,
} from 'lucide-react';
import './onboarding.css';

/* ---------- persisted state (per user, per browser) ---------- */
const read = (key) => { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; } };

export function useOnboarding(user) {
  const key = `tasxity:onboarding:${user.id || user._id || 'anon'}`;
  const [state, setState] = useState(() => ({ welcomed: false, hidden: false, done: {}, ...read(key) }));
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [listOpen, setListOpen] = useState(true);

  const patch = useCallback((p) => setState((s) => {
    const next = { ...s, ...(typeof p === 'function' ? p(s) : p) };
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage may be unavailable */ }
    return next;
  }), [key]);
  const mark = useCallback((name) => patch((s) => (s.done[name] ? {} : { done: { ...s.done, [name]: true } })), [patch]);

  return { state, patch, mark, welcomeOpen, setWelcomeOpen, tourOpen, setTourOpen, listOpen, setListOpen };
}

/* ---------- tour definition ---------- */
const STEPS = [
  { target: 'nav', page: 'Overview', title: 'Your workspace menu', body: 'Overview is your board. My Day is a short list for today. My Tasks lists everything by date. Projects groups related work, and Calendar shows due dates.' },
  { target: 'spaces', title: 'Spaces keep work separate', body: 'A space is just a project, like “Website” or “Home”. They are optional. Create one when you want related tasks in one place.' },
  { target: 'new-task', page: 'Overview', title: 'Start here: add a task', body: 'Click New Task, or press N from anywhere. Tasks move across the board from To Do to Done as you work. Drag them, or open one to edit it.' },
  { target: 'paste', page: 'Overview', title: 'Already have a list?', body: 'Paste notes, bullets or checklists and Tasxity turns each line into a task. You review them before anything is added.' },
  { target: 'search', title: 'Do anything from the keyboard', body: 'Press ⌘K (Ctrl+K on Windows) to search tasks, jump to any page or create something new without touching the mouse.' },
  { target: 'focus', title: 'Focus on one thing', body: 'Pick a task and start a timer. Tasxity tracks your focus time so you can see how your week really went.' },
  { target: 'reports', title: 'See your progress', body: 'Reports shows what you finished each week and how much time you spent focusing.' },
  { target: 'help', title: 'You can replay this anytime', body: 'The help button brings back this tour, your Getting Started checklist and the keyboard shortcuts.' },
];

const clamp = (n, lo, hi) => Math.max(lo, Math.min(n, hi));
const findTarget = (name) => document.querySelector(`[data-tour="${name}"]`);

function Tour({ onClose, go }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [h, setH] = useState(200);
  const pop = useRef(null);
  const step = STEPS[i];

  useEffect(() => { if (step.page) go(step.page); }, [step, go]);

  useEffect(() => {
    let scrolled = false;
    const measure = () => {
      const el = findTarget(step.target);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) { setRect(null); return; }
      if (!scrolled && (r.top < 0 || r.bottom > window.innerHeight)) { el.scrollIntoView({ block: 'center' }); scrolled = true; }
      setRect((prev) => (prev && prev.left === r.left && prev.top === r.top && prev.width === r.width && prev.height === r.height ? prev : { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom }));
    };
    measure();
    const t = setInterval(measure, 200);
    window.addEventListener('resize', measure);
    return () => { clearInterval(t); window.removeEventListener('resize', measure); };
  }, [step]);

  useLayoutEffect(() => { if (pop.current) setH(pop.current.offsetHeight); }, [i, rect]);

  const last = i === STEPS.length - 1;
  const next = useCallback(() => (last ? onClose(true) : setI((n) => n + 1)), [last, onClose]);
  const back = () => setI((n) => Math.max(0, n - 1));

  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') onClose(false);
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [next, onClose]);

  const W = Math.min(340, window.innerWidth - 24);
  const vw = window.innerWidth; const vh = window.innerHeight; const gap = 16;
  let style;
  if (!rect) {
    style = { left: (vw - W) / 2, top: Math.max(12, (vh - h) / 2), width: W };
  } else if (rect.right + gap + W < vw - 12 && rect.width < vw * 0.5) {
    style = { left: rect.right + gap + 6, top: clamp(rect.top, 12, vh - h - 12), width: W };
  } else if (rect.bottom + gap + h < vh - 12) {
    style = { left: clamp(rect.left + rect.width / 2 - W / 2, 12, vw - W - 12), top: rect.bottom + gap, width: W };
  } else {
    style = { left: clamp(rect.left + rect.width / 2 - W / 2, 12, vw - W - 12), top: Math.max(12, rect.top - gap - h), width: W };
  }

  return (
    <div className="ob-tour" role="dialog" aria-modal="true" aria-label="Product tour">
      <div className="ob-block" onClick={() => onClose(false)} />
      {rect
        ? <div className="ob-spot" style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }} />
        : <div className="ob-dim" />}
      <div className="ob-pop" ref={pop} style={style} key={i}>
        <div className="ob-pop-top">
          <span className="ob-count">Step {i + 1} of {STEPS.length}</span>
          <button className="ob-x" onClick={() => onClose(false)} aria-label="Skip tour"><X size={15} /></button>
        </div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="ob-dots">{STEPS.map((_, n) => <i key={n} className={n === i ? 'on' : n < i ? 'past' : ''} />)}</div>
        <div className="ob-pop-actions">
          <button className="ob-skip" onClick={() => onClose(false)}>Skip tour</button>
          <div>
            {i > 0 && <button className="btn btn-ghost" onClick={back}>Back</button>}
            <button className="btn btn-primary" onClick={next}>{last ? 'Finish' : 'Next'} {!last && <ArrowRight size={14} />}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- welcome ---------- */
function Welcome({ name, onTour, onSamples, onSkip, busy }) {
  return (
    <div className="ob-overlay" role="dialog" aria-modal="true" aria-labelledby="ob-welcome-title">
      <div className="ob-welcome">
        <div className="ob-welcome-glow" aria-hidden="true" />
        <span className="ob-badge"><Sparkles size={13} /> Welcome</span>
        <h2 id="ob-welcome-title">Hi {name}, let’s get you started</h2>
        <p className="ob-lede">Tasxity helps you keep track of what needs doing. You do not need to learn every feature. Here is the whole idea:</p>
        <ol className="ob-idea">
          <li><span><Layers size={18} /></span><div><b>1. Capture tasks</b><small>Write down anything you need to do. One line is enough.</small></div></li>
          <li><span><FolderKanban size={18} /></span><div><b>2. Move them across the board</b><small>To Do, In Progress, Review, Done. Group them into spaces if you like.</small></div></li>
          <li><span><Target size={18} /></span><div><b>3. Focus on today</b><small>Pick a few tasks for My Day and start a timer to get them done.</small></div></li>
        </ol>
        <div className="ob-welcome-actions">
          <button className="btn btn-primary" onClick={onTour}><Compass size={15} /> Take the 1-minute tour</button>
          <button className="btn btn-ghost" onClick={onSamples} disabled={busy}>{busy ? 'Adding…' : 'Add example tasks'}</button>
        </div>
        <button className="ob-link" onClick={onSkip}>I’ll explore on my own</button>
      </div>
    </div>
  );
}

/* ---------- getting started checklist ---------- */
function Checklist({ items, doneCount, open, setOpen, onHide, onTour }) {
  const total = items.length;
  const all = doneCount === total;
  return (
    <aside className={`ob-list ${open ? 'open' : ''}`} aria-label="Getting started">
      <button className="ob-list-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="ob-ring" style={{ '--p': doneCount / total }}><ListChecks size={15} /></span>
        <span><b>{all ? 'You’re all set' : 'Getting started'}</b><small>{doneCount} of {total} done</small></span>
        {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>
      {open && (
        <div className="ob-list-body">
          <div className="ob-bar"><i style={{ width: `${(doneCount / total) * 100}%` }} /></div>
          {all && <p className="ob-done-msg">Nice work. You’ve tried the essentials. Everything else is optional.</p>}
          <ul>
            {items.map((it) => (
              <li key={it.id} className={it.done ? 'done' : ''}>
                <span className="ob-tick">{it.done && <Check size={12} />}</span>
                <button onClick={it.run} disabled={it.done && !it.repeat}>
                  <b>{it.title}</b><small>{it.hint}</small>
                </button>
              </li>
            ))}
          </ul>
          <div className="ob-list-foot">
            <button onClick={onTour}><Compass size={13} /> Replay tour</button>
            <button onClick={onHide}>{all ? 'Close' : 'Hide for now'}</button>
          </div>
        </div>
      )}
    </aside>
  );
}

/* ---------- help menu (topbar) ---------- */
export function HelpMenu({ ob, onShortcuts }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);
  const pick = (fn) => () => { setOpen(false); fn(); };
  return (
    <div className="ob-help" ref={ref}>
      <button className="icon-btn" data-tour="help" onClick={() => setOpen(!open)} title="Help and tour" aria-label="Help" aria-expanded={open}><CircleHelp size={18} /></button>
      {open && (
        <div className="ob-menu" role="menu">
          <button role="menuitem" onClick={pick(() => ob.setTourOpen(true))}><Compass size={15} /> Take the tour</button>
          <button role="menuitem" onClick={pick(() => { ob.patch({ hidden: false }); ob.setListOpen(true); })}><ListChecks size={15} /> Getting started checklist</button>
          <button role="menuitem" onClick={pick(onShortcuts)}><Keyboard size={15} /> Keyboard shortcuts</button>
        </div>
      )}
    </div>
  );
}

/* ---------- root ---------- */
export default function Onboarding({ ob, ready, user, tasks, projects, actions }) {
  const { state, patch, welcomeOpen, setWelcomeOpen, tourOpen, setTourOpen, listOpen, setListOpen } = ob;
  const [busy, setBusy] = useState(false);

  // Decided once, on first load: brand-new accounts get the welcome; people who already
  // have data are not interrupted (the checklist stays available from the help menu).
  const decided = useRef(false);
  useEffect(() => {
    if (!ready || decided.current) return;
    decided.current = true;
    if (state.welcomed) return;
    if (tasks.length || projects.length) patch({ welcomed: true, hidden: true });
    else setWelcomeOpen(true);
  }, [ready, state.welcomed, tasks.length, projects.length, patch, setWelcomeOpen]);

  const finishWelcome = () => { setWelcomeOpen(false); patch({ welcomed: true }); };
  const closeTour = useCallback((completed) => { setTourOpen(false); patch((s) => ({ done: { ...s.done, tour: true }, welcomed: true, tourDone: completed || s.tourDone })); }, [setTourOpen, patch]);

  const items = [
    { id: 'task', title: 'Add your first task', hint: 'Press N or click New Task', done: tasks.length > 0, run: actions.newTask },
    { id: 'space', title: 'Create a space', hint: 'Group related tasks, like “Work” or “Home”', done: projects.some((p) => !p.archived) || !!state.done.space, run: actions.createSpace },
    { id: 'paste', title: 'Paste a list of tasks', hint: 'Turn notes or bullets into tasks in one go', done: !!state.done.paste, run: actions.openPaste },
    { id: 'focus', title: 'Try a focus session', hint: 'Time yourself on one task', done: !!state.done.focus, run: actions.openFocus },
    { id: 'palette', title: 'Open the command palette', hint: 'Press ⌘K to search or jump anywhere', done: !!state.done.palette, run: actions.openPalette },
  ];
  const doneCount = items.filter((x) => x.done).length;

  return (
    <>
      {welcomeOpen && (
        <Welcome
          name={(user.name || 'there').split(' ')[0]}
          busy={busy}
          onTour={() => { finishWelcome(); setTourOpen(true); }}
          onSamples={async () => { setBusy(true); try { await actions.addSamples(); } finally { setBusy(false); finishWelcome(); setTourOpen(true); } }}
          onSkip={finishWelcome}
        />
      )}
      {tourOpen && <Tour onClose={closeTour} go={actions.go} />}
      {state.welcomed && !state.hidden && !welcomeOpen && !tourOpen && (
        <Checklist items={items} doneCount={doneCount} open={listOpen} setOpen={setListOpen}
          onHide={() => patch({ hidden: true })} onTour={() => setTourOpen(true)} />
      )}
    </>
  );
}
