import { Link } from 'react-router-dom';
import { ArrowRight, Play, LayoutGrid, FolderKanban, CalendarDays, Users, Sparkles } from 'lucide-react';
import Logo from '../components/Logo';
import Mountain from '../components/Mountain';
import { useAuth } from '../context/AuthContext';

const features = [
  { icon: LayoutGrid, title: 'Task Management', text: 'Create, organize, and prioritize tasks with ease.' },
  { icon: FolderKanban, title: 'Project Workspaces', text: 'Keep your work, team, and resources in one place.' },
  { icon: CalendarDays, title: 'Multiple Views', text: 'Board, List, Timeline, and Calendar — your choice.' },
  { icon: Users, title: 'Team Collaboration', text: 'Work together with real-time updates.' },
];

export default function Home() {
  const { user } = useAuth();
  return (
    <div className="landing">
      <header className="nav">
        <Logo />
        <nav className="nav-links">
          <a href="#features">Features</a>
          <a href="#features">Solutions</a>
          <a href="#features">Pricing</a>
          <a href="#features">Resources</a>
        </nav>
        <div className="nav-cta">
          {user ? (
            <Link to="/dashboard" className="btn btn-primary">Dashboard <ArrowRight size={16} /></Link>
          ) : (
            <>
              <Link to="/login" className="link">Sign in</Link>
              <Link to="/signup" className="btn btn-primary">Get Started <ArrowRight size={16} /></Link>
            </>
          )}
        </div>
      </header>

      <section className="hero">
        <Mountain className="hero-bg" />
        <span className="pill"><b>New</b> v2.0 is here — Faster, cleaner, and more powerful.</span>
        <h1>A simpler, more beautiful<br />way to <em>manage your work.</em></h1>
        <p>Plan, track, and deliver your tasks, projects, and goals —<br />all in one stylish workspace.</p>
        <div className="hero-actions">
          <Link to="/signup" className="btn btn-primary">Get Started Free <ArrowRight size={16} /></Link>
          <button className="btn btn-ghost"><Play size={14} /> Watch Demo</button>
        </div>
        <div className="mock">
          <div className="mock-side">
            {['Overview', 'My Tasks', 'Projects', 'Boards', 'Timeline', 'Calendar', 'Reports'].map((n, i) => (
              <span key={n} className={i === 0 ? 'on' : ''}>{n}</span>
            ))}
          </div>
          <div className="mock-main">
            <h4>Let’s make <em>progress</em> today.</h4>
            <div className="mock-stats"><i /><i /><i /><i /></div>
            <div className="mock-cols">
              {['To Do', 'In Progress', 'Review', 'Done'].map((c) => (
                <div key={c}><b>{c}</b><i /><i /><i /></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="trusted">
        <p>Trusted by individuals and growing teams</p>
        <div>{['VirVerse', 'KeyRush', 'Fern Holidays', 'Tenant Manager'].map((n) => <span key={n}>{n}</span>)}</div>
      </section>

      <section id="features" className="features">
        <span className="pill"><Sparkles size={12} /> Features</span>
        <h2>Everything you need to stay productive</h2>
        <div className="feature-grid">
          {features.map(({ icon: Icon, title, text }) => (
            <div className="card feature" key={title}>
              <div className="ico"><Icon size={18} /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="footer">© {new Date().getFullYear()} Tasxity. All rights reserved.</footer>
    </div>
  );
}
