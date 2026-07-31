import { useState } from 'react';
import { Empty, Avatar } from '../components/ui.jsx';
import { WorkItemCard } from '../components/Team.jsx';
import {
  visibleItems,
  visibleNotes,
  itemsForUser,
  notificationsFor,
  isLeadOn,
  getUser,
  TYPE_LABELS,
  formatDate,
  isOrgWideRole,
  isLeadTierRole,
} from '../data.js';

// Cycled per panel, purely for quick visual scanning — same idiom as
// DirectorHome's VERTICAL_ACCENTS / EmployeeHome's HERO_STAT_ACCENTS.
const PANEL_ACCENTS = ['var(--brand-green-light)', '#5b9bd5', 'var(--brand-amber)', '#8bc34a', 'var(--brand-slate)'];

function NoteRow({ note }) {
  const author = getUser(note.author_id);
  return (
    <div className="news-item">
      {author ? <Avatar user={author} size={26} /> : <span className="news-dot" />}
      <div className="grow">
        <p className="small">{author?.full_name ?? 'Unknown'}</p>
        <p className="small muted" style={{ marginTop: 2 }}>
          {note.body}
        </p>
      </div>
    </div>
  );
}

function AllPersonal({ me, items, leadTier, onItemsChanged }) {
  const [typeFilter, setTypeFilter] = useState('all');
  // A deliberate, isolated exception to "never a live clock" (same category
  // as formatRelativeTime/isFridayReminderWindow) — a calendar showing
  // today's date is meaningless if it's frozen to the mock's fixed
  // CURRENT_WEEK constant, which is exactly the bug this replaces: it read
  // as a stale/wrong date instead of the real one.
  const today = new Date();
  const myItemIds = new Set(itemsForUser(me.id).map((i) => i.id));
  const recentNotifs = notificationsFor(me.id).slice(0, 3);
  const upcoming = [...items]
    .filter((i) => i.target_date)
    .sort((a, b) => (a.target_date < b.target_date ? -1 : 1))
    .slice(0, 4);
  const heading = leadTier ? 'Team work' : 'My work';
  const shownItems = typeFilter === 'all' ? items : items.filter((i) => i.type === typeFilter);

  return (
    <div className="hub-widgets">
      <div className="hub-panel">
        <div className="hub-section-title">
          <span className="bar" />
          <h2>{heading}</h2>
        </div>
        {/* Sub-tabs by type so a long mixed list of projects/papers/proposals/
            blue-sky ideas can be narrowed down — the same place Edit/Delete
            live on each WorkItemCard, so fixing a mistake is find-then-fix
            in one spot rather than hunting through everything. */}
        <div className="segmented" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
          <button aria-pressed={typeFilter === 'all'} style={{ fontSize: 13 }} onClick={() => setTypeFilter('all')}>
            All
          </button>
          {Object.entries(TYPE_LABELS).map(([type, t]) => (
            <button
              key={type}
              aria-pressed={typeFilter === type}
              style={{ fontSize: 13 }}
              onClick={() => setTypeFilter(type)}
            >
              {t.plural}
            </button>
          ))}
        </div>
        {shownItems.length ? (
          <div className="stack" style={{ gap: 10 }}>
            {shownItems.map((item) => (
              <WorkItemCard
                key={item.id}
                item={item}
                me={me}
                onChanged={onItemsChanged}
                footerNote={
                  myItemIds.has(item.id)
                    ? `${TYPE_LABELS[item.type].singular} · you are ${
                        isLeadOn(me.id, item.id) ? 'lead' : 'contributor'
                      }`
                    : undefined
                }
              />
            ))}
          </div>
        ) : (
          <Empty
            title={items.length ? 'Nothing of this type yet' : 'Nothing assigned yet'}
            hint={leadTier ? "Work items your team is on appear here." : "Work items you're on appear here."}
          />
        )}
      </div>

      <div className="hub-panel">
        <div className="hub-section-title">
          <span className="bar" />
          <h2>Notifications</h2>
        </div>
        {recentNotifs.length ? (
          <div>
            {recentNotifs.map((n) => (
              <div className="news-item" key={n.id}>
                <span className="news-dot" />
                <div className="grow">
                  <p className="small">{n.body}</p>
                  <p className="tiny dim" style={{ marginTop: 2 }}>
                    {new Date(n.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="Nothing new" />
        )}
      </div>

      <div className="hub-panel">
        <div className="hub-section-title">
          <span className="bar" />
          <h2>Calendar</h2>
        </div>
        <p className="small muted">Today</p>
        <p className="metric-value" style={{ marginTop: 2 }}>
          {today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
        </p>

        {upcoming.length ? (
          <div className="card-divider stack" style={{ gap: 10 }}>
            <p className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Upcoming
            </p>
            {upcoming.map((item) => (
              <div className="between" key={item.id}>
                <span className="small">{item.title}</span>
                <span className="tiny dim">{formatDate(item.target_date)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AllOrgWide({ me, items, notes, onItemsChanged }) {
  const panels = [
    ...Object.entries(TYPE_LABELS).map(([type, t]) => ({
      id: type,
      label: t.plural,
      list: items.filter((i) => i.type === type),
      render: (item) => (
        <WorkItemCard key={item.id} item={item} me={me} onChanged={onItemsChanged} />
      ),
    })),
    {
      id: 'growth',
      label: 'Growth',
      list: notes,
      render: (n) => <NoteRow key={n.id} note={n} />,
    },
  ];

  return (
    <div className="grid">
      {panels.map((p, i) => (
        <div
          className="hub-panel"
          key={p.id}
          style={{ borderTopColor: PANEL_ACCENTS[i % PANEL_ACCENTS.length] }}
        >
          <div className="hub-section-title">
            <span className="bar" />
            <h2>{p.label}</h2>
          </div>
          {p.list.length ? (
            <div className="stack" style={{ gap: 10 }}>
              {p.list.slice(0, 3).map(p.render)}
            </div>
          ) : (
            <Empty title="Nothing yet" />
          )}
        </div>
      ))}
    </div>
  );
}

export default function Overview({ me, onItemsChanged }) {
  const orgWide = isOrgWideRole(me.role);
  const leadTier = isLeadTierRole(me.role);

  const items = visibleItems(me);
  const notes = visibleNotes(me);

  return orgWide ? (
    <AllOrgWide me={me} items={items} notes={notes} onItemsChanged={onItemsChanged} />
  ) : (
    <AllPersonal me={me} items={items} leadTier={leadTier} onItemsChanged={onItemsChanged} />
  );
}
