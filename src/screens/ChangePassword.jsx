import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

// Shown in place of the whole app (see App.jsx's top-level gate) whenever
// the signed-in person's profiles.must_change_password is still true —
// accounts are pre-created with a shared temporary password (see
// scripts/create-accounts.mjs), not self-signed-up, so everyone has to pass
// through here exactly once before reaching their dashboard.
export default function ChangePassword({ email, onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const isBusy = status === 'saving';

  async function submit(e) {
    e.preventDefault();
    if (isBusy) return;

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setStatus('saving');
    setError('');

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setStatus('idle');
      setError(updateError.message);
      return;
    }

    if (userId) {
      await supabase.from('profiles').update({ must_change_password: false }).eq('id', userId);
    }

    onDone();
  }

  return (
    <div className="login-page">
      <div className="login-masthead">
        <img
          src="/logoACPET.png"
          alt="ACPET — Ashoka Centre for a People-centric Energy Transition"
          className="login-masthead-logo"
        />
      </div>

      <div className="login-split-box" style={{ justifyContent: 'center' }}>
        <div className="login-signin-panel" style={{ margin: '0 auto' }}>
          <h2>Set your password</h2>
          <p className="small muted" style={{ marginTop: 4, marginBottom: 16 }}>
            You're signing in as <strong>{email}</strong> with a temporary
            password. Choose your own before continuing.
          </p>

          <form onSubmit={submit}>
            <label className="tiny muted" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              disabled={isBusy}
              onChange={(e) => setPassword(e.target.value)}
              style={{ marginBottom: 10 }}
            />

            <label className="tiny muted" htmlFor="confirm-password">
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              disabled={isBusy}
              onChange={(e) => setConfirm(e.target.value)}
              style={{ marginBottom: 10 }}
            />

            {error ? (
              <p className="tiny danger" style={{ marginBottom: 10 }}>
                {error}
              </p>
            ) : null}

            <button type="submit" className="primary" disabled={isBusy} style={{ width: '100%' }}>
              {isBusy ? 'Saving…' : 'Save password & continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
