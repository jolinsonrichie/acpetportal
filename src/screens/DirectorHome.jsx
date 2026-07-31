import { useState } from 'react';
import { Avatar, Pill } from '../components/ui.jsx';
import { VerticalGroup, VERTICAL_ACCENTS, NotifyForm } from '../components/Team.jsx';
import {
  workItems,
  verticals,
  users,
  canSeeBudget,
  notifiableUsersFor,
  ROLE_LABEL,
  ROLE_TONE,
  TYPE_LABELS,
  membersOfVertical,
  filedThisWeek,
  addWorkItem,
  addGrowthNote,
  syncRealData,
} from '../data.js';
import Overview from './Overview.jsx';
import WorkWorkspace from './WorkWorkspace.jsx';

function Employees({ me, onChanged }) {
  const [view, setView] = useState('cards');
  const filedTotal = users.filter((u) => filedThisWeek(u.id)).length;
  const unassigned = users.filter((u) => !u.vertical_id);

  return (
    <div className="stack" style={{ gap: 28 }}>
      <NotifyForm
        me={me}
        people={notifiableUsersFor(me)}
        onSent={onChanged}
        heading={me.role === 'director' ? 'Send an update to ACPET' : 'Send an update to your teams'}
        everyoneLabel={me.role === 'director' ? 'Everyone at ACPET' : 'Everyone in your teams'}
      />

      <div className="between">
        <p className="small muted">
          {filedTotal} of {users.length} people filed a check-in this week
        </p>
        <div className="segmented">
          <button aria-pressed={view === 'cards'} onClick={() => setView('cards')} style={{ fontSize: 13 }}>
            Cards
          </button>
          <button aria-pressed={view === 'table'} onClick={() => setView('table')} style={{ fontSize: 13 }}>
            Table
          </button>
        </div>
      </div>

      {verticals.map((v, i) => (
        <VerticalGroup
          key={v.id}
          vertical={v}
          people={membersOfVertical(v.id)}
          view={view}
          accent={VERTICAL_ACCENTS[i % VERTICAL_ACCENTS.length]}
          me={me}
          onChanged={onChanged}
        />
      ))}

      {unassigned.length ? (
        <VerticalGroup
          vertical={{
            id: 'none',
            name: 'Not yet assigned to a vertical',
            lead_id: null,
            is_crosscutting: false,
          }}
          people={unassigned}
          view={view}
          accent="var(--brand-ink)"
          me={me}
          onChanged={onChanged}
        />
      ) : null}
    </div>
  );
}

function PeopleAndRoles() {
  const [rows, setRows] = useState(users);

  const update = (id, patch) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Vertical</th>
              <th>Role</th>
              <th>Reports to</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="row" style={{ gap: 8 }}>
                    <Avatar user={u} size={24} />
                    <span>{u.full_name}</span>
                  </div>
                </td>
                <td>
                  <select
                    aria-label={`Vertical for ${u.full_name}`}
                    value={u.vertical_id ?? ''}
                    onChange={(e) =>
                      update(u.id, { vertical_id: e.target.value || null })
                    }
                  >
                    <option value="">None</option>
                    {verticals.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <div className="row" style={{ gap: 8 }}>
                    <Pill tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Pill>
                    <select
                      aria-label={`Role for ${u.full_name}`}
                      value={u.role}
                      onChange={(e) => update(u.id, { role: e.target.value })}
                    >
                      {Object.entries(ROLE_LABEL).map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td>
                  <select
                    aria-label={`Manager for ${u.full_name}`}
                    value={u.reports_to ?? ''}
                    onChange={(e) =>
                      update(u.id, { reports_to: e.target.value || null })
                    }
                    style={
                      u.reports_to || u.role === 'director'
                        ? undefined
                        : { borderColor: 'var(--red-fg)' }
                    }
                  >
                    <option value="">Unassigned</option>
                    {rows
                      .filter((m) => m.id !== u.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}
                        </option>
                      ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <button className="primary">Invite person</button>
      </div>
    </div>
  );
}

const NAV = [
  { id: 'overview', label: 'Overview' },
  { id: 'work', label: 'Work' },
  { id: 'employees', label: 'Employees' },
  { id: 'people', label: 'People & roles' },
];

const TAB_TITLE = {
  overview: 'Overview',
  work: 'Work',
  employees: 'Employees',
  people: 'People & roles',
};

// Director-only now (2026-07-31) — senior_research_lead moved to its own
// Vertical Lead Portal (VerticalLeadHome.jsx) instead of this restricted
// view, per the user's own framing that Goswami shouldn't see "director
// style" at all. The old restricted/Admin-vs-Editor split that used to live
// here is gone; canSeeBudget/ORG_WIDE_ROLES in data.js are unchanged, this
// screen just no longer needs to branch on them.
export default function DirectorHome({ me, onSignOut, onOrgChart }) {
  const [tab, setTab] = useState('employees');
  const showBudget = canSeeBudget(me);

  // workItems/comments are mutated arrays, not React state (see addWorkItem's
  // comment in data.js) — bumping this forces a re-render after any add.
  const [, bumpItems] = useState(0);
  // addWorkItem is async — a real signed-in session awaits genuine Supabase
  // inserts (item, verticals, initial members) before this resolves. async +
  // no local catch: a real write failing (e.g. a pending migration) needs to
  // reach the New Work wizard's own error display, not vanish here as an
  // unhandled rejection — see NewWorkWizard.jsx's submit().
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

  const atRisk = workItems.filter((w) =>
    ['at risk', 'blocked'].includes(w.status.toLowerCase())
  ).length;

  return (
    <div className="dir-shell">
      <aside className="dir-sidebar">
        <img src="/logoACPET.png" alt="ACPET" className="dir-sidebar-logo" />

        <nav className="dir-nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              aria-pressed={tab === n.id}
              onClick={() => setTab(n.id)}
            >
              {n.label}
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
            <button
              className="hub-header-link"
              style={{ flex: 1, textAlign: 'center' }}
              onClick={onOrgChart}
            >
              Org chart
            </button>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button
              className="hub-header-link danger"
              style={{ flex: 1, textAlign: 'center' }}
              onClick={onSignOut}
            >
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
          {atRisk ? <Pill tone="red">{atRisk} at risk</Pill> : null}
        </div>

        <div className="dir-kpis">
          {showBudget ? (
            <div className="kpi-tile" style={{ background: 'var(--brand-panel-2)' }}>
              <p className="kpi-label">Budget</p>
              <p className="kpi-value">Coming soon</p>
              <p className="kpi-sub">Budget tracking isn't wired up yet</p>
            </div>
          ) : null}
          <div className="kpi-tile" style={{ background: 'var(--brand-amber)' }}>
            <p className="kpi-label">Active items</p>
            <p className="kpi-value">{workItems.length}</p>
            <p className="kpi-sub">
              {Object.values(TYPE_LABELS)
                .map((t) => t.plural.toLowerCase())
                .join(', ')}
            </p>
          </div>
          <div className="kpi-tile" style={{ background: 'var(--brand-slate)' }}>
            <p className="kpi-label">Verticals</p>
            <p className="kpi-value">{verticals.length}</p>
            <p className="kpi-sub">{users.length} people total</p>
          </div>
        </div>

        <div className="hub-section-title">
          <span className="bar" />
          <h2>{TAB_TITLE[tab]}</h2>
        </div>

        {tab === 'overview' && (
          <Overview me={me} onItemsChanged={() => bumpItems((n) => n + 1)} />
        )}
        {tab === 'work' && (
          <WorkWorkspace
            me={me}
            scopeVerticals={verticals}
            onAddItem={handleAddItem}
            onAddNote={handleAddNote}
            onChanged={() => bumpItems((n) => n + 1)}
          />
        )}
        {tab === 'employees' && (
          <Employees me={me} onChanged={() => bumpItems((n) => n + 1)} />
        )}
        {tab === 'people' && <PeopleAndRoles />}
      </main>
    </div>
  );
}
