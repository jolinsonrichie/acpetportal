import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './screens/Login.jsx';
import DirectorLogin from './screens/DirectorLogin.jsx';
import ChangePassword from './screens/ChangePassword.jsx';
import EmployeeHome from './screens/EmployeeHome.jsx';
import VerticalLeadHome from './screens/VerticalLeadHome.jsx';
import DirectorHome from './screens/DirectorHome.jsx';
import OrgChart from './screens/OrgChart.jsx';
import {
  getUserByEmail,
  setRealAuthContext,
  syncRealData,
} from './data.js';
import { supabase } from './lib/supabaseClient.js';

// Where a signed-in user's role lands once authenticated. Rewired
// 2026-07-31: vertical_lead/co_lead/senior_research_lead all get their own
// Vertical Lead Portal now — previously vertical_lead/co_lead used
// EmployeeHome's hub shell and senior_research_lead used a restricted
// DirectorHome, per the user's own framing that Goswami (senior_research_lead)
// shouldn't see "director style" at all. Director is now the only role that
// reaches DirectorHome.
function dashboardPathFor(me) {
  if (me.role === 'director') return '/director';
  if (me.role === 'employee') return '/employee';
  return '/lead'; // vertical_lead, co_lead, senior_research_lead
}

function EmployeeShell({ me, onSignOut }) {
  const navigate = useNavigate();
  return (
    <div className="app employee-shell">
      <EmployeeHome me={me} onSignOut={onSignOut} onOrgChart={() => navigate('/org-chart')} />
    </div>
  );
}

function LeadShell({ me, onSignOut }) {
  const navigate = useNavigate();
  return (
    <div className="app lead-shell">
      <VerticalLeadHome me={me} onSignOut={onSignOut} onOrgChart={() => navigate('/org-chart')} />
    </div>
  );
}

function DirectorShell({ me, onSignOut }) {
  const navigate = useNavigate();
  return (
    <div className="app director-shell">
      <DirectorHome me={me} onSignOut={onSignOut} onOrgChart={() => navigate('/org-chart')} />
    </div>
  );
}

// Guards a route: bounces unauthenticated visitors to /login, and
// authenticated-but-wrong-role visitors to whichever dashboard is actually
// theirs (e.g. a director hitting /employee directly).
function RequireRole({ me, allow, children }) {
  if (!me) return <Navigate to="/login" replace />;
  if (!allow(me.role)) return <Navigate to={dashboardPathFor(me)} replace />;
  return children;
}

export default function App() {
  const [me, setMe] = useState(null);
  const [authPending, setAuthPending] = useState(true);
  // Gates the whole app behind ChangePassword.jsx whenever the signed-in
  // profile's must_change_password is still true (see migration 0004) —
  // holds just the email ChangePassword needs to display, everything else
  // (mock user, real auth context) is already wired up by the time this is
  // set. Reattached 2026-07-31 — this column/screen existed already but was
  // never actually checked anywhere, so the "set your own password" step
  // was silently unreachable.
  const [pendingPasswordReset, setPendingPasswordReset] = useState(null);
  const navigate = useNavigate();

  // Restores a persisted session on page load/refresh (so reloading doesn't
  // drop you back to /login) and clears everything on sign-out. Intentionally
  // does not react to SIGNED_IN — that's already handled synchronously by
  // whichever screen just called signInWithPassword.
  useEffect(() => {
    let active = true;

    async function restoreFromSession(session) {
      if (!session) {
        if (active) setAuthPending(false);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, vertical_id, must_change_password')
        .eq('id', session.user.id)
        .single();
      if (!active) return;
      const email = profile?.email ?? session.user.email;
      const user = getUserByEmail(email);
      if (user) {
        setRealAuthContext({ authId: session.user.id, mockUserId: user.id, verticalId: profile?.vertical_id ?? null });
        await syncRealData();
      }
      if (!active) return;
      if (user && profile?.must_change_password) {
        setPendingPasswordReset({ email });
      } else {
        setMe(user);
      }
      setAuthPending(false);
    }

    supabase.auth.getSession().then(({ data }) => restoreFromSession(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setMe(null);
        setRealAuthContext(null);
        setPendingPasswordReset(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Real-auth sign-in, shared by Login.jsx and DirectorLogin.jsx — resolves
  // the matching mock user by email (see getUserByEmail in data.js; the rest
  // of the app still reads role/vertical/etc. from the mock data layer, that
  // swap is separate, still-deferred work), links this session to it for
  // real work-item reads/writes, and either enters the dashboard or, for a
  // still-on-the-temp-password account, routes to ChangePassword first.
  async function handleSignedIn({ email, authId, verticalId, mustChangePassword }) {
    const user = getUserByEmail(email);
    if (user) {
      setRealAuthContext({ authId, mockUserId: user.id, verticalId });
      await syncRealData();
    }
    if (user && mustChangePassword) {
      setPendingPasswordReset({ email });
      return;
    }
    setMe(user);
    if (user) navigate(dashboardPathFor(user));
  }

  function handlePasswordChanged() {
    const email = pendingPasswordReset?.email;
    setPendingPasswordReset(null);
    const user = email ? getUserByEmail(email) : null;
    setMe(user);
    if (user) navigate(dashboardPathFor(user));
  }

  async function signOut() {
    await supabase.auth.signOut().catch(() => {});
    setMe(null);
    setRealAuthContext(null);
    setPendingPasswordReset(null);
    navigate('/login', { replace: true });
  }

  // Avoids a flash of the login screen while the initial session check is
  // still in flight on page load.
  if (authPending) return null;

  if (pendingPasswordReset) {
    return <ChangePassword email={pendingPasswordReset.email} onDone={handlePasswordChanged} />;
  }

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={<Navigate to={me ? dashboardPathFor(me) : '/login'} replace />}
        />
        <Route
          path="/login"
          element={
            <Login
              onSignedIn={handleSignedIn}
              onDirectorLogin={() => navigate('/director-login')}
            />
          }
        />
        <Route
          path="/director-login"
          element={<DirectorLogin onSignIn={handleSignedIn} onBack={() => navigate('/login')} />}
        />
        <Route
          path="/employee"
          element={
            <RequireRole me={me} allow={(role) => role === 'employee'}>
              <EmployeeShell me={me} onSignOut={signOut} />
            </RequireRole>
          }
        />
        <Route
          path="/lead"
          element={
            <RequireRole
              me={me}
              allow={(role) => role === 'vertical_lead' || role === 'co_lead' || role === 'senior_research_lead'}
            >
              <LeadShell me={me} onSignOut={signOut} />
            </RequireRole>
          }
        />
        <Route
          path="/director"
          element={
            <RequireRole me={me} allow={(role) => role === 'director'}>
              <DirectorShell me={me} onSignOut={signOut} />
            </RequireRole>
          }
        />
        <Route
          path="/org-chart"
          element={me ? <OrgChart me={me} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="*"
          element={<Navigate to={me ? dashboardPathFor(me) : '/login'} replace />}
        />
      </Routes>
    </>
  );
}
