import { Pill, Empty } from './ui.jsx';
import { notificationsFor, workItems } from '../data.js';

// Shared by EmployeeHome.jsx and VerticalLeadHome.jsx (hoisted out of
// EmployeeHome 2026-07-31 when the Vertical Lead Portal needed the exact
// same notifications list) — every role reads notificationsFor(me.id) the
// same way, so there's no per-shell variant of this.
const NOTIF_TITLE = {
  comment: 'New comment on your work',
  contribution: "Weekly update on a project you're on",
  added_to_item: 'You were added to an item',
  checkin_reminder: 'Check-in reminder',
  lead_note: 'Message from your lead',
};

// Which notification kinds are tied to a specific work item and should show
// its title as a prefix.
const NOTIF_HAS_ITEM = ['added_to_item', 'comment', 'contribution'];

export default function Notifications({ me, read, markRead }) {
  const list = notificationsFor(me.id);
  if (!list.length) {
    return <Empty title="Nothing new" hint="Comments and updates land here." />;
  }
  return (
    <div className="stack" style={{ gap: 10 }}>
      {list.map((n) => {
        const isRead = n.is_read || read.includes(n.id);
        const item = NOTIF_HAS_ITEM.includes(n.kind)
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
