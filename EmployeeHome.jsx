import { useState } from 'react';
import { Avatar, Pill, Tabs, Segmented, Metric, Empty } from '../components/ui.jsx';
import { WorkItemCard } from '../components/Team.jsx';
import {
  itemsForUser,
  countsByType,
  isLeadOn,
  getUser,
  getVertical,
  users,
  notificationsFor,
  workItems,
  formatDate,
  STATUS_OPTIONS,
  TYPE_LABELS,
  CURRENT_WEEK,
} from '../data.js';

function Overview({ me, draft }) {
  const counts = countsByType(me.id);
  const mine = itemsForUser(me.id);
  const done = mine.filter((i) => (draft[i.id]?.note || '').trim().length).length;
  const complete = mine.length > 0 && done === mine.length;

  return (
    <div className="stack" style={{ gap: 14 }}>
      {mine.length === 0 ? null : complete ? (
        <div className="banner" style={{ background: 'var(--green-bg)' }}>
          <div>
            <p className="small" style={{ color: 'var(--green-fg)' }}>
              This week is ready to submit
            </p>
            <p className="tiny" style={{ color: 'var(--green-fg)' }}>
              All {mine.length} items updated
            </p>
          </div>
        </div>
      ) : (
        <div className="banner">
          <div>
            <p className="small strong">Check-in due Friday</p>
            <p className="tiny">
              {done} of {mine.length} items updated
            </p>
          </div>
        </div>
      )}

      <div className="metrics">
        <Metric label="Projects" value={counts.project} />
        <Metric label="Papers" value={counts.paper} />
        <Metric label="Proposals" value={counts.proposal} />
      </div>
    </div>
  );
}

function MyWork({ me }) {
  const mine = itemsForUser(me.id);
  if (!mine.length) {
    return (
      <Empty
        title="Nothing assigned yet"
        hint="Add a project, paper, or proposal to start tracking it."
        action={<button className="primary">Add item</button>}
      />
    );
  }
  return (
    <div className="stack" style={{ gap: 12 }}>
      {mine.map((item) => (
        <WorkItemCard
          key={item.id}
          item={item}
          footerNote={`${TYPE_LABELS[item.type].singular} · you are ${
            item.role_on_item === 'lead' ? 'lead' : 'contributor'
          }`}
        />
      ))}
      <div>
        <button>Add item</button>
      </div>
    </div>
  );
}

function TypeFields({ item, value, onChange, canSetStatus }) {
  const fields = value.type_fields || {};
  const set = (patch) =>
    onChange({ ...value, type_fields: { ...fields, ...patch } });

  return (
    <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
      <div className="grow">
        <label className="tiny muted" htmlFor={`status-${item.id}`}>
          Status
        </label>
        <select
          id={`status-${item.id}`}
          disabled={!canSetStatus}
          title={
            canSetStatus
              ? undefined
              : 'Only the item lead can change the status'
          }
          value={value.status ?? item.status}
          onChange={(e) => onChange({ ...value, status: e.target.value })}
        >
          {STATUS_OPTIONS[item.type].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {item.type === 'project' ? (
        <div style={{ width: 130 }}>
          <label className="tiny muted" htmlFor={`pct-${item.id}`}>
            Percent done
          </label>
          <input
            id={`pct-${item.id}`}
            type="number"
            min="0"
            max="100"
            value={fields.percent_complete ?? ''}
            onChange={(e) => set({ percent_complete: e.target.value })}
          />
        </div>
      ) : null}

      {item.type === 'paper' ? (
        <div className="grow">
          <label className="tiny muted" htmlFor={`journal-${item.id}`}>
            Journal
          </label>
          <input
            id={`journal-${item.id}`}
            value={fields.journal ?? ''}
            onChange={(e) => set({ journal: e.target.value })}
          />
        </div>
      ) : null}

      {item.type === 'proposal' ? (
        <div className="grow">
          <label className="tiny muted" htmlFor={`funder-${item.id}`}>
            Funder
          </label>
          <input
            id={`funder-${item.id}`}
            value={fields.funder ?? ''}
            onChange={(e) => set({ funder: e.target.value })}
          />
        </div>
      ) : null}
    </div>
  );
}

function Checkin({ me, draft, setDraft, onSubmit, submitted }) {
  const [type, setType] = useState('project');
  const mine = itemsForUser(me.id);
  const counts = countsByType(me.id);
  const shown = mine.filter((i) => i.type === type);

  return (
    <div className="card">
      <div className="between" style={{ marginBottom: 14 }}>
        <h2>Week of {formatDate(CURRENT_WEEK)}</h2>
        <span className="tiny dim">
          {submitted ? 'Submitted' : 'Saves as you type'}
        </span>
      </div>

      <Segmented
        active={type}
        onChange={setType}
        options={Object.entries(TYPE_LABELS).map(([id, t]) => ({
          id,
          label: t.plural,
          count: counts[id],
        }))}
      />

      <div style={{ marginTop: 16 }}>
        {shown.length === 0 ? (
          <Empty
            title={`No ${TYPE_LABELS[type].plural.toLowerCase()} yet`}
            hint="Add one from My work to include it here."
          />
        ) : (
          <div className="stack" style={{ gap: 20 }}>
            {shown.map((item) => {
              const value = draft[item.id] || { note: '', type_fields: {} };
              const canSetStatus = isLeadOn(me.id, item.id);
              return (
                <div key={item.id}>
                  <div className="between" style={{ marginBottom: 6 }}>
                    <h2>{item.title}</h2>
                    {!canSetStatus ? (
                      <span className="tiny dim">Lead sets status</span>
                    ) : null}
                  </div>
                  <textarea
                    placeholder="What moved forward this week?"
                    aria-label={`Progress on ${item.title}`}
                    value={value.note}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        [item.id]: { ...value, note: e.target.value },
                      })
                    }
                    style={{ marginBottom: 8 }}
                  />
                  <TypeFields
                    item={item}
                    value={value}
                    canSetStatus={canSetStatus}
                    onChange={(v) => setDraft({ ...draft, [item.id]: v })}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {mine.length ? (
        <div
          className="card-divider"
          style={{ display: 'flex', justifyContent: 'flex-end' }}
        >
          <button className="primary" onClick={onSubmit} disabled={submitted}>
            {submitted ? 'Week submitted' : 'Submit week'}
          </button>
        </div>
      ) : null}
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

const NOTIF_TITLE = {
  comment: 'New comment on your work',
  added_to_item: 'You were added to an item',
  checkin_reminder: 'Check-in reminder',
};

function Notifications({ me, read, markRead }) {
  const list = notificationsFor(me.id);
  if (!list.length) {
    return <Empty title="Nothing new" hint="Comments and updates land here." />;
  }
  return (
    <div className="stack" style={{ gap: 10 }}>
      {list.map((n) => {
        const isRead = n.is_read || read.includes(n.id);
        const item =
          n.kind === 'added_to_item'
            ? workItems.find((w) => w.id === n.source_id)
            : null;
        return (
          <div
            key={n.id}
            className={`card${isRead ? ' flat' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => markRead(n.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') markRead(n.id);
            }}
            style={{ cursor: 'pointer' }}
          >
            <div className="between">
              <p className="small">{NOTIF_TITLE[n.kind]}</p>
              {!isRead ? <Pill tone="red">New</Pill> : null}
            </div>
            <p className="small muted" style={{ marginTop: 4 }}>
              {item ? `${item.title} — ` : ''}
              {n.body}
            </p>
            <p className="tiny dim" style={{ marginTop: 6 }}>
              {new Date(n.created_at).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function EmployeeHome({ me, extraTabs = [], renderExtra }) {
  const [tab, setTab] = useState('overview');
  const [draft, setDraft] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [read, setRead] = useState([]);

  const vertical = getVertical(me.vertical_id);
  const manager = getUser(me.reports_to);
  const unread = notificationsFor(me.id).filter(
    (n) => !n.is_read && !read.includes(n.id)
  ).length;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'work', label: 'My work' },
    { id: 'checkin', label: 'Check-in' },
    { id: 'vertical', label: 'My vertical' },
    ...extraTabs,
    { id: 'notifications', label: 'Notifications' },
  ];

  return (
    <>
      <div className="topbar">
        <Avatar user={me} size={40} />
        <div className="grow">
          <h1>{me.full_name}</h1>
          <p className="small muted">
            {vertical ? vertical.name : 'No vertical'}
            {manager ? ` · reports to ${manager.full_name}` : ''}
          </p>
        </div>
        {unread ? <Pill tone="red">{unread} new</Pill> : null}
      </div>

      <Tabs
        tabs={tabs}
        active={tab}
        onChange={setTab}
        badges={{ notifications: unread || undefined }}
      />

      {tab === 'overview' && <Overview me={me} draft={draft} />}
      {tab === 'work' && <MyWork me={me} />}
      {tab === 'checkin' && (
        <Checkin
          me={me}
          draft={draft}
          setDraft={setDraft}
          submitted={submitted}
          onSubmit={() => setSubmitted(true)}
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
      {renderExtra ? renderExtra(tab) : null}
    </>
  );
}
