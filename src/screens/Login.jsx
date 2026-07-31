import { useEffect, useRef, useState } from 'react';
import { ALLOWED_EMAIL_DOMAIN } from '../authConfig.js';
import { users, verticals } from '../data.js';
import { supabase } from '../lib/supabaseClient.js';

const PARALLAX_SHAPES = [
  { kind: 'ring', size: 130, top: '14%', left: '6%', depth: 18 },
  { kind: 'ring', size: 70, top: '68%', left: '10%', depth: 30 },
  { kind: 'dot', size: 14, top: '30%', left: '90%', depth: 40 },
  { kind: 'dot', size: 22, top: '78%', left: '85%', depth: 22 },
  { kind: 'ring', size: 190, top: '72%', left: '55%', depth: 12 },
  { kind: 'dot', size: 10, top: '10%', left: '60%', depth: 45 },
];

function ParallaxField() {
  const pos = useRef({ x: 0, y: 0 });
  const [, forceRender] = useState(0);
  const frame = useRef(null);

  useEffect(() => {
    function onMove(e) {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      pos.current = { x, y };
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        forceRender((n) => n + 1);
      });
    }
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <div className="login-parallax" aria-hidden="true">
      {PARALLAX_SHAPES.map((s, i) => (
        <span
          key={i}
          className={`login-parallax-shape login-parallax-${s.kind}`}
          style={{
            width: s.size,
            height: s.size,
            top: s.top,
            left: s.left,
            transform: `translate(${pos.current.x * s.depth}px, ${
              pos.current.y * s.depth
            }px)`,
          }}
        />
      ))}
    </div>
  );
}

export default function Login({ onSignedIn, onDirectorLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const isBusy = status === 'validating' || status === 'success';

  // Real password login, reattached (2026-07-31) — every account is real
  // now (scripts/create-accounts.mjs), so there's no mock fallback left:
  // whatever's typed here is sent to Supabase Auth as-is, temp shared
  // password included for anyone who hasn't set their own yet (they'll hit
  // ChangePassword.jsx's must_change_password gate right after signing in).
  async function submit(e) {
    e.preventDefault();
    if (isBusy) return;
    setStatus('validating');
    setError('');

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setStatus('idle');
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'Incorrect email or password.'
          : signInError.message
      );
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, vertical_id, must_change_password')
      .eq('id', data.user.id)
      .single();

    setStatus('success');
    onSignedIn({
      email: profile?.email ?? data.user.email,
      authId: data.user.id,
      verticalId: profile?.vertical_id ?? null,
      mustChangePassword: profile?.must_change_password ?? false,
    });
  }

  return (
    <div className="login-page">
      <ParallaxField />

      <div className="login-masthead">
        <img
          src="/logoACPET.png"
          alt="ACPET — Ashoka Centre for a People-centric Energy Transition"
          className="login-masthead-logo"
        />
      </div>

      <div className="login-hero-heading">
        <h1 className="login-tagline-heading">
          Employee Portal <span className="accent">&amp;</span> Project
          Tracker
        </h1>
      </div>

      <div className="login-split-box">
        <div className="login-vision">
          <h2>Our vision</h2>
          <p>
            To attain fair and equitable net-zero economies in the Global
            South — advancing an energy transition that is affordable,
            inclusive, sustainable, and people-centric.
          </p>
        </div>

        <div className="login-signin-panel">
          <h2>Sign in</h2>
          <p className="small muted" style={{ marginTop: 4, marginBottom: 16 }}>
            Sign in with your ACPET email (name@{ALLOWED_EMAIL_DOMAIN}) and
            password. First time signing in? Use the temporary password you
            were given — you'll be asked to set your own right after.
          </p>

          <form onSubmit={submit}>
            <label className="tiny muted" htmlFor="email">
              Work email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`}
              value={email}
              disabled={isBusy}
              onChange={(e) => setEmail(e.target.value)}
              style={{ marginBottom: 10 }}
            />

            <label className="tiny muted" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              disabled={isBusy}
              onChange={(e) => setPassword(e.target.value)}
              style={{ marginBottom: 10 }}
            />

            <div aria-live="polite">
              {status === 'success' ? (
                <p className="tiny ok" style={{ marginBottom: 10 }}>
                  You're in — signing you in…
                </p>
              ) : null}
              {error ? (
                <p className="tiny danger" style={{ marginBottom: 10 }}>
                  {error}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              className="primary"
              disabled={isBusy}
              style={{ width: '100%' }}
            >
              {status === 'validating' ? (
                <>
                  <span className="login-spinner" />
                  Checking…
                </>
              ) : status === 'success' ? (
                'Signed in'
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="tiny dim" style={{ marginTop: 14 }}>
            Access is restricted to verified ACPET email addresses.
          </p>

          {onDirectorLogin ? (
            <button
              type="button"
              className="login-director-link"
              onClick={onDirectorLogin}
            >
              Director sign-in →
            </button>
          ) : null}
        </div>
      </div>

      <div className="login-stat-cards">
        <div className="login-stat-card">
          <p className="login-stat-card-value">
            {verticals.filter((v) => v.type === 'thematic').length}
          </p>
          <p className="login-stat-card-label">Thematic verticals</p>
        </div>
        <div className="login-stat-card">
          <p className="login-stat-card-value">
            {verticals.filter((v) => v.is_crosscutting).length}
          </p>
          <p className="login-stat-card-label">Crosscutting vertical</p>
        </div>
        <div className="login-stat-card">
          <p className="login-stat-card-value">{users.length}</p>
          <p className="login-stat-card-label">People at ACPET</p>
        </div>
      </div>
    </div>
  );
}
