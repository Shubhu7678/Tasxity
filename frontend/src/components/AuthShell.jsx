import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User, ArrowRight, ArrowLeft, Sparkles, Check, LayoutGrid, Timer, ClipboardPaste } from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';
import { errMsg } from '../api';
import './auth.css';

const BENEFITS = [
  [LayoutGrid, 'Board, list and calendar', 'See your work the way that suits you'],
  [ClipboardPaste, 'Smart Paste', 'Turn messy notes into clean tasks'],
  [Timer, 'Focus timer and reminders', 'Stay on track without the noise'],
];

const GoogleMark = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.9 2.3 2.8 6.4 2.8 11.5S6.9 20.7 12 20.7c5.3 0 8.8-3.7 8.8-9 0-.6-.1-1.1-.2-1.5H12z"/></svg>
);
const GithubMark = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>
);

export default function AuthShell({ mode }) {
  const signup = mode === 'signup';
  const { login, signup: doSignup, continueAsGuest } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await (signup ? doSignup(form) : login(form));
      navigate('/dashboard');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const exploreAsGuest = async () => {
    setError('');
    setBusy(true);
    try {
      await continueAsGuest();
      navigate('/dashboard');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-art">
        <div className="auth-aurora" aria-hidden="true"><i /><i /><i /></div>
        <div className="auth-gridbg" aria-hidden="true" />
        <Link to="/" className="auth-logo"><Logo /></Link>
        <div className="auth-tag">
          <h2>Plan.<br />Track.<br /><span>Deliver.</span></h2>
          <p>{signup ? 'Join Tasxity and turn your tasks into progress.' : 'Pick up right where you left off.'}</p>
          <ul className="auth-benefits">
            {BENEFITS.map(([Icon, title, text], i) => (
              <li key={title} style={{ '--i': i }}><span><Icon size={16} /></span><div><b>{title}</b><small>{text}</small></div></li>
            ))}
          </ul>
        </div>
        <div className="auth-preview" aria-hidden="true">
          <div className="auth-preview-head"><b>This week</b><span>72%</span></div>
          <div className="auth-preview-bar"><i /></div>
          <div className="auth-preview-row"><span className="ok"><Check size={11} /></span>Design review<em>Done</em></div>
          <div className="auth-preview-row"><span />Send weekly report<em className="warn">Today</em></div>
        </div>
      </div>
      <div className="auth-panel">
        <Link to="/" className="auth-back"><ArrowLeft size={14} /> Back to home</Link>
        <form className="auth-card" onSubmit={submit}>
          <h3>{signup ? 'Create your account 🚀' : 'Welcome back 👋'}</h3>
          <p className="muted">{signup ? 'Start managing your work with Tasxity' : 'Sign in to your Tasxity account'}</p>
          <button type="button" className="demo-card" onClick={exploreAsGuest} disabled={busy}>
            <span className="demo-icon"><Sparkles size={18} /></span>
            <span className="demo-copy">
              <b>{signup ? 'Not ready to sign up?' : 'New here? Try it first'}</b>
              <small>Open a private demo workspace. No email or password needed.</small>
            </span>
            <span className="demo-go">{busy ? 'Opening…' : 'Try demo'} <ArrowRight size={14} /></span>
          </button>
          <div className="divider"><span>{signup ? 'or create your account' : 'or sign in'}</span></div>
          <div className="social-row">
            <button type="button" className="social"><GoogleMark /> Google</button>
            <button type="button" className="social"><GithubMark /> GitHub</button>
          </div>
          <div className="divider"><span>or use email</span></div>
          {signup && (
            <label className="field"><User size={15} />
              <input placeholder="Enter your name" value={form.name} onChange={set('name')} required />
            </label>
          )}
          <label className="field"><Mail size={15} />
            <input type="email" placeholder="Enter your email" value={form.email} onChange={set('email')} required />
          </label>
          <label className="field"><Lock size={15} />
            <input type={show ? 'text' : 'password'} placeholder="Enter your password" minLength={6}
              value={form.password} onChange={set('password')} required />
            <button type="button" className="eye" onClick={() => setShow(!show)} aria-label="Toggle password">
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </label>
          {!signup && (
            <div className="row">
              <label className="check"><input type="checkbox" /> Remember me</label>
              <a className="link-gold" href="#">Forgot password?</a>
            </div>
          )}
          {error && <div className="error">{error}</div>}
          <button className="btn btn-primary full" disabled={busy}>
            {busy ? 'Please wait…' : signup ? 'Create Account' : 'Sign In'}
          </button>
          <p className="switch">
            {signup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <Link to={signup ? '/login' : '/signup'} className="link-gold">
              {signup ? 'Sign in' : 'Create one'} <ArrowRight size={12} />
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
