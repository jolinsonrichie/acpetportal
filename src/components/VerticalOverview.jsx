import { Avatar, Empty, Metric, Pill } from './ui.jsx';
import {
  workItems,
  membersOf,
  membersOfVertical,
  itemsForUser,
  verticalsOf,
  isArchived,
  isCompleted,
  latestContributionsOn,
  formatRelativeTime,
  statusTone,
  contributions,
  isLeadTierRole,
  isOrgWideRole,
  TYPE_LABELS,
  WORK_TYPES,
} from '../data.js';

// One project's activity, from a Lead's vantage point: who's on it, what each
// of them last reported, and how many of them have actually reported in —
// this is deliberately NOT a fabricated "% complete" (this schema has no
// tracked completion measure to derive that from honestly, same reasoning
// as the "Completed" stat elsewhere never claiming "this month"). A
// reporting-rate bar is a real, computable number instead: how many of the
// people on this item have posted an update, full stop.
function ProjectActivityCard({ item, vertical, now, onOpen }) {
  const allMembers = membersOf(item.id);
  const lead = allMembers.find((m) => m.role_on_item === 'lead');
  const contributors = allMembers.filter((m) => m.role_on_item !== 'lead');
  const updatesByUser = new Map(latestContributionsOn(item.id).map((c) => [c.user_id, c]));
  const reportedCount = allMembers.filter((m) => updatesByUser.has(m.user.id)).length;
  const reportPct = allMembers.length ? Math.round((reportedCount / allMembers.length) * 100) : 0;

  return (
    <div className="card">
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2>{item.title}</h2>
          <p className="tiny muted" style={{ marginTop: 2 }}>
            {TYPE_LABELS[item.type].singular} · {vertical.name}
          </p>
        </div>
        <Pill tone={statusTone(item.status)}>{item.status}</Pill>
      </div>

      <p className="small" style={{ marginTop: 10 }}>
        <strong>Lead: </strong>
        {lead ? lead.user.full_name : <span className="danger">Unassigned</span>}
      </p>

      <div className="card-divider stack" style={{ gap: 10 }}>
        <p className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Members working
        </p>
        {contributors.length ? (
          contributors.map((m) => {
            const u = updatesByUser.get(m.user.id);
            return (
              <div className="row" key={m.user.id} style={{ gap: 8, alignItems: 'flex-start' }}>
                <Avatar user={m.user} size={24} />
                <div className="grow">
                  <p className="small" style={{ fontWeight: 600 }}>
                    {m.user.full_name} <span className="tiny muted">· {m.role_on_item}</span>
                  </p>
                  {u ? (
                    <p className="tiny muted">
                      Latest: {u.body} · {formatRelativeTime(u.created_at, now)}
                    </p>
                  ) : (
                    <p className="tiny muted">No updates yet</p>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p className="tiny muted">No contributors assigned yet.</p>
        )}
      </div>

      {allMembers.length ? (
        <div className="card-divider">
          <div className="row" style={{ gap: 10 }}>
            <div className="bar">
              <div style={{ width: `${reportPct}%` }} />
            </div>
            <span className="tiny muted" style={{ whiteSpace: 'nowrap' }}>
              {reportedCount}/{allMembers.length} reporting
            </span>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 10, textAlign: 'right' }}>
        <button className="primary" style={{ fontSize: 13 }} onClick={() => onOpen(item)}>
          Open Project
        </button>
      </div>
    </div>
  );
}

// A plain member's own personal slice — only their own assigned work and
// their own latest update on each, nothing about anyone else. This is what
// keeps "Overview" from leaking teammates' activity to someone who isn't a
// lead: a real member-visible bug, flagged directly ("as a vertical member i
// should not have this view... I should only have what I am doing").
function MyWorkCard({ item, vertical, me, now, onOpen }) {
  const mine = membersOf(item.id).find((m) => m.user.id === me.id);
  const myUpdate = latestContributionsOn(item.id).find((c) => c.user_id === me.id);
  return (
    <div className="card">
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2>{item.title}</h2>
          <p className="tiny muted" style={{ marginTop: 2 }}>
            {TYPE_LABELS[item.type].singular} · {vertical.name} · {mine?.role_on_item ?? 'contributor'}
          </p>
        </div>
        <Pill tone={statusTone(item.status)}>{item.status}</Pill>
      </div>
      <p className="small" style={{ marginTop: 10 }}>
        {myUpdate ? (
          <>
            <strong>Your latest update: </strong>
            {myUpdate.body} · {formatRelativeTime(myUpdate.created_at, now)}
          </>
        ) : (
          'No updates from you yet.'
        )}
      </p>
      <div style={{ marginTop: 10, textAlign: 'right' }}>
        <button className="primary" style={{ fontSize: 13 }} onClick={() => onOpen(item)}>
          Open Project
        </button>
      </div>
    </div>
  );
}

// The Vertical Dashboard's landing tab. Two entirely different views depending
// on who's looking — a real permission split, not a cosmetic one:
// - Lead-tier/org-wide viewers (vertical_lead/co_lead/senior_research_lead/
//   director) get the full team view: a Team Performance Snapshot, then one
//   Project Activity Card per active item showing every assigned member and
//   what each of them last reported.
// - A plain employee gets only their own assigned work and their own latest
//   updates — never a teammate's name, role, or contribution. Overview is a
//   Lead's management tool; a member's own work belongs to them, not on
//   display to whoever else opens this same tab.
export default function VerticalOverview({ vertical, me, onOpenItem }) {
  const now = new Date();
  const canSeeTeam = isLeadTierRole(me.role) || isOrgWideRole(me.role);

  const itemsOfType = (type) =>
    workItems.filter((w) => w.type === type && verticalsOf(w.id).some((v) => v.id === vertical.id) && !isArchived(w));
  const allActiveItems = WORK_TYPES.flatMap(itemsOfType).filter((w) => !isCompleted(w));

  if (!canSeeTeam) {
    const myItems = itemsForUser(me.id).filter(
      (w) => !isArchived(w) && verticalsOf(w.id).some((v) => v.id === vertical.id)
    );
    return (
      <div className="stack" style={{ gap: 20 }}>
        <div className="metrics" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <Metric label="My Assigned Work" value={myItems.length} />
          <Metric
            label="My Updates This Week"
            value={contributions.filter((c) => c.user_id === me.id && now - new Date(c.created_at) < 7 * 86400000).length}
          />
        </div>
        <div>
          <p className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            My work
          </p>
          {myItems.length ? (
            <div className="grid">
              {myItems.map((item) => (
                <MyWorkCard key={item.id} item={item} vertical={vertical} me={me} now={now} onOpen={onOpenItem} />
              ))}
            </div>
          ) : (
            <Empty title="Nothing assigned to you here yet" hint="Check the Projects/Proposals/Papers tabs to log your own work." />
          )}
        </div>
      </div>
    );
  }

  const members = membersOfVertical(vertical.id);
  const activeProjects = itemsOfType('project').filter((w) => !isCompleted(w)).length;
  const pendingTasks = allActiveItems.length;
  const completed = WORK_TYPES.flatMap(itemsOfType).filter(isCompleted).length;
  const updatesThisWeek = contributions.filter(
    (c) =>
      verticalsOf(c.work_item_id).some((v) => v.id === vertical.id) && now - new Date(c.created_at) < 7 * 86400000
  ).length;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="metrics" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <Metric label="Members" value={members.length} />
        <Metric label="Active Projects" value={activeProjects} />
        <Metric label="Updates This Week" value={updatesThisWeek} />
        <Metric label="Pending Tasks" value={pendingTasks} />
        <Metric label="Completed" value={completed} />
      </div>

      <div>
        <p className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Project activity
        </p>
        {allActiveItems.length ? (
          <div className="grid">
            {allActiveItems.map((item) => (
              <ProjectActivityCard key={item.id} item={item} vertical={vertical} now={now} onOpen={onOpenItem} />
            ))}
          </div>
        ) : (
          <Empty title="No active work in this vertical yet" hint="Use the Projects/Proposals/Papers/Blue-sky tabs to add the first one." />
        )}
      </div>
    </div>
  );
}
