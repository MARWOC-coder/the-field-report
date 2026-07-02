import { useState } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';

export default function Login() {
  const [mode, setMode] = useState('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [form, setForm] = useState({
    email: '', password: '', callsign: '', full_name: '', invite_code: '',
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError(''); setOk(''); setBusy(true);
    try {
      if (mode === 'signup') {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(form),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Signup failed');
        setOk('Account created. Signing you in…');
      }
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });
      if (signInErr) throw new Error(signInErr.message === 'Invalid login credentials'
        ? 'Invalid email or password.'
        : signInErr.message);
    } catch (err) {
      setError(err.message);
      setOk('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <img className="login-logo" src="./assets/marwoc-logo.webp" alt="MARWOC" />
        <h1>THE FIELD <span>REPORT</span></h1>
        <div className="login-class">MARWOC · DAILY KPI COMMAND</div>
        <p className="login-motto">WE SERVE TOGETHER. WE EARN TOGETHER.</p>

        <div className="login-toggle">
          <button type="button" className={mode === 'signin' ? 'on' : ''} onClick={() => { setMode('signin'); setError(''); }}>
            Sign In
          </button>
          <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => { setMode('signup'); setError(''); }}>
            Request Access
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}
        {ok && <div className="form-ok">{ok}</div>}

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <>
              <label className="field">
                <span>Callsign (shows on the board)</span>
                <input value={form.callsign} onChange={set('callsign')} required minLength={2} maxLength={24} placeholder="e.g. Reaper" />
              </label>
              <label className="field">
                <span>Full name</span>
                <input value={form.full_name} onChange={set('full_name')} required maxLength={80} placeholder="First Last" />
              </label>
            </>
          )}
          <label className="field">
            <span>Email</span>
            <input type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" value={form.password} onChange={set('password')} required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
          </label>
          {mode === 'signup' && (
            <label className="field">
              <span>Invite code (optional — instant activation)</span>
              <input value={form.invite_code} onChange={set('invite_code')} placeholder="From your MARWOC leadership" />
            </label>
          )}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? <span className="spin" /> : mode === 'signin' ? 'Report In' : 'Request Access'}
          </button>
        </form>

        {mode === 'signup' && (
          <p className="mono small muted mt12" style={{ textAlign: 'center' }}>
            By requesting access you pledge to log honest numbers.
            <br />Honor. Courage. Commitment.
          </p>
        )}
      </div>
    </div>
  );
}

export function Standby({ onSignOut }) {
  return (
    <div className="login-wrap">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <img className="login-logo" src="./assets/marwoc-logo.webp" alt="MARWOC" />
        <h1>STAND <span>BY</span></h1>
        <div className="login-class">ACCESS REQUEST RECEIVED</div>
        <p className="mono small muted" style={{ margin: '16px 0 20px', lineHeight: 1.7 }}>
          Your request is with MARWOC command for approval.
          <br />You'll get access as soon as an admin verifies you.
          <br />Ping leadership in the community if it's urgent.
        </p>
        <button className="btn btn-ghost btn-sm" onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  );
}
