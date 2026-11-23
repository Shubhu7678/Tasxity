import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Play, LayoutGrid, FolderKanban, CalendarDays, Repeat, Bell, ClipboardPaste,
  Command, Activity, Check, Sparkles, Keyboard, Timer, ChevronDown, Zap, Search,
} from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import './home.css';

/* Adds .in to any .rv element once it scrolls into view. */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.rv');
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* Cursor-following spotlight on cards. */
function spotlight(e) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
}

const marquee = [
  [LayoutGrid, 'Kanban board'], [CalendarDays, 'Calendar view'], [Repeat, 'Recurring tasks'], [Timer, 'Focus timer'],
  [ClipboardPaste, 'Smart Paste'], [Bell, 'Reminders'], [Command, 'Command palette'], [Activity, 'Productivity stats'],
  [FolderKanban, 'Projects'], [Keyboard, 'Keyboard shortcuts'],
];

const steps = [
  { n: '01', title: 'Capture anything', text: 'Type a task, press N, or paste a whole list. Tasxity turns messy notes into clean tasks in seconds.' },
  { n: '02', title: 'Plan your day', text: 'Drag work across the board, set due dates and priorities, and pick the few things that matter today.' },
  { n: '03', title: 'Focus and finish', text: 'Start a focus session, let reminders nudge you, and watch your weekly progress climb.' },
];

const shortcuts = [
  [['⌘', 'K'], 'Command palette'], [['N'], 'New task'], [['/'], 'Search'],
  [['G', 'M'], 'Go to My Tasks'], [['G', 'C'], 'Go to Calendar'], [['⌘', '⇧', 'V'], 'Paste tasks'],
];

const faqs = [
  ['Is Tasxity free to use?', 'Yes. Create an account and start organizing right away. You can also try the dashboard as a guest without signing up.'],
  ['What is Smart Paste?', 'Paste a numbered list, bullets, checkboxes, or Markdown headings and Tasxity detects each line as a task. You review and select what to import, up to 100 tasks at once, into any project.'],
  ['How do recurring tasks work?', 'Set a repeat with an end date or an occurrence limit. When you complete a task, the next occurrence is created for you automatically.'],
  ['Will reminders reach me if the app is closed?', 'Reminders are saved with your account and delivered while Tasxity is open in your browser, with optional browser notifications. They are not sent while the browser is closed.'],
  ['Can I move my existing task list in?', 'Yes. Paste it with Smart Paste, and export any project back out as plain text, a Markdown checklist, or a detailed list.'],
];

export default function Home() {
  const { user, continueAsGuest } = useAuth();
  const navigate = useNavigate();
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState('');
  const tryDemo = async () => {
    setDemoBusy(true); setDemoError('');
    try { await continueAsGuest(); navigate('/dashboard'); }
    catch { setDemoError('Could not open the demo right now. Please try again.'); setDemoBusy(false); }
  };
  const [scrolled, setScrolled] = useState(false);
  useReveal();

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  const cta = user ? (
    <Link to="/dashboard" className="btn btn-primary">Dashboard <ArrowRight size={16} /></Link>
  ) : (
    <>
      <Link to="/login" className="link">Sign in</Link>
      <Link to="/signup" className="btn btn-primary">Get Started <ArrowRight size={16} /></Link>
    </>
  );

  return (
    <div className="lp">
      <div className="lp-aurora" aria-hidden="true"><i /><i /><i /></div>
      <div className="lp-grid" aria-hidden="true" />

      <header className={`lp-nav ${scrolled ? 'scrolled' : ''}`}>
        <Logo />
        <nav className="lp-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#shortcuts">Shortcuts</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="lp-cta">{cta}</div>
      </header>

      {/* HERO */}
      <section className="lp-hero">
        <span className="lp-pill lp-fade" style={{ '--d': '0ms' }}><b>New</b> Smart Paste, focus timer and recurring tasks <ArrowRight size={12} /></span>
        <h1 className="lp-h1">
          {['Plan.', 'Track.', 'Deliver.'].map((w, i) => (
            <span className="lp-word" key={w} style={{ '--d': `${120 + i * 110}ms` }}>{w}</span>
          ))}
          <br />
          <span className="lp-word lp-grad" style={{ '--d': '520ms' }}>Your work, finally calm.</span>
        </h1>
        <p className="lp-sub lp-fade" style={{ '--d': '640ms' }}>
          Tasxity is a task and project manager for people who want less clutter and more finished work.
          Board, list and calendar views, a focus timer, reminders and recurring tasks, all in one fast, keyboard-friendly workspace.
        </p>
        <div className="lp-actions lp-fade" style={{ '--d': '760ms' }}>
          <Link to="/signup" className="btn btn-primary lp-btn-lg">Get Started Free <ArrowRight size={16} /></Link>
          {!user && <button type="button" className="btn btn-ghost lp-btn-lg" onClick={tryDemo} disabled={demoBusy}><Play size={14} /> {demoBusy ? 'Opening demo…' : 'Try live demo'}</button>}
        </div>
        {!user && <p className="lp-note lp-fade" style={{ '--d': '840ms' }}>{demoError || 'No sign-up needed. Open a private demo workspace in one click.'}</p>}

        <div className="lp-stage lp-fade" style={{ '--d': '900ms' }}>
          <div className="lp-float lp-float-a"><span className="ok"><Check size={13} /></span> Task completed<small>Design review</small></div>
          <div className="lp-float lp-float-b"><Bell size={14} /> Reminder in 10 min<small>Send weekly report</small></div>
          <div className="lp-float lp-float-c"><Timer size={14} /> Focus 24:59</div>

          <div className="lp-window">
            <div className="lp-chrome"><i /><i /><i /><span>tasxity.app/dashboard</span></div>
            <div className="lp-app">
              <aside className="lp-side">
                {[['Overview', LayoutGrid], ['My Tasks', Check], ['Projects', FolderKanban], ['Calendar', CalendarDays], ['Productivity', Activity]].map(([n, Icon], i) => (
                  <span key={n} className={i === 0 ? 'on' : ''}><Icon size={13} />{n}</span>
                ))}
              </aside>
              <div className="lp-main">
                <div className="lp-top">
                  <div><small>Good morning</small><h4>Let’s make <em>progress</em> today.</h4></div>
                  <span className="lp-search"><Search size={12} /> Search <kbd>/</kbd></span>
                </div>
                <div className="lp-tiles">
                  {[['Open', '12'], ['Due today', '4'], ['Done this week', '18'], ['Focus', '3h 20m']].map(([l, v]) => (
                    <div key={l}><small>{l}</small><b>{v}</b></div>
                  ))}
                </div>
                <div className="lp-cols">
                  <div><b>To Do</b><i className="c p-high"><u />Plan sprint</i><i className="c"><u />Write brief</i></div>
                  <div><b>In Progress</b>
                    <i className="c p-med lp-move"><u />Design review</i>
                    <i className="c p-low"><u />API docs</i>
                  </div>
                  <div><b>Review</b><i className="c p-med"><u />Landing copy</i></div>
                  <div><b>Done</b><i className="c done"><u />Set up repo</i><i className="c done"><u />Kickoff</i></div>
                </div>
                <div className="lp-progress"><span>Weekly progress</span><div><i /></div><em>72%</em></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <section className="lp-marquee" aria-label="Capabilities">
        <div className="lp-track">
          {[...marquee, ...marquee].map(([Icon, label], i) => (
            <span key={i}><Icon size={15} />{label}</span>
          ))}
        </div>
      </section>

      {/* WHAT IT IS */}
      <section className="lp-section lp-intro">
        <p className="lp-eyebrow rv">What is Tasxity</p>
        <h2 className="lp-h2 rv">One place for every task, project and plan, <span className="lp-muted">without the bloat.</span></h2>
        <p className="lp-lead rv">
          Most task apps either do too little or bury you in settings. Tasxity keeps the essentials sharp: capture fast,
          organize into projects, see your work as a board, list or calendar, and stay on track with reminders and a built-in focus timer.
        </p>
      </section>

      {/* BENTO */}
      <section id="features" className="lp-section">
        <p className="lp-eyebrow rv"><Sparkles size={13} /> Features</p>
        <h2 className="lp-h2 rv">Everything you need to stay productive</h2>
        <div className="lp-bento">
          <article className="lp-card span2 rv" onPointerMove={spotlight}>
            <div className="lp-ico"><LayoutGrid size={18} /></div>
            <h3>Board, list and calendar</h3>
            <p>Drag tasks between To Do, In Progress, Review and Done. Switch to a list or calendar whenever you want a different angle. Order is saved per column.</p>
            <div className="lp-viz kanban">
              {[0, 1, 2].map((c) => (
                <div key={c}>{[0, 1, 2].slice(0, 3 - c).map((r) => <i key={r} style={{ '--i': c * 3 + r }} />)}</div>
              ))}
            </div>
          </article>

          <article className="lp-card rv" style={{ '--d': '80ms' }} onPointerMove={spotlight}>
            <div className="lp-ico"><ClipboardPaste size={18} /></div>
            <h3>Smart Paste</h3>
            <p>Paste a messy list. Get clean tasks.</p>
            <div className="lp-viz paste">
              <code><span>1. Book venue</span><span>- [ ] Send invites</span><span># Order catering</span></code>
              <div><em>Book venue</em><em>Send invites</em><em>Order catering</em></div>
            </div>
          </article>

          <article className="lp-card rv" onPointerMove={spotlight}>
            <div className="lp-ico"><Timer size={18} /></div>
            <h3>Focus mode</h3>
            <p>Start a timed session on one task. Pause, resume and review your totals later.</p>
            <div className="lp-viz ring">
              <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="32" /><circle className="arc" cx="40" cy="40" r="32" /></svg>
              <b>24:59</b>
            </div>
          </article>

          <article className="lp-card rv" style={{ '--d': '80ms' }} onPointerMove={spotlight}>
            <div className="lp-ico"><Repeat size={18} /></div>
            <h3>Recurring tasks</h3>
            <p>Daily stand-ups, weekly reports. Finish one and the next appears, up to an end date or limit you choose.</p>
            <div className="lp-viz repeat"><span>Mon</span><span>Tue</span><span className="on">Wed</span><span>Thu</span><span>Fri</span></div>
          </article>

          <article className="lp-card rv" style={{ '--d': '160ms' }} onPointerMove={spotlight}>
            <div className="lp-ico"><Bell size={18} /></div>
            <h3>Reminders</h3>
            <p>Snooze, dismiss, or get a browser notification when something is due.</p>
            <div className="lp-viz bell"><Bell size={26} /><i /></div>
          </article>

          <article className="lp-card span2 rv" onPointerMove={spotlight}>
            <div className="lp-ico"><Activity size={18} /></div>
            <h3>See how you’re really doing</h3>
            <p>Weekly completion charts and focus totals show where your time goes, so each week gets a little better than the last.</p>
            <div className="lp-viz bars">
              {[38, 62, 45, 80, 55, 92, 70].map((h, i) => <i key={i} style={{ '--h': `${h}%`, '--i': i }} />)}
            </div>
          </article>

          <article className="lp-card rv" onPointerMove={spotlight}>
            <div className="lp-ico"><FolderKanban size={18} /></div>
            <h3>Project workspaces</h3>
            <p>Color-coded projects keep related work together. Archive when done, export anytime.</p>
            <div className="lp-viz dots"><i style={{ background: '#7c7ff8' }} /><i style={{ background: '#5fd38a' }} /><i style={{ background: '#eab308' }} /><i style={{ background: '#f87171' }} /></div>
          </article>

        </div>
      </section>

      {/* HOW */}
      <section id="how" className="lp-section">
        <p className="lp-eyebrow rv"><Zap size={13} /> How it works</p>
        <h2 className="lp-h2 rv">From scattered to shipped in three steps</h2>
        <div className="lp-steps">
          {steps.map((s, i) => (
            <div className="lp-step rv" key={s.n} style={{ '--d': `${i * 120}ms` }}>
              <span>{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SHORTCUTS */}
      <section id="shortcuts" className="lp-section lp-split">
        <div>
          <p className="lp-eyebrow rv"><Keyboard size={13} /> Shortcuts</p>
          <h2 className="lp-h2 rv">Fast enough to keep up with your thoughts</h2>
          <p className="lp-lead rv">Hands stay on the keyboard. Jump anywhere, add a task, or paste a list without reaching for the mouse.</p>
        </div>
        <ul className="lp-keys rv">
          {shortcuts.map(([keys, label]) => (
            <li key={label}>
              <span>{label}</span>
              <span>{keys.map((k) => <kbd key={k}>{k}</kbd>)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section id="faq" className="lp-section lp-faq">
        <p className="lp-eyebrow rv">FAQ</p>
        <h2 className="lp-h2 rv">Questions, answered</h2>
        <div className="lp-faq-list rv">
          {faqs.map(([q, a]) => (
            <details key={q}>
              <summary>{q}<ChevronDown size={18} /></summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="lp-final rv">
        <div className="lp-final-glow" aria-hidden="true" />
        <h2 className="lp-h2">Ready to get your work under control?</h2>
        <p className="lp-lead">Create a free account in seconds and start with your first project.</p>
        <div className="lp-actions">
          <Link to={user ? '/dashboard' : '/signup'} className="btn btn-primary lp-btn-lg">{user ? 'Open Dashboard' : 'Get Started Free'} <ArrowRight size={16} /></Link>
          {!user && <button type="button" className="btn btn-ghost lp-btn-lg" onClick={tryDemo} disabled={demoBusy}><Play size={14} /> {demoBusy ? 'Opening demo…' : 'Try live demo'}</button>}
        </div>
      </section>

      <footer className="lp-footer">
        <Logo />
        <nav><a href="#features">Features</a><a href="#how">How it works</a><a href="#shortcuts">Shortcuts</a><a href="#faq">FAQ</a></nav>
        <span>© {new Date().getFullYear()} Tasxity. All rights reserved.</span>
      </footer>
    </div>
  );
}
