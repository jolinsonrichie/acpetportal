import { useState } from 'react';
import { ALLOWED_EMAIL_DOMAIN } from '../authConfig.js';
import { supabase } from '../lib/supabaseClient.js';

// Real Supabase Auth sign-in (2026-07-31), same as Login.jsx, but gated on
// the resulting profile's role actually being 'director' — this used to be
// a mock-only "any input signs you in as a director" preview with no real
// check behind it at all.
export default function DirectorLogin({ onSignIn, onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const isBusy = status === 'validating' || status === 'success';

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
      .select('email, vertical_id, role, must_change_password')
      .eq('id', data.user.id)
      .single();

    if (profile?.role !== 'director') {
      await supabase.auth.signOut();
      setStatus('idle');
      setError('This account is not a Director account.');
      return;
    }

    setStatus('success');
    onSignIn({
      email: profile.email ?? data.user.email,
      authId: data.user.id,
      verticalId: profile.vertical_id ?? null,
      mustChangePassword: profile.must_change_password ?? false,
    });
  }

  return (
    <div className="director-login-page">
      <div className="director-login-card">
        <img
          src="/logoACPET.png"
          alt="ACPET"
          className="director-login-logo"
        />

        <h1>Director access</h1>
        <p className="small" style={{ color: 'rgba(255,255,255,0.65)', marginTop: 4, marginBottom: 20 }}>
          Restricted sign-in for ACPET Directors only.
        </p>

        <form onSubmit={submit}>
          <label className="tiny" style={{ color: 'rgba(255,255,255,0.65)' }} htmlFor="director-email">
            Director email
          </label>
          <input
            id="director-email"
            type="email"
            autoComplete="email"
            placeholder={`director@${ALLOWED_EMAIL_DOMAIN}`}
            value={email}
            disabled={isBusy || status === 'success'}
            onChange={(e) => setEmail(e.target.value)}
            style={{ marginBottom: 10 }}
          />

          <label className="tiny" style={{ color: 'rgba(255,255,255,0.65)' }} htmlFor="director-password">
            Password
          </label>
          <input
            id="director-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            disabled={isBusy || status === 'success'}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginBottom: 10 }}
          />

          <div aria-live="polite">
            {status === 'success' ? (
              <p className="tiny ok" style={{ marginBottom: 10 }}>
                Verified — signing you in…
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
            disabled={isBusy || status === 'success'}
            style={{ width: '100%' }}
          >
            {isBusy ? (
              <>
                <span className="login-spinner" />
                Verifying…
              </>
            ) : status === 'success' ? (
              'Signed in'
            ) : (
              'Continue'
            )}
          </button>
        </form>

        <button className="director-login-back" onClick={onBack} type="button">
          ← Not a director? Go to portal sign-in
        </button>
      </div>
    </div>
  );
}
