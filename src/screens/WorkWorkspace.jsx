import { useState } from 'react';
import { Avatar, AvatarStack, Pill, Empty } from '../components/ui.jsx';
import { WorkItemCard } from '../components/Team.jsx';
import NewWorkWizard from '../components/NewWorkWizard.jsx';
import VerticalOverview from '../components/VerticalOverview.jsx';
import {
  workItems,
  comments,
  verticalsOf,
  membersOf,
  getUser,
  allTeamsOf,
  itemsForUser,
  addContribution,
  deleteGrowthNote,
  isArchived,
  isOrgWideRole,
  TYPE_LABELS,
  WORK_TYPES,
  formatDate,
  statusTone,
} from '../data.js';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'project', label: 'Projects' },
  { id: 'proposal', label: 'Proposals' },
  { id: 'paper', label: 'Papers' },
  { id: 'blue_sky_idea', label: 'Blue-sky Ideas' },
  { id: 'growth', label: 'Growth Notes' },
];

function GrowthNoteRow({ note, me, onChanged }) {
  const author = getUser(note.author_id);
  const canDelete = me && (note.author_id === me.id || me.role === 'director');
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try {
      await deleteGrowthNote(note.id);
      onChanged?.();
    } catch (err) {
      setError(err.message || 'Could not delete — try again.');
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="card">
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
          {author ? <Avatar user={author} size={28} /> : null}
          <div className="grow">
            <p className="small" style={{ fontWeight: 600 }}>{author?.full_name ?? 'Unknown'}</p>
            <p className="small muted" style={{ marginTop: 2 }}>{note.body}</p>
          </div>
        </div>
        {canDelete ? (
          confirming ? (
            <span className="row" style={{ gap: 6 }}>
              <button
                className="quiet"
                style={{ fontSize: 13, color: 'var(--red-fg)' }}
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button className="quiet" style={{ fontSize: 13 }} onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button className="quiet" style={{ fontSize: 13 }} onClick={() => setConfirming(true)}>
              Delete
            </button>
          )
        ) : null}
      </div>
      {error ? (
        <p className="tiny danger" style={{ marginTop: 6 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

// The Jira/Linear-style summary card shown in the grid — a compact preview,
// not the full detail. Clicking "Open" hands off to WorkItemDrawer, which
// renders the existing, fully-featured WorkItemCard (comments, updates,
// assign, edit, delete already built there — no reason to rebuild any of
// that inside this new card).
function WorkCard({ item, me, onOpen }) {
  const mem = item._members ?? [];
  const youreOnThis = me && mem.some((u) => u.id === me.id);
  return (
    <div className="card">
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <h2 style={{ margin: 0 }}>{item.title}</h2>
        <div className="row" style={{ gap: 6 }}>
          {youreOnThis ? <Pill tone="green">You're on this</Pill> : null}
          {isArchived(item) ? <Pill tone="amber">Archived</Pill> : null}
          <Pill tone={statusTone(item.status)}>{item.status}</Pill>
        </div>
      </div>
      {item.progress_note ? (
        <p className="tiny muted" style={{ marginTop: 8 }}>
          <strong>Progress: </strong>
          {item.progress_note}
        </p>
      ) : null}
      {item.plan_note ? (
        <p className="tiny muted" style={{ marginTop: 4 }}>
          <strong>Next: </strong>
          {item.plan_note}
        </p>
      ) : null}
      <div className="card-divider between">
        <AvatarStack users={mem} size={22} />
        <span className="tiny muted">Due {formatDate(item.target_date)}</span>
      </div>
      <div style={{ marginTop: 10, textAlign: 'right' }}>
        <button className="primary" style={{ fontSize: 13 }} onClick={() => onOpen(item)}>
          Open
        </button>
      </div>
    </div>
  );
}

// Centered modal (not a right-docked slide-over — that read as broken/
// off-center to the user, flagged directly) — same backdrop idiom as
// EmployeeHome's ProfilePanel and the New Work modal below, just reusing
// .work-modal's centering so every "open a thing" surface in this app looks
// the same.
function WorkItemDrawer({ item, me, onClose, onChanged }) {
  // The item's own owning verticals, not whichever vertical tab happened to
  // be active when it was opened — needed now that the Overview tab can
  // show cards from every vertical at once (see VerticalDashboard's
  // org-wide branch below), so the vertical that opened a card isn't
  // necessarily the vertical that owns it.
  const owningVerticals = verticalsOf(item.id);
  return (
    <>
      <div className="profile-backdrop" onClick={onClose} />
      <div className="work-modal" role="dialog" aria-label={item.title}>
        <div className="between" style={{ marginBottom: 14 }}>
          <p className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {owningVerticals.length ? owningVerticals.map((v) => v.name).join(' + ') : '—'} ·{' '}
            {TYPE_LABELS[item.type].singular}
          </p>
          <button className="quiet" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <WorkItemCard item={item} me={me} onChanged={onChanged} defaultShowContribs prominentAssign />
      </div>
    </>
  );
}

// Centered modal wrapping the new step-by-step wizard (see
// NewWorkWizard.jsx) — replaces the old always-visible, all-fields-at-once
// form per direct feedback that it was too much at a glance.
function NewWorkModal({ me, defaultVertical, projects, onAdd, onAddNote, onClose }) {
  return (
    <>
      <div className="profile-backdrop" onClick={onClose} />
      <div className="work-modal" role="dialog" aria-label="New work">
        <div className="between" style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>New work</h2>
          <button className="quiet" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <NewWorkWizard
          me={me}
          defaultVerticalId={defaultVertical.id}
          projects={projects}
          onAdd={onAdd}
          onAddNote={onAddNote}
          onClose={onClose}
        />
      </div>
    </>
  );
}

// Promotes the "log a weekly update" flow out from behind a specific card's
// Updates toggle — a dropdown of exactly the viewer's own items in this
// vertical, so posting an update doesn't require hunting through the grid
// for the right card first. Reuses addContribution wholesale (no new
// backend); renders nothing if the viewer has no items here yet.
function QuickUpdateWidget({ me, vertical, onChanged }) {
  const myItems = itemsForUser(me.id).filter((w) => verticalsOf(w.id).some((v) => v.id === vertical.id));
  const [selected, setSelected] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  if (!myItems.length) return null;

  // Re-derived at every render rather than trusting `selected` as-is — a
  // lazy useState default would only ever reflect myItems as it existed at
  // this widget's *first* mount, and go stale the moment the assigned-item
  // list changes underneath it (e.g. right after creating a new item — the
  // <select> would visually show the new option, since browsers fall back
  // to the first one when the bound value matches nothing, while the actual
  // submit still silently posted against the old, no-longer-listed id).
  const selectedId = myItems.some((w) => w.id === selected) ? selected : myItems[0].id;

  async function submit(e) {
    e.preventDefault();
    if (!body.trim() || !selectedId) return;
    setSaving(true);
    try {
      await addContribution({ work_item_id: selectedId, body: body.trim() }, me.id);
      setBody('');
      onChanged?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Quick update</h2>
      <p className="tiny muted" style={{ marginTop: 2 }}>
        Log this week's progress on something you're assigned to in {vertical.name}.
      </p>
      <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <select aria-label="Which item" value={selectedId} onChange={(e) => setSelected(e.target.value)}>
          {myItems.map((w) => (
            <option key={w.id} value={w.id}>
              {TYPE_LABELS[w.type].singular} · {w.title}
            </option>
          ))}
        </select>
      </div>
      <textarea
        style={{ marginTop: 10 }}
        placeholder="What are you working on this week?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="row" style={{ marginTop: 10 }}>
        <button type="submit" className="primary" disabled={saving || !body.trim()}>
          {saving ? 'Posting…' : 'Post update'}
        </button>
      </div>
    </form>
  );
}

// allVerticals defaults to just this one vertical for every non-org-wide
// caller (employee/lead scopes are already narrow) — only a director's
// Overview tab actually uses it to fan out across every team at once.
function VerticalDashboard({ vertical, allVerticals = [vertical], me, onAddItem, onAddNote, onChanged }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [creating, setCreating] = useState(false);
  const [openItem, setOpenItem] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const itemsOfType = (type) =>
    workItems
      .filter((w) => w.type === type && verticalsOf(w.id).some((v) => v.id === vertical.id))
      .map((w) => ({ ...w, _members: membersOf(w.id).map((m) => m.user) }));

  // The grid only counts active (non-archived) work by default — archiving
  // is meant to clear an item off the active board, same intent as the
  // spec's "hidden from active views, recoverable" ask. Archived ones are
  // still reachable via the toggle below, just not counted.
  const activeItemsOfType = (type) => itemsOfType(type).filter((w) => !isArchived(w));
  const archivedItemsOfType = (type) => itemsOfType(type).filter((w) => isArchived(w));

  const notes = comments.filter(
    (c) => !c.work_item_id && (() => { const a = getUser(c.author_id); return a && allTeamsOf(a.id).some((v) => v.id === vertical.id); })()
  );

  const myProjects = workItems.filter((w) => w.type === 'project' && verticalsOf(w.id).some((v) => v.id === vertical.id));

  // "Overview" and "Growth Notes" aren't work-item types — everything else in
  // TABS is, and shares the same archived-toggle/grid treatment below.
  const isTypeTab = WORK_TYPES.includes(activeTab);
  const archivedCount = isTypeTab ? archivedItemsOfType(activeTab).length : 0;
  const shownItems = activeTab === 'growth' ? notes : isTypeTab ? (showArchived ? itemsOfType(activeTab) : activeItemsOfType(activeTab)) : [];

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div className="segmented" style={{ flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button key={t.id} aria-pressed={activeTab === t.id} style={{ fontSize: 13 }} onClick={() => setActiveTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="row" style={{ gap: 12 }}>
          {isTypeTab ? (
            <button className="quiet" style={{ fontSize: 13 }} onClick={() => setShowArchived((s) => !s)}>
              {showArchived ? 'Hide archived' : `Show archived${archivedCount ? ` (${archivedCount})` : ''}`}
            </button>
          ) : null}
          <button className="primary" onClick={() => setCreating(true)}>
            + New work
          </button>
        </div>
      </div>

      {activeTab === 'overview' ? (
        isOrgWideRole(me.role) && allVerticals.length > 1 ? (
          // The Director's "just show me everything" view: every vertical's
          // full Overview (lead, every member's role + latest update, the
          // reporting-rate bar) stacked in one place, org-wide, rather than
          // requiring a click through each vertical's own tab one at a time.
          <div className="stack" style={{ gap: 32 }}>
            {allVerticals.map((v) => (
              <div key={v.id}>
                <div className="hub-section-title" style={{ marginBottom: 12 }}>
                  <span className="bar" />
                  <h2>{v.name}</h2>
                </div>
                <VerticalOverview vertical={v} me={me} onOpenItem={setOpenItem} />
              </div>
            ))}
          </div>
        ) : (
          <VerticalOverview vertical={vertical} me={me} onOpenItem={setOpenItem} />
        )
      ) : isTypeTab ? (
        <>
          <QuickUpdateWidget me={me} vertical={vertical} onChanged={onChanged} />
          {shownItems.length ? (
            <div className="grid">
              {shownItems.map((item) => (
                <WorkCard key={item.id} item={item} me={me} onOpen={setOpenItem} />
              ))}
            </div>
          ) : (
            <Empty
              title={`No ${TYPE_LABELS[activeTab].plural.toLowerCase()} yet`}
              hint={`Use "+ New work" above to add the first one to ${vertical.name}.`}
            />
          )}
        </>
      ) : shownItems.length ? (
        <div className="stack" style={{ gap: 10 }}>
          {shownItems.map((n) => (
            <GrowthNoteRow key={n.id} note={n} me={me} onChanged={onChanged} />
          ))}
        </div>
      ) : (
        <Empty
          title="No growth notes yet"
          hint={`Use "+ New work" above to add the first one to ${vertical.name}.`}
        />
      )}

      {creating ? (
        <NewWorkModal
          me={me}
          defaultVertical={vertical}
          projects={myProjects}
          // Awaited, and deliberately not caught here — a real failure needs
          // to reach NewWorkWizard's own try/catch so it can show the error
          // and keep the modal open, not vanish as a silent no-op.
          onAdd={async (fields) => { await onAddItem(fields); onChanged?.(); }}
          onAddNote={async (fields) => { await onAddNote(fields); onChanged?.(); }}
          onClose={() => setCreating(false)}
        />
      ) : null}

      {openItem ? (
        <WorkItemDrawer
          item={workItems.find((w) => w.id === openItem.id) ?? openItem}
          me={me}
          onClose={() => setOpenItem(null)}
          onChanged={() => {
            onChanged?.();
            // Deleting the open item from inside the drawer itself
            // (WorkItemCard's own Delete button) has no way to tell the
            // drawer to close — it only knows to mutate the underlying
            // array and call onChanged. Closing here, once the item is
            // confirmed gone, is what makes that actually happen instead
            // of leaving a drawer open on a deleted item forever.
            if (!workItems.some((w) => w.id === openItem.id)) setOpenItem(null);
          }}
        />
      ) : null}
    </div>
  );
}

// The new vertical-first Work workspace — replaces the old "Add work" form
// entirely, and (since it's a strict superset) also replaces the separate
// flat "Projects"/"Proposals" nav tabs section 49-51 built. `scopeVerticals`
// is whichever verticals this viewer should see as tabs across the top:
// an employee's own team(s) (allTeamsOf), a lead's led team(s)
// (verticalsLedBy), or every vertical for org-wide roles — the caller
// (EmployeeHome/VerticalLeadHome/DirectorHome) decides which, this
// component just renders whatever list it's given.
export default function WorkWorkspace({ me, scopeVerticals, onAddItem, onAddNote, onChanged }) {
  const [activeId, setActiveId] = useState(scopeVerticals[0]?.id ?? null);
  const active = scopeVerticals.find((v) => v.id === activeId) ?? scopeVerticals[0];

  if (!scopeVerticals.length) {
    return <Empty title="No vertical assigned yet" hint="Ask the Director to assign you to a team." />;
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="section-tabbar">
        {scopeVerticals.map((v) => (
          <button
            key={v.id}
            type="button"
            className="section-tab"
            aria-pressed={active.id === v.id}
            onClick={() => setActiveId(v.id)}
            style={{ '--tab-accent': 'var(--brand-green-light)' }}
          >
            <span className="section-tab-label">{v.name}</span>
          </button>
        ))}
      </div>
      <div className="section-panel" style={{ '--tab-accent': 'var(--brand-green-light)' }}>
        <VerticalDashboard
          key={active.id}
          vertical={active}
          allVerticals={scopeVerticals}
          me={me}
          onAddItem={onAddItem}
          onAddNote={onAddNote}
          onChanged={onChanged}
        />
      </div>
    </div>
  );
}
