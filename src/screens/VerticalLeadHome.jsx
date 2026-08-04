import { useState } from 'react';
import { Avatar, Empty } from '../components/ui.jsx';
import { VerticalGroup, VERTICAL_ACCENTS, NotifyForm } from '../components/Team.jsx';
import Notifications from '../components/Notifications.jsx';
import WorkLocation from '../components/WorkLocation.jsx';
import WorkWorkspace from './WorkWorkspace.jsx';
import {
  verticalsLedBy,
  membersOfVertical,
  verticalsOf,
  workItems,
  ROLE_LABEL,
  notifiableUsersFor,
  notificationsFor,
  addWorkItem,
  addGrowthNote,
  syncRealData,
} from '../data.js';

// "Vertical members" — the renamed, lead-scoped equivalent of Director's
// "Employees" tab: same VerticalGroup drill-down (roster + each person's
// real work items), just looped over only the vertical(s) this viewer
// actually leads instead of every vertical org-wide.
function VerticalMembers({ me, ledVerticals, onChanged }) {
  const [view, setView] = useState('cards');

  return (
    <div className="stack" style={{ gap: 28 }}>
      <NotifyForm
        me={me}
        people={notifiableUsersFor(me)}
        onSent={onChanged}
        heading="Send an update to your teams"
        everyoneLabel="Everyone in your teams"
      />

      <div className="between">
        <p className="small muted">Segregated by the vertical(s) you lead.</p>
        <div className="segmented">
          <button aria-pressed={view === 'cards'} onClick={() => setView('cards')} style={{ fontSize: 13 }}>
            Cards
          </button>
          <button aria-pressed={view === 'table'} onClick={() => setView('table')} style={{ fontSize: 13 }}>
            Table
          </button>
        </div>
      </div>

      {ledVerticals.length ? (
        ledVerticals.map((v, i) => (
          <VerticalGroup
            key={v.id}
            vertical={v}
            people={membersOfVertical(v.id)}
            view={view}
            accent={VERTICAL_ACCENTS[i % VERTICAL_ACCENTS.length]}
            me={me}
            onChanged={onChanged}
          />
        ))
      ) : (
        <Empty title="No verticals assigned yet" />
      )}
    </div>
  );
}

const NAV = [
  { id: 'work', label: 'Work' },
  { id: 'members', label: 'Vertical members' },
  { id: 'location', label: 'Location' },
  { id: 'notifications', label: 'Notifications' },
];

const TAB_TITLE = {
  work: 'Work',
  members: 'Vertical members',
  location: 'Location',
  notifications: 'Notifications',
};

// The Vertical Lead Portal (2026-07-31) — vertical_lead, co_lead, and
// senior_research_lead all land here now instead of the Director's own
// shell. Reuses DirectorHome's dir-shell/dir-sidebar/dir-kpis CSS directly
// (same production-quality dark sidebar dashboard, just different content)
// since the user's own framing was "convert him into a vertical portal
// instead of director style" — the complaint was about DirectorHome's
// *content* (Employees/Projects & budget/People & roles, budget figures,
// org-wide framing), not the visual chrome.
export default function VerticalLeadHome({ me, onSignOut, onOrgChart }) {
  const [tab, setTab] = useState('work');
  const [read, setRead] = useState([]);
  const ledVerticals = verticalsLedBy(me);

  // workItems/comments/notifications are mutated arrays, not React state
  // (see addWorkItem's comment in data.js) — bumping this forces a
  // re-render after any add/assign/comment/contribution, same pattern
  // EmployeeHome/DirectorHome already use. This is what makes "when I
  // update this week's progress, it should reflect immediately" true within
  // this signed-in session — see ContributionsPanel/WorkItemCard's onChanged
  // plumbing, unchanged here.
  const [, bumpItems] = useState(0);
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

  const [syncing, setSyncing] = useState(false);
  function handleRefresh() {
    setSyncing(true);
    syncRealData().then(() => {
      bumpItems((n) => n + 1);
      setSyncing(false);
    });
  }

  // Deliberately scoped to exactly the verticals this person leads, not
  // visibleItems(me) — for a senior_research_lead that's a real, narrower
  // subset of their org-wide read access (see verticalsLedBy's comment).
  const scopedItems = workItems.filter((w) =>
    verticalsOf(w.id).some((v) => ledVerticals.some((lv) => lv.id === v.id))
  );
  const peopleCount = ledVerticals.reduce((n, v) => n + membersOfVertical(v.id).length, 0);
  const unread = notificationsFor(me.id).filter((n) => !n.is_read && !read.includes(n.id)).length;

  return (
    <div className="dir-shell">
      <aside className="dir-sidebar">
        <img src="/logoACPET.png" alt="ACPET" className="dir-sidebar-logo" />

        <nav className="dir-nav">
          {NAV.map((n) => (
            <button key={n.id} aria-pressed={tab === n.id} onClick={() => setTab(n.id)}>
              {n.label}
              {n.id === 'notifications' && unread ? ` (${unread})` : ''}
            </button>
          ))}
        </nav>

        <span className="grow" />

        <div className="dir-sidebar-foot">
          <div className="row" style={{ marginBottom: 10 }}>
            <Avatar user={me} size={30} />
            <div className="grow">
              <p className="small" style={{ color: '#fff' }}>
                {me.full_name}
              </p>
              <p className="tiny">{ROLE_LABEL[me.role]}</p>
            </div>
          </div>
          <div className="row" style={{ gap: 6, marginBottom: 6 }}>
            <button
              className="hub-header-link"
              style={{ flex: 1, textAlign: 'center' }}
              onClick={handleRefresh}
              disabled={syncing}
            >
              {syncing ? 'Refreshing…' : 'Refresh'}
            </button>
            <button className="hub-header-link" style={{ flex: 1, textAlign: 'center' }} onClick={onOrgChart}>
              Org chart
            </button>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="hub-header-link danger" style={{ flex: 1, textAlign: 'center' }} onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="dir-main">
        <div className="dir-topline">
          <div>
            <h1>
              Hi{' '}
              {me.full_name
                .replace(/^(Dr\.|Mr\.|Ms\.|Mrs\.)\s+/i, '')
                .split(' ')[0]}
            </h1>
            <p className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {ROLE_LABEL[me.role]} - ACPET
            </p>
          </div>
        </div>

        <div className="dir-kpis">
          <div className="kpi-tile" style={{ background: 'var(--brand-amber)' }}>
            <p className="kpi-label">Active items</p>
            <p className="kpi-value">{scopedItems.length}</p>
            <p className="kpi-sub">
              {ledVerticals.map((v) => v.name).join(', ') || 'no vertical yet'}
            </p>
          </div>
          <div className="kpi-tile" style={{ background: 'var(--brand-slate)' }}>
            <p className="kpi-label">Verticals you lead</p>
            <p className="kpi-value">{ledVerticals.length}</p>
            <p className="kpi-sub">{peopleCount} people total</p>
          </div>
        </div>

        <div className="hub-section-title">
          <span className="bar" />
          <h2>{TAB_TITLE[tab]}</h2>
        </div>

        {tab === 'work' && (
          <WorkWorkspace
            me={me}
            scopeVerticals={ledVerticals}
            onAddItem={handleAddItem}
            onAddNote={handleAddNote}
            onChanged={() => bumpItems((n) => n + 1)}
          />
        )}
        {tab === 'members' && (
          <VerticalMembers me={me} ledVerticals={ledVerticals} onChanged={() => bumpItems((n) => n + 1)} />
        )}
        {tab === 'location' && <WorkLocation me={me} />}
        {tab === 'notifications' && (
          <Notifications
            me={me}
            read={read}
            markRead={(id) => setRead((r) => (r.includes(id) ? r : [...r, id]))}
          />
        )}
      </main>
    </div>
  );
}
