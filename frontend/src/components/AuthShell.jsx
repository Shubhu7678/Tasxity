import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User, ArrowRight, ArrowUpRight, Sparkles } from 'lucide-react';
import Logo from './Logo';
import Mountain from './Mountain';
import { useAuth } from '../context/AuthContext';
import { errMsg } from '../api';

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
        <Mountain />
        <Link to="/"><Logo /></Link>
        <div className="auth-tag">
          <h2>Plan.<br />Track.<br />Deliver.</h2>
          <p>Turn your tasks into progress.</p>
        </div>
      </div>
      <div className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <h3>{signup ? 'Create your account 🚀' : 'Welcome back 👋'}</h3>
          <p className="muted">{signup ? 'Start managing your work with Tasxity' : 'Sign in to your Tasxity account'}</p>
          <button type="button" className="social">Continue with Google</button>
          <button type="button" className="social">Continue with GitHub</button>
          <div className="divider"><span>or continue with email</span></div>
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
          {!signup && <>
            <div className="divider guest-divider"><span>or take a look around</span></div>
            <button type="button" className="guest-access" onClick={exploreAsGuest} disabled={busy}>
              <span className="guest-access-icon"><Sparkles size={17} /></span>
              <span className="guest-access-copy"><b>Curious about Tasxity?</b><small>Explore with a private demo account. No login details needed.</small></span>
              <span className="guest-access-action">{busy ? 'Opening…' : 'Explore'} <ArrowUpRight size={14} /></span>
            </button>
          </>}
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
