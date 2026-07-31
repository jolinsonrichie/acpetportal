import { useState } from 'react';
import { Avatar, Empty } from '../components/ui.jsx';
import Notifications from '../components/Notifications.jsx';
import Overview from './Overview.jsx';
import WorkWorkspace from './WorkWorkspace.jsx';
import {
  itemsForUser,
  countsByType,
  getUser,
  getVertical,
  users,
  allTeamsOf,
  notificationsFor,
  formatDate,
  TYPE_LABELS,
  CURRENT_WEEK,
  addWorkItem,
  addGrowthNote,
  isFridayReminderWindow,
  syncRealData,
} from '../data.js';

// Not a real ISO week number, just enough to key a localStorage dismissal
// per calendar week so "hide this" doesn't come back until next Friday.
function weekKey(date) {
  const jan1 = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - jan1) / 86400000);
  return `${date.getFullYear()}-w${Math.ceil((days + jan1.getDay() + 1) / 7)}`;
}

// Friday-afternoon nudge to log progress for the week — reacts to the real
// clock (see isFridayReminderWindow's own comment in data.js), dismissible
// per person per week via localStorage so it doesn't nag on every reload.
function WeeklyReminderBanner({ me, onAddWork }) {
  const now = new Date();
  const storageKey = `acpet-reminder-dismissed-${me.id}-${weekKey(now)}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });

  if (dismissed || !isFridayReminderWindow(now)) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // localStorage unavailable (private mode, etc.) — just dismiss for this render.
    }
  }

  return (
    <div className="reminder-banner">
      <div>
        <p className="small" style={{ fontWeight: 600 }}>
          It's Friday afternoon — log your progress for the week
        </p>
        <p className="tiny muted">
          A quick update helps your lead and the rest of ACPET see what's moving.
        </p>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="primary" onClick={onAddWork}>
          Add work
        </button>
        <button className="quiet" onClick={dismiss} aria-label="Dismiss reminder">
          ✕
        </button>
      </div>
    </div>
  );
}

function MyVertical({ me }) {
  const vertical = getVertical(me.vertical_id);
  if (!vertical) {
    return (
      <Empty
        title="You're not in a vertical yet"
        hint="Your director assigns this on the People and roles screen."
      />
    );
  }
  const lead = getUser(vertical.lead_id);
  const team = users.filter((u) => u.vertical_id === vertical.id);

  return (
    <div className="card">
      <h2>{vertical.name}</h2>
      <p className="tiny muted">
        {team.length} members ·{' '}
        {lead ? `led by ${lead.full_name}` : 'no lead assigned'}
      </p>
      <div className="card-divider stack" style={{ gap: 12 }}>
        {team.map((u) => (
          <div className="row" key={u.id}>
            <Avatar user={u} size={30} />
            <div className="grow">
              <p className="small">{u.full_name}</p>
              <p className="tiny muted">
                {u.id === vertical.lead_id ? 'Vertical lead' : u.job_title}
                {u.id === me.id ? ' · you' : ''}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const APP_LABEL = {
  overview: 'Overview',
  work: 'Work',
  vertical: 'My vertical',
  notifications: 'Notifications',
};

// Distinct accents per stat so the hero strip doesn't read as one flat block.
const HERO_STAT_ACCENTS = ['#8bc34a', '#e0a83b', '#5b9bd5', '#caa53d', '#e0435a'];

function ProfilePanel({ me, profile, setProfile, onClose }) {
  const [form, setForm] = useState(profile);
  const [saved, setSaved] = useState(false);

  function save() {
    setProfile(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  }

  return (
    <>
      <div className="profile-backdrop" onClick={onClose} />
      <div className="profile-panel" role="dialog" aria-label="Your profile">
        <div className="between" style={{ marginBottom: 16 }}>
          <div className="row">
            <Avatar user={me} size={40} />
            <div>
              <p className="small" style={{ fontWeight: 700 }}>{me.full_name}</p>
              <p className="tiny muted">{me.email}</p>
            </div>
          </div>
          <button className="quiet" onClick={onClose} aria-label="Close profile">
            ✕
          </button>
        </div>

        <div className="stack" style={{ gap: 12 }}>
          <div>
            <label className="tiny muted" htmlFor="profile-title">
              Designation
            </label>
            <input
              id="profile-title"
              value={form.job_title}
              onChange={(e) => setForm({ ...form, job_title: e.target.value })}
            />
          </div>
          <div>
            <label className="tiny muted" htmlFor="profile-qual">
              Qualifications
            </label>
            <textarea
              id="profile-qual"
              value={form.qualifications}
              onChange={(e) => setForm({ ...form, qualifications: e.target.value })}
              placeholder="e.g. PhD in Environmental Engineering, IIT Bombay"
            />
          </div>
          <div>
            <label className="tiny muted" htmlFor="profile-phone">
              Phone
            </label>
            <input
              id="profile-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Not set"
            />
          </div>
        </div>

        <div
          className="card-divider"
          style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}
        >
          {saved ? <span className="tiny ok">Saved</span> : null}
          <button className="primary" onClick={save}>
            Save changes
          </button>
        </div>
      </div>
    </>
  );
}

export default function EmployeeHome({ me, onSignOut, onOrgChart }) {
  const [tab, setTab] = useState('overview');
  const [read, setRead] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState({
    job_title: me.job_title,
    qualifications: me.qualifications || '',
    phone: me.phone || '',
  });
  // addWorkItem/addGrowthNote mutate data.js's module-level arrays directly
  // (see addWorkItem's comment) rather than React state, so bumping this on
  // every add is what actually triggers EmployeeHome (and everything under
  // it — My work, Overview, the hero stats) to re-render with the new item.
  const [, bumpItems] = useState(0);
  // addWorkItem is async — a real signed-in session awaits a genuine
  // Supabase insert before this resolves; the mock path resolves right away.
  // async + no local catch: a real write failing (e.g. a pending migration)
  // needs to reach the New Work wizard's own error display, not vanish here
  // as an unhandled rejection — see NewWorkWizard.jsx's submit().
  const handleAddItem = async (fields) => {
    await addWorkItem(fields, me.id);
    bumpItems((n) => n + 1);
  };
  const handleAddNote = async (fields) => {
    await addGrowthNote(fields, me.id);
    bumpItems((n) => n + 1);
  };

  // Nothing here is on a live Realtime subscription yet, so another real
  // account's projects/comments/updates only show up on this session's next
  // sign-in or reload unless pulled manually — this button is that manual
  // pull (see syncRealData's own comment in data.js).
  const [syncing, setSyncing] = useState(false);
  function handleRefresh() {
    setSyncing(true);
    syncRealData().then(() => {
      bumpItems((n) => n + 1);
      setSyncing(false);
    });
  }

  const vertical = getVertical(me.vertical_id);
  const mine = itemsForUser(me.id);
  const counts = countsByType(me.id);
  const unread = notificationsFor(me.id).filter(
    (n) => !n.is_read && !read.includes(n.id)
  ).length;

  const appTabs = [
    { id: 'overview', label: APP_LABEL.overview },
    { id: 'work', label: APP_LABEL.work },
    { id: 'vertical', label: APP_LABEL.vertical },
    {
      id: 'notifications',
      label: APP_LABEL.notifications,
      badge: unread || undefined,
    },
  ];

  return (
    <>
      <div className="hub-header">
        <img src="/logoACPET.png" alt="ACPET" className="hub-header-logo" />
        <span className="hub-header-orgname">
          Ashoka Centre for People-centric Energy Transition
        </span>
        <span className="grow" />
        <div className="hub-header-actions">
          <button className="hub-header-link" onClick={handleRefresh} disabled={syncing}>
            {syncing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className="hub-header-link" onClick={onOrgChart}>
            Org chart
          </button>
          <button className="hub-header-link danger" onClick={onSignOut}>
            Sign out
          </button>
        </div>
        <button
          className="avatar-trigger"
          onClick={() => setProfileOpen(true)}
          aria-haspopup="dialog"
        >
          <Avatar user={me} size={32} />
        </button>
      </div>

      {profileOpen ? (
        <ProfilePanel
          me={me}
          profile={profile}
          setProfile={setProfile}
          onClose={() => setProfileOpen(false)}
        />
      ) : null}

      <WeeklyReminderBanner me={me} onAddWork={() => setTab('work')} />

      <div className="hub-hero">
        <div className="hub-hero-top">
          <div>
            <h1>Welcome, {me.full_name.split(' ').slice(-1)[0]}!</h1>
            <p className="hub-hero-designation">{profile.job_title}</p>
          </div>
          <div className="hub-hero-context">
            <span className="hub-hero-context-lead">
              {vertical ? vertical.name : 'No vertical'}
            </span>
            <span>
              {mine.length} active work item{mine.length === 1 ? '' : 's'}
            </span>
            <span>Week of {formatDate(CURRENT_WEEK)}</span>
          </div>
        </div>

        <div className="hub-hero-grid">
          <div className="hub-hero-card">
            <h3>Log new work</h3>
            <p>Add a project, paper, proposal, blue-sky idea, or a quick update.</p>
            <button className="primary" onClick={() => setTab('work')}>
              Add work
            </button>
          </div>
          <div className="hub-hero-card">
            <h3>Notifications</h3>
            <p>
              {unread
                ? `You have ${unread} unread notification${unread === 1 ? '' : 's'}.`
                : "You're all caught up."}
            </p>
            <button onClick={() => setTab('notifications')}>View all</button>
          </div>
        </div>

        <div className="hub-hero-stats-panel">
          <span className="hub-hero-stats-title">Current stats</span>
          <div className="hub-hero-stats">
            {[
              ...Object.entries(TYPE_LABELS).map(([id, t]) => ({
                key: id,
                label: t.plural,
                value: counts[id],
              })),
              { key: 'unread', label: 'Unread', value: unread },
            ].map((stat, i) => (
              <div
                className="hub-hero-stat"
                key={stat.key}
                style={{ borderTopColor: HERO_STAT_ACCENTS[i % HERO_STAT_ACCENTS.length] }}
              >
                <p className="hub-hero-stat-value">{stat.value}</p>
                <p className="hub-hero-stat-label">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <nav className="tile-row" aria-label="Sections">
        {appTabs.map((t) => (
          <button
            key={t.id}
            className="tile"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.badge ? <span className="tile-badge">{t.badge}</span> : null}
          </button>
        ))}
      </nav>

      <div className="hub-body">
        {tab === 'overview' && (
          <Overview me={me} onItemsChanged={() => bumpItems((n) => n + 1)} />
        )}
        {tab === 'work' && (
          <WorkWorkspace
            me={me}
            scopeVerticals={allTeamsOf(me.id)}
            onAddItem={handleAddItem}
            onAddNote={handleAddNote}
            onChanged={() => bumpItems((n) => n + 1)}
          />
        )}
        {tab === 'vertical' && <MyVertical me={me} />}
        {tab === 'notifications' && (
          <Notifications
            me={me}
            read={read}
            markRead={(id) => setRead((r) => (r.includes(id) ? r : [...r, id]))}
          />
        )}
      </div>
    </>
  );
}
