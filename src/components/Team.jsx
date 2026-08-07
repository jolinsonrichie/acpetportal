import { useState } from 'react';
import { Avatar, AvatarStack, Pill, Empty, BudgetBar, ActionMenu } from './ui.jsx';
import {
  membersOf,
  verticalsOf,
  workItems,
  formatDate,
  formatRelativeTime,
  formatLakh,
  statusTone,
  countsByType,
  formatCounts,
  currentFocus,
  filedThisWeek,
  daysSinceCheckin,
  itemsForUser,
  assignWorkItem,
  assignableUsersFor,
  commentsOn,
  addItemComment,
  updateComment,
  deleteComment,
  updateMemberDeadline,
  latestContributionsOn,
  addContribution,
  updateContribution,
  deleteContribution,
  latestProgressLogOn,
  addProgressUpdate,
  notifyMembers,
  deleteWorkItem,
  updateWorkItem,
  archiveWorkItem,
  isArchived,
  timelineOf,
  getUser,
  TYPE_LABELS,
  STATUS_OPTIONS,
  ROLE_LABEL,
  ROLE_TONE,
  TEAM_TYPE_META,
  canSeeBudget,
  isOrgWideRole,
  isLeadTierRole,
  canActOnItem,
} from '../data.js';

// A mistake-fixing form for the item's own fields — not a re-categorization
// (type is fixed; if the type itself is wrong, delete and re-add instead).
function EditItemForm({ item, onSave, onCancel }) {
  const [title, setTitle] = useState(item.title);
  const [status, setStatus] = useState(item.status);
  const [targetDate, setTargetDate] = useState(item.target_date ?? '');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        status,
        target_date: targetDate || null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card-divider stack" style={{ gap: 8 }} onSubmit={submit}>
      <label className="tiny muted" htmlFor={`edit-title-${item.id}`}>
        Title
      </label>
      <input id={`edit-title-${item.id}`} value={title} onChange={(e) => setTitle(e.target.value)} />

      <label className="tiny muted" htmlFor={`edit-status-${item.id}`}>
        Status
      </label>
      <select id={`edit-status-${item.id}`} value={status} onChange={(e) => setStatus(e.target.value)}>
        {STATUS_OPTIONS[item.type].map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <label className="tiny muted" htmlFor={`edit-date-${item.id}`}>
        Target date
      </label>
      <input
        id={`edit-date-${item.id}`}
        type="date"
        value={targetDate ?? ''}
        onChange={(e) => setTargetDate(e.target.value)}
      />

      <div className="row" style={{ gap: 8, marginTop: 4 }}>
        <button type="submit" className="primary" style={{ fontSize: 13 }} disabled={saving || !title.trim()}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" className="quiet" style={{ fontSize: 13 }} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function AssignPicker({ me, item, existingMemberIds, onDone }) {
  const candidates = assignableUsersFor(me).filter((u) => !existingMemberIds.has(u.id));
  const [userId, setUserId] = useState(candidates[0]?.id ?? '');
  const [role, setRole] = useState('contributor');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!candidates.length) {
    return (
      <p className="tiny muted" style={{ marginTop: 8 }}>
        Everyone you can assign is already on this item.
      </p>
    );
  }

  async function confirm() {
    setSaving(true);
    setError('');
    try {
      await assignWorkItem({ work_item_id: item.id, user_id: userId, role_on_item: role }, me.id);
      onDone();
    } catch (err) {
      setError(err.message || 'Could not assign — try again.');
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <select aria-label="Person to assign" value={userId} disabled={saving} onChange={(e) => setUserId(e.target.value)}>
          {candidates.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
            </option>
          ))}
        </select>
        <select aria-label="Role on item" value={role} disabled={saving} onChange={(e) => setRole(e.target.value)}>
          <option value="contributor">Contributor</option>
          <option value="lead">Lead</option>
        </select>
        <button className="primary" style={{ fontSize: 13 }} disabled={saving} onClick={confirm}>
          {saving ? 'Assigning…' : 'Assign'}
        </button>
      </div>
      {error ? (
        <p className="tiny danger" style={{ marginTop: 6 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

// A member logging their own "what I'm working on this week" note on a
// shared project — kept separate per person (see addContribution in
// data.js) rather than one shared field, so several contributors don't
// overwrite each other.
//
// Every entry always shows who posted it, their role on this item, and when
// — never just bare text — per explicit direction that an update should
// never appear without clearly indicating its author.
// Turns a single comment/contribution's own body into something its author
// (and, for delete, a director) can fix or remove after the fact — the
// explicit ask was edit AND delete "for everything whenever people enter
// the detail," and until now a typo or a wrong entry was permanent. Shared
// by ContributionsPanel and CommentThread below since both need the exact
// same "text, or an editable field with Save/Cancel, plus a Delete action"
// shape; each caller still renders its own author/role/timestamp meta line.
function EditableBody({ text, canEdit, canDelete, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!draft.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onSave(draft.trim());
      setEditing(false);
    } catch (err) {
      setError(err.message || 'Could not save — try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError('');
    try {
      await onDelete();
    } catch (err) {
      setError(err.message || 'Could not delete — try again.');
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="stack" style={{ gap: 6 }}>
        <input aria-label="Edit" value={draft} disabled={busy} onChange={(e) => setDraft(e.target.value)} />
        {error ? <p className="tiny danger">{error}</p> : null}
        <div className="row" style={{ gap: 10 }}>
          <button
            type="button"
            className="primary"
            style={{ fontSize: 13 }}
            disabled={busy || !draft.trim()}
            onClick={save}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="quiet"
            style={{ fontSize: 13 }}
            disabled={busy}
            onClick={() => {
              setEditing(false);
              setDraft(text);
              setError('');
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="small">{text}</p>
      {canEdit || canDelete ? (
        <div className="row" style={{ gap: 10, marginTop: 2 }}>
          {canEdit ? (
            <button type="button" className="quiet" style={{ fontSize: 12, padding: 0 }} onClick={() => setEditing(true)}>
              Edit
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              className="quiet"
              style={{ fontSize: 12, padding: 0, color: 'var(--red-fg)' }}
              disabled={busy}
              onClick={remove}
            >
              {busy ? 'Deleting…' : 'Delete'}
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="tiny danger">{error}</p> : null}
    </div>
  );
}

function ContributionsPanel({ me, item, onChanged }) {
  const now = new Date();
  const rows = latestContributionsOn(item.id);
  const roleById = new Map(membersOf(item.id).map((m) => [m.user.id, m.role_on_item]));
  const isMember = roleById.has(me?.id);
  const mine = rows.find((c) => c.user_id === me?.id);
  const others = rows.filter((c) => c.user_id !== me?.id);
  const [draft, setDraft] = useState(mine?.body ?? '');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await addContribution({ work_item_id: item.id, body: draft.trim() }, me.id);
      onChanged?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card-divider stack" style={{ gap: 10 }}>
      {mine || others.length ? (
        <div className="stack" style={{ gap: 8 }}>
          {mine ? (
            <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
              <Avatar user={mine.user} size={22} />
              <div className="grow">
                <p className="tiny muted">
                  {mine.user.full_name} · you · {roleById.get(mine.user_id)} · {formatRelativeTime(mine.created_at, now)}
                </p>
                <EditableBody
                  text={mine.body}
                  canEdit
                  canDelete
                  onSave={async (body) => {
                    await updateContribution(mine.id, body);
                    onChanged?.();
                  }}
                  onDelete={async () => {
                    await deleteContribution(mine.id);
                    onChanged?.();
                  }}
                />
              </div>
            </div>
          ) : null}
          {others.map((c) => (
            <div className="row" key={c.user_id} style={{ gap: 8, alignItems: 'flex-start' }}>
              <Avatar user={c.user} size={22} />
              <div className="grow">
                <p className="tiny muted">
                  {c.user.full_name} · {roleById.get(c.user_id)} · {formatRelativeTime(c.created_at, now)}
                </p>
                <EditableBody
                  text={c.body}
                  canDelete={me?.role === 'director'}
                  onDelete={async () => {
                    await deleteContribution(c.id);
                    onChanged?.();
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="tiny muted">No updates yet.</p>
      )}
      {isMember ? (
        <form className="row" style={{ gap: 8 }} onSubmit={submit}>
          <input
            aria-label="Your update this week"
            className="grow"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What are you working on this week?"
          />
          <button type="submit" className="primary" style={{ fontSize: 13 }} disabled={saving || !draft.trim()}>
            {mine ? 'Update' : 'Post'}
          </button>
        </form>
      ) : null}
    </div>
  );
}

// A per-item comment thread, not scoped by the commenter's own vertical —
// whoever can already see this card (i.e. it rendered at all) can read and
// add to it, since a shared project may have contributors from several
// verticals each leaving their own running updates.
function CommentThread({ me, item, onChanged }) {
  const now = new Date();
  const thread = commentsOn(item.id);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    try {
      // Also notifies every other member on this item — see
      // addItemComment's own comment in data.js for why this is a wrapper,
      // not a duplicate.
      await addItemComment({ body: body.trim(), work_item_id: item.id }, me.id);
      setBody('');
      onChanged?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card-divider stack" style={{ gap: 10 }}>
      {thread.length ? (
        <div className="stack" style={{ gap: 8 }}>
          {thread.map((c) => {
            const author = getUser(c.author_id);
            const isMine = me?.id === c.author_id;
            return (
              <div className="row" key={c.id} style={{ gap: 8, alignItems: 'flex-start' }}>
                {author ? <Avatar user={author} size={22} /> : null}
                <div className="grow">
                  <p className="tiny muted">
                    {author?.full_name ?? 'Unknown'} · {formatRelativeTime(c.created_at, now)}
                  </p>
                  <EditableBody
                    text={c.body}
                    canEdit={isMine}
                    canDelete={isMine || me?.role === 'director'}
                    onSave={async (body) => {
                      await updateComment(c.id, body);
                      onChanged?.();
                    }}
                    onDelete={async () => {
                      await deleteComment(c.id);
                      onChanged?.();
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="tiny muted">No comments yet.</p>
      )}
      {me && canActOnItem(me, item) ? (
        <form className="row" style={{ gap: 8 }} onSubmit={submit}>
          <input
            aria-label="Add a comment"
            className="grow"
            value={body}
            disabled={saving}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add an update or comment…"
          />
          <button type="submit" className="primary" style={{ fontSize: 13 }} disabled={saving || !body.trim()}>
            {saving ? 'Posting…' : 'Post'}
          </button>
        </form>
      ) : null}
    </div>
  );
}

// "Today" / "Yesterday" / weekday name / plain date — day-bucket label for
// grouping the timeline below, not a per-row timestamp (formatRelativeTime
// already covers that elsewhere; this is specifically the calendar-day
// header the grouped timeline is organized under).
function dayLabel(iso, now) {
  const startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const diffDays = Math.round((startOfDay(now) - startOfDay(iso)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return new Date(iso).toLocaleDateString('en-IN', { weekday: 'long' });
  return formatDate(iso);
}

// A chronological history — created, later member additions, comments, and
// weekly updates, merged, grouped by day (most recent first), and under each
// day grouped again by who actually did it — a real audit trail, per
// explicit direction that the timeline should read "day → contributor →
// what they did," not one flat undifferentiated list. (See timelineOf's own
// comment in data.js for why status changes aren't part of this: the schema
// only ever stores an item's current status, not a timestamped log of past
// ones.)
function TimelineList({ item }) {
  const now = new Date();
  const events = [...timelineOf(item.id)].reverse();
  if (!events.length) return <p className="tiny muted">Nothing recorded yet.</p>;

  function actorOf(e) {
    return e.kind === 'assigned' ? e.by ?? e.user : e.user;
  }

  function actionOf(e) {
    switch (e.kind) {
      case 'created':
        return `Created this${e.role ? ` (as ${e.role})` : ''}${e.responsibility ? ` — ${e.responsibility}` : ''}.`;
      case 'assigned':
        return `Added ${e.user.full_name} as ${e.role}${e.responsibility ? ` — ${e.responsibility}` : ''}.`;
      case 'comment':
        return `Commented: "${e.body}"`;
      case 'update':
        return `Posted an update: "${e.body}"`;
      default:
        return '';
    }
  }

  // Bucket consecutive events (already sorted, most-recent-first) under one
  // day header each, instead of repeating the date on every single row.
  const groups = [];
  for (const e of events) {
    const label = dayLabel(e.at, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.events.push(e);
    else groups.push({ label, events: [e] });
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      {groups.map((g) => (
        <div key={g.label}>
          <p className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            {g.label}
          </p>
          <div className="stack" style={{ gap: 10 }}>
            {g.events.map((e, i) => (
              <div className="timeline-row" key={i}>
                <span className="timeline-dot" />
                <div className="grow">
                  <p className="small" style={{ fontWeight: 600 }}>
                    {actorOf(e)?.full_name ?? 'Someone'}
                  </p>
                  <p className="tiny muted">{actionOf(e)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// A member's own deadline for their piece of this item — editable only by
// that person (members_update_own, migration 0013), read-only text for
// anyone else viewing the Team panel. Distinct from the item's own overall
// target_date shown in the card footer below.
function MemberDeadlineField({ item, member, me, onChanged }) {
  const isMine = me?.id === member.user.id;
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(member.target_date ?? '');
  const [saving, setSaving] = useState(false);

  if (!isMine) {
    return member.target_date ? <p className="tiny muted">Their deadline: {formatDate(member.target_date)}</p> : null;
  }

  async function save() {
    setSaving(true);
    try {
      await updateMemberDeadline(item.id, member.user.id, date || null);
      onChanged?.();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="row" style={{ gap: 6, marginTop: 2 }}>
        <input type="date" value={date ?? ''} disabled={saving} onChange={(e) => setDate(e.target.value)} />
        <button type="button" className="quiet" style={{ fontSize: 12 }} disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          className="quiet"
          style={{ fontSize: 12 }}
          disabled={saving}
          onClick={() => {
            setEditing(false);
            setDate(member.target_date ?? '');
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <p className="tiny muted">
      {member.target_date ? `Your deadline: ${formatDate(member.target_date)}` : 'No deadline set for your part yet'}{' '}
      <button type="button" className="quiet" style={{ fontSize: 11, padding: 0 }} onClick={() => setEditing(true)}>
        {member.target_date ? 'Change' : 'Set'}
      </button>
    </p>
  );
}

// Re-designates an existing member's role — "set someone else as the
// [project/proposal/paper] lead" without needing to remove and re-add them.
// Reuses assignWorkItem wholesale (its on-conflict upsert already handles
// changing role_on_item for a pair that's already a member, this just
// exposes that from the UI for the first time) — gated by canManage, same
// as Edit/Delete/Archive, so only the current lead(s) or a director can
// reassign leadership, not any contributor promoting themselves.
function RoleToggle({ item, member, me, onChanged }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const nextRole = member.role_on_item === 'lead' ? 'contributor' : 'lead';

  async function toggle() {
    setSaving(true);
    setError('');
    try {
      await assignWorkItem(
        { work_item_id: item.id, user_id: member.user.id, role_on_item: nextRole, responsibility: member.responsibility },
        me.id
      );
      onChanged?.();
    } catch (err) {
      setError(err.message || 'Could not change role — try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ textAlign: 'right' }}>
      <button type="button" className="quiet" style={{ fontSize: 12 }} disabled={saving} onClick={toggle}>
        {saving ? 'Saving…' : nextRole === 'lead' ? 'Make Lead' : 'Make Contributor'}
      </button>
      {error ? <p className="tiny danger">{error}</p> : null}
    </div>
  );
}

// The item's dynamic Progress/Planned history (migration 0015, replacing
// the old single overwritten-in-place progress_note/plan_note columns).
// Always shows the latest entry — same visual spot the old static text
// occupied — plus, for whoever can manage the item, a "Log update" action
// that surfaces above blank fields rather than pre-filling them: the point
// is seeing last time's entry before writing a new one, not editing it.
function ProgressLogSection({ item, me, canManage, onChanged }) {
  const latest = latestProgressLogOn(item.id);
  const [logging, setLogging] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [planText, setPlanText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!progressText.trim() && !planText.trim()) return;
    setSaving(true);
    setError('');
    try {
      await addProgressUpdate(
        {
          work_item_id: item.id,
          progress_text: progressText.trim(),
          plan_text: planText.trim(),
          plan_due_date: dueDate || null,
        },
        me.id
      );
      setProgressText('');
      setPlanText('');
      setDueDate('');
      setLogging(false);
      onChanged?.();
    } catch (err) {
      setError(err.message || 'Could not save — try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!latest && !canManage) return null;

  return (
    <div className="stack" style={{ gap: 8, marginTop: 10 }}>
      {latest ? (
        <div className="stack" style={{ gap: 4 }}>
          {latest.progress_text ? (
            <p className="small">
              <strong>Progress: </strong>
              {latest.progress_text}
            </p>
          ) : null}
          {latest.plan_text ? (
            <p className="small">
              <strong>Planned: </strong>
              {latest.plan_text}
              {latest.plan_due_date ? ` · Due ${formatDate(latest.plan_due_date)}` : ''}
            </p>
          ) : null}
          <p className="tiny dim">
            Logged by {getUser(latest.created_by)?.full_name ?? 'someone'} ·{' '}
            {formatRelativeTime(latest.created_at, new Date())}
          </p>
        </div>
      ) : null}

      {canManage ? (
        logging ? (
          <form className="card-divider stack" style={{ gap: 8 }} onSubmit={submit}>
            <label className="tiny muted" htmlFor={`log-progress-${item.id}`}>
              What work has been going on
            </label>
            <textarea
              id={`log-progress-${item.id}`}
              value={progressText}
              onChange={(e) => setProgressText(e.target.value)}
              placeholder="Since the last update…"
            />

            <label className="tiny muted" htmlFor={`log-plan-${item.id}`}>
              What's planned next
            </label>
            <textarea id={`log-plan-${item.id}`} value={planText} onChange={(e) => setPlanText(e.target.value)} />

            <label className="tiny muted" htmlFor={`log-due-${item.id}`}>
              Due by
            </label>
            <input
              id={`log-due-${item.id}`}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />

            {error ? <p className="tiny danger">{error}</p> : null}

            <div className="row" style={{ gap: 8 }}>
              <button
                type="submit"
                className="primary"
                style={{ fontSize: 13 }}
                disabled={saving || (!progressText.trim() && !planText.trim())}
              >
                {saving ? 'Saving…' : 'Save update'}
              </button>
              <button
                type="button"
                className="quiet"
                style={{ fontSize: 13 }}
                disabled={saving}
                onClick={() => setLogging(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="quiet" style={{ fontSize: 13 }} onClick={() => setLogging(true)}>
            Log update
          </button>
        )
      ) : null}
    </div>
  );
}

export function WorkItemCard({
  item,
  me,
  showBudget = false,
  footerNote,
  onChanged,
  // prominentAssign/defaultShowContribs/youreOnThis: used by the Work
  // workspace's detail drawer (see WorkWorkspace.jsx) to surface Assign as a
  // primary action and per-person updates immediately, rather than behind
  // the same quiet toggles this card uses everywhere else (Overview, Team,
  // Employees) — those callers are unaffected since all three default off.
  prominentAssign = false,
  defaultShowContribs = false,
  youreOnThis = false,
}) {
  const mem = membersOf(item.id);
  const verticals = new Set(mem.map((m) => m.user.vertical_id));
  const owningVerticals = verticalsOf(item.id);
  const canAssign =
    me && (isOrgWideRole(me.role) || isLeadTierRole(me.role)) && canActOnItem(me, item);
  // Open to any current member, not just Lead/creator — direct instruction
  // (migration 0016): whoever entered something and made a mistake, or
  // anyone on the item who needs to correct/rewrite/remove it, should be
  // able to, not just whoever happens to be Lead or the original creator.
  // Mirrors the real work_items_update/_delete RLS policies exactly as of
  // 0016 — created_by, is_my_item() (any member), or director.
  const isMember = me && mem.some((m) => m.user.id === me.id);
  const canManage = me && (isMember || item.created_by === me.id || me.role === 'director');
  const archived = isArchived(item);
  const [assigning, setAssigning] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showContribs, setShowContribs] = useState(defaultShowContribs);
  const [showTimeline, setShowTimeline] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  // Surfaced rather than swallowed — this exact class of gap (a real write
  // failing with no on-screen feedback) is what made section 55's schema bug
  // hard to notice in an earlier pass of this project; not repeating it here.
  const [actionError, setActionError] = useState('');

  async function handleDelete() {
    setDeleting(true);
    setActionError('');
    try {
      await deleteWorkItem(item.id);
      onChanged?.();
    } catch (err) {
      setActionError(err.message || 'Could not delete — try again.');
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  async function handleArchiveToggle() {
    setArchiving(true);
    setActionError('');
    try {
      await archiveWorkItem(item.id, !archived);
      onChanged?.();
    } catch (err) {
      setActionError(err.message || 'Could not save — try again.');
    } finally {
      setArchiving(false);
    }
  }

  async function handleEditSave(fields) {
    await updateWorkItem(item.id, fields);
    setEditing(false);
    onChanged?.();
  }
  const commentCount = commentsOn(item.id).length;
  const contribCount = latestContributionsOn(item.id).length;

  return (
    <div className="card">
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <h2>{item.title}</h2>
          <p className="tiny muted" style={{ marginTop: 2 }}>
            {footerNote ??
              `${TYPE_LABELS[item.type].singular} · ${
                owningVerticals.length
                  ? owningVerticals.map((v) => v.name).join(' + ')
                  : '—'
              }`}
          </p>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {youreOnThis ? <Pill tone="green">You're on this</Pill> : null}
          {archived ? <Pill tone="amber">Archived</Pill> : null}
          <Pill tone={statusTone(item.status)}>{item.status}</Pill>
        </div>
      </div>

      {showBudget && item.budget_total > 0 ? (
        <div style={{ marginTop: 12 }}>
          <BudgetBar spent={item.budget_spent} total={item.budget_total} />
          <p className="tiny muted" style={{ marginTop: 4 }}>
            {formatLakh(item.budget_spent)} of {formatLakh(item.budget_total)}{' '}
            spent
          </p>
        </div>
      ) : null}

      {item.description ? (
        <p className="small" style={{ marginTop: 10 }}>
          {item.description}
        </p>
      ) : null}

      <ProgressLogSection item={item} me={me} canManage={canManage} onChanged={onChanged} />

      <div className="card-divider row">
        <AvatarStack users={mem.map((m) => m.user)} size={22} />
        <span className="tiny muted">
          {mem.length} {mem.length === 1 ? 'person' : 'people'}
          {verticals.size > 1 ? ` · ${verticals.size} verticals` : ''}
        </span>
        <span className="grow" />
        {me && mem.length ? (
          <button
            className="quiet"
            style={{ fontSize: 13, marginRight: 8 }}
            onClick={() => setShowTeam((s) => !s)}
          >
            {showTeam ? 'Hide team' : 'Team'}
          </button>
        ) : null}
        {me ? (
          <button
            className="quiet"
            style={{ fontSize: 13, marginRight: 8 }}
            onClick={() => setShowContribs((s) => !s)}
          >
            {showContribs ? 'Hide updates' : `Updates${contribCount ? ` (${contribCount})` : ''}`}
          </button>
        ) : null}
        {me ? (
          <button
            className="quiet"
            style={{ fontSize: 13, marginRight: 8 }}
            onClick={() => setShowComments((s) => !s)}
          >
            {showComments ? 'Hide comments' : `Comments${commentCount ? ` (${commentCount})` : ''}`}
          </button>
        ) : null}
        {me ? (
          <button
            className="quiet"
            style={{ fontSize: 13, marginRight: 8 }}
            onClick={() => setShowTimeline((s) => !s)}
          >
            {showTimeline ? 'Hide timeline' : 'Timeline'}
          </button>
        ) : null}
        {canAssign ? (
          <button
            className={prominentAssign ? 'primary' : 'quiet'}
            style={{ fontSize: 13, marginRight: 8 }}
            onClick={() => setAssigning((a) => !a)}
          >
            {assigning ? 'Cancel' : 'Assign'}
          </button>
        ) : null}
        {canManage && !confirmingDelete ? (
          <ActionMenu label="Item actions">
            <button type="button" className="action-menu-item" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button type="button" className="action-menu-item" disabled={archiving} onClick={handleArchiveToggle}>
              {archiving ? 'Saving…' : archived ? 'Unarchive' : 'Archive'}
            </button>
            <button
              type="button"
              className="action-menu-item danger"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </button>
          </ActionMenu>
        ) : null}
        {confirmingDelete ? (
          <span className="row" style={{ gap: 6, marginRight: 8 }}>
            <span className="tiny" style={{ color: 'var(--red-fg)' }}>
              Delete this item? This can't be undone.
            </span>
            <button
              className="quiet"
              style={{ fontSize: 13, color: 'var(--red-fg)' }}
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button className="quiet" style={{ fontSize: 13 }} onClick={() => setConfirmingDelete(false)}>
              Cancel
            </button>
          </span>
        ) : null}
        <span className="tiny muted">
          Due {formatDate(item.target_date)}
        </span>
      </div>

      {actionError ? (
        <p className="tiny danger" style={{ marginTop: 6 }}>
          {actionError}
        </p>
      ) : null}

      {editing ? (
        <EditItemForm item={item} onSave={handleEditSave} onCancel={() => setEditing(false)} />
      ) : null}

      {assigning ? (
        <AssignPicker
          me={me}
          item={item}
          existingMemberIds={new Set(mem.map((m) => m.user.id))}
          onDone={() => {
            setAssigning(false);
            onChanged?.();
          }}
        />
      ) : null}

      {showTeam ? (
        <div className="card-divider stack" style={{ gap: 8 }}>
          {mem.map((m) => (
            <div className="row" key={m.user.id} style={{ gap: 8, alignItems: 'flex-start' }}>
              <Avatar user={m.user} size={22} />
              <div className="grow">
                <p className="small" style={{ fontWeight: 600 }}>
                  {m.user.full_name} <span className="tiny muted">· {m.role_on_item}</span>
                </p>
                {m.responsibility ? <p className="tiny muted">{m.responsibility}</p> : null}
                <MemberDeadlineField item={item} member={m} me={me} onChanged={onChanged} />
              </div>
              {canManage ? <RoleToggle item={item} member={m} me={me} onChanged={onChanged} /> : null}
            </div>
          ))}
        </div>
      ) : null}

      {showContribs ? <ContributionsPanel me={me} item={item} onChanged={onChanged} /> : null}

      {showComments ? <CommentThread me={me} item={item} onChanged={onChanged} /> : null}

      {showTimeline ? (
        <div className="card-divider">
          <TimelineList item={item} />
        </div>
      ) : null}
    </div>
  );
}

export function CheckinFlag({ userId }) {
  const filed = filedThisWeek(userId);
  const days = daysSinceCheckin(userId);
  return (
    <span className={`tiny ${filed ? 'ok' : 'danger'}`}>
      {filed ? 'Filed this week' : 'No check-in'}
      {days !== null ? (
        <span className="dim"> · {days === 0 ? 'today' : `${days}d ago`}</span>
      ) : null}
    </span>
  );
}

export function PersonCard({ person, onOpen, expanded = false }) {
  const counts = countsByType(person.id);
  return (
    <div
      className="card"
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(person)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.(person);
        }
      }}
      style={{ cursor: onOpen ? 'pointer' : 'default' }}
    >
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div className="row">
          <Avatar user={person} size={36} />
          <div className="grow">
            <h2>{person.full_name}</h2>
            <p className="tiny muted">{person.job_title}</p>
          </div>
        </div>
        {person.role !== 'employee' ? (
          <Pill tone={ROLE_TONE[person.role]}>{ROLE_LABEL[person.role]}</Pill>
        ) : null}
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        {currentFocus(person.id)}
      </p>
      <div className="row" style={{ gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
        {Object.entries(counts)
          .filter(([, n]) => n > 0)
          .map(([type, n]) => (
            <Pill key={type} tone={TYPE_LABELS[type].tone}>
              {n} {TYPE_LABELS[type].singular}
              {n > 1 ? 's' : ''}
            </Pill>
          ))}
        {Object.values(counts).every((n) => n === 0) ? (
          <Pill>No items</Pill>
        ) : null}
      </div>
      <div className="card-divider between">
        <CheckinFlag userId={person.id} />
        {onOpen ? (
          <span className="tiny muted">{expanded ? 'Hide work items ↑' : 'View work items ↓'}</span>
        ) : null}
      </div>
    </div>
  );
}

// A vertical/co-lead broadcasting an update to their own team — separate
// from per-item comments (CommentThread above): this isn't tied to any one
// work item, it's a plain note that shows up in the recipient's
// Notifications tab. Only rendered for lead-tier viewers (see TeamView).
export function NotifyForm({
  me,
  people,
  onSent,
  heading = 'Send an update to your vertical',
  everyoneLabel = 'Everyone in this vertical',
}) {
  const [recipient, setRecipient] = useState('all');
  const [body, setBody] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function send(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      const recipientIds = recipient === 'all' ? people.map((p) => p.id) : [recipient];
      await notifyMembers({ recipientIds, body: body.trim() }, me.id);
      setBody('');
      setSent(true);
      setTimeout(() => setSent(false), 1600);
      onSent?.();
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="card" style={{ marginBottom: 16 }} onSubmit={send}>
      <h2>{heading}</h2>
      <p className="tiny muted" style={{ marginTop: 2 }}>
        Shows up in the recipient's Notifications tab.
      </p>
      <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <select aria-label="Recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)}>
          <option value="all">{everyoneLabel}</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>
      </div>
      <textarea
        style={{ marginTop: 10 }}
        placeholder='e.g. "Do this way and show me on Wednesday."'
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="row" style={{ marginTop: 10, gap: 10 }}>
        <button type="submit" className="primary" disabled={sending || !body.trim()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
        {sent ? <span className="tiny ok">Sent</span> : null}
      </div>
    </form>
  );
}

// Cycled per vertical, in order, purely for quick visual scanning — not
// semantically tied to any particular vertical. Was previously private to
// DirectorHome.jsx; hoisted here alongside VerticalGroup (2026-07-31) so the
// new Vertical Lead Portal (VerticalLeadHome.jsx) can render the exact same
// per-vertical drill-down DirectorHome already uses, just scoped to fewer
// verticals.
export const VERTICAL_ACCENTS = [
  'var(--brand-green-light)',
  '#5b9bd5',
  'var(--brand-amber)',
  'var(--brand-slate)',
  'var(--brand-panel-2)',
];

// A single vertical's roster + active projects — the Director's "Employees"
// tab and the Vertical Lead Portal's "Vertical members" tab are both just
// this component looped over a different (broader vs. narrower) set of
// verticals, so it lives here rather than duplicated in both screens.
export function VerticalGroup({ vertical, people, view, accent, me, onChanged }) {
  const isUnassignedGroup = vertical.id === 'none';
  const lead = getUser(vertical.lead_id);
  const coLead = people.find((p) => p.role === 'co_lead');
  const items = workItems.filter((w) =>
    verticalsOf(w.id).some((v) => v.id === vertical.id)
  );
  const filed = people.filter((p) => filedThisWeek(p.id)).length;
  const typeMeta = TEAM_TYPE_META[vertical.type];
  const [expandedId, setExpandedId] = useState(null);

  function toggleExpand(person) {
    setExpandedId((cur) => (cur === person.id ? null : person.id));
  }

  return (
    <div>
      <div className="vertical-group-header" style={{ borderLeftColor: accent }}>
        <div className="row" style={{ gap: 8 }}>
          <h2>{vertical.name}</h2>
          {typeMeta ? <Pill tone={typeMeta.tone}>{typeMeta.label}</Pill> : null}
        </div>
        <p className="tiny muted" style={{ marginTop: 3 }}>
          {isUnassignedGroup ? null : (
            <>
              {lead ? `Led by ${lead.full_name}` : <span className="danger">Lead unassigned</span>}
              {coLead ? ` · Co-led by ${coLead.full_name}` : ''}
              {' · '}
            </>
          )}
          {people.length} {people.length === 1 ? 'person' : 'people'}
          {' · '}
          {items.length} active item{items.length === 1 ? '' : 's'}
          {' · '}
          {filed}/{people.length} filed this week
        </p>
      </div>

      {items.length ? (
        <div className="stack" style={{ gap: 12, marginBottom: 16 }}>
          <p className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Projects in this vertical
          </p>
          <div className="grid">
            {items.map((w) => (
              <WorkItemCard key={w.id} item={w} me={me} showBudget={canSeeBudget(me)} onChanged={onChanged} />
            ))}
          </div>
        </div>
      ) : null}

      {!people.length ? (
        <Empty title="No one assigned to this vertical yet" />
      ) : view === 'cards' ? (
        <div className="stack" style={{ gap: 12 }}>
          {people.map((p) => {
            const isOpen = expandedId === p.id;
            const personItems = itemsForUser(p.id);
            return (
              <div key={p.id}>
                <PersonCard person={p} onOpen={toggleExpand} expanded={isOpen} />
                {isOpen ? (
                  <div className="stack" style={{ gap: 10, marginTop: 10, marginLeft: 16 }}>
                    {personItems.length ? (
                      personItems.map((item) => (
                        <WorkItemCard
                          key={item.id}
                          item={item}
                          me={me}
                          showBudget={canSeeBudget(me)}
                          onChanged={onChanged}
                        />
                      ))
                    ) : (
                      <Empty title="No work items yet" hint={`${p.full_name} hasn't logged any work.`} />
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th>Job title</th>
                <th>Role</th>
                <th>Current work</th>
                <th>Items</th>
                <th>Check-in</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const c = countsByType(p.id);
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <Avatar user={p} size={24} />
                        <span>{p.full_name}</span>
                      </div>
                    </td>
                    <td className="muted">{p.job_title}</td>
                    <td>
                      <Pill tone={ROLE_TONE[p.role]}>{ROLE_LABEL[p.role]}</Pill>
                    </td>
                    <td className="wrap muted">{currentFocus(p.id)}</td>
                    <td className="muted">{formatCounts(c)}</td>
                    <td>
                      <CheckinFlag userId={p.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
