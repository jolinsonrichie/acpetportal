import { useState } from 'react';
import { Avatar } from './ui.jsx';
import { AddNoteForm } from './Forms.jsx';
import {
  STATUS_OPTIONS,
  STAGE_DEFAULT_STATUS,
  stageLabel,
  creatableVerticalsFor,
  assignableUsersFor,
  verticalName,
} from '../data.js';

const STAGES = ['Upcoming', 'Ongoing', 'Delivered'];
const WORK_TYPE_OPTIONS = [
  { id: 'project', label: 'Project' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'paper', label: 'Paper' },
  { id: 'blue_sky_idea', label: 'Blue-sky idea' },
  { id: 'growth', label: 'Growth note' },
];
const STEP_LABELS = ['Basics', 'People', 'Status'];

// Searchable multi-select — a dropdown popover (checkboxes + a search box
// once there are enough options to be worth filtering). Lives in Step 1
// now (2026-07-31 correction — it briefly had its own step, then was
// removed in favor of deriving ownership from assigned people, which
// turned out not to be what was actually wanted; explicit again, just
// folded into Basics instead of a dedicated step).
function VerticalMultiSelect({ options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = options.filter((v) => v.name.toLowerCase().includes(query.toLowerCase()));

  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  const selectedNames = options.filter((v) => selected.includes(v.id)).map((v) => v.name);
  const summary =
    selectedNames.length === 0
      ? 'Select vertical(s)…'
      : selectedNames.length <= 2
      ? selectedNames.join(', ')
      : `${selectedNames.length} verticals selected`;

  return (
    <div className="multiselect">
      <button type="button" className="multiselect-trigger" onClick={() => setOpen((o) => !o)}>
        <span className={selectedNames.length ? '' : 'muted'}>{summary}</span>
        <span className="multiselect-caret" aria-hidden="true">▾</span>
      </button>
      {open ? (
        <>
          <span className="action-menu-backdrop" onClick={() => setOpen(false)} />
          <div className="multiselect-panel">
            {options.length > 5 ? (
              <input
                className="multiselect-search"
                placeholder="Search verticals…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            ) : null}
            {filtered.length ? (
              filtered.map((v) => {
                const isChecked = selected.includes(v.id);
                return (
                  <label className={`multiselect-option${isChecked ? ' is-selected' : ''}`} key={v.id}>
                    <input
                      type="checkbox"
                      className="multiselect-checkbox"
                      checked={isChecked}
                      onChange={() => toggle(v.id)}
                    />
                    <span>{v.name}</span>
                  </label>
                );
              })
            ) : (
              <p className="tiny muted" style={{ padding: '6px 8px' }}>
                No match.
              </p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

// Already-added members, shown as a plain compact list — not the wizard
// owner (they're not "added," they're just the creator, established by
// Step 1's "Your role"; showing them again here as a row to tick was the
// actual complaint: confusing to see your own name in a list you're
// supposed to be picking *other* people from).
function AddedMembersTable({ rows, onRemove }) {
  if (!rows.length) {
    return <p className="tiny muted">No one added yet — that's fine, you can assign people later too.</p>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Member</th>
            <th>Vertical</th>
            <th>Role</th>
            <th>What they're working on</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td>
                <div className="row" style={{ gap: 8 }}>
                  <Avatar user={m.user} size={22} />
                  <span>{m.user.full_name}</span>
                </div>
              </td>
              <td className="muted">{verticalName(m.user.vertical_id)}</td>
              <td style={{ textTransform: 'capitalize' }}>{m.role}</td>
              <td className="wrap muted">{m.responsibility || '—'}</td>
              <td>
                <button type="button" className="quiet" style={{ fontSize: 12 }} onClick={() => onRemove(m.id)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WizardSteps({ step }) {
  return (
    <div className="wizard-steps">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const state = n === step ? 'current' : n < step ? 'done' : 'upcoming';
        return (
          <div className="row" style={{ flex: n < STEP_LABELS.length ? 1 : 'none' }} key={label}>
            <div className={`wizard-step ${state}`}>
              <span className="wizard-step-dot">{state === 'done' ? '✓' : n}</span>
              <span className="wizard-step-label">{label}</span>
            </div>
            {n < STEP_LABELS.length ? <span className={`wizard-step-line ${state === 'done' ? 'done' : ''}`} /> : null}
          </div>
        );
      })}
    </div>
  );
}

// The "New Work" flow — a 3-step wizard for Project/Proposal/Paper/Blue-sky
// idea (Growth note stays its own single-page form below, since it has no
// title/status/verticals/members in this schema at all). Step 1 Basics
// (Title, Description, Your role, Vertical(s), what you're working on) ->
// Step 2 People (pick from a dropdown, one at a time — not a table listing
// the whole org with the creator confusingly included as a row) -> Step 3
// Status (stage-gated: an Upcoming item has nothing "done so far" yet).
export default function NewWorkWizard({ me, projects, onAdd, onAddNote, onClose }) {
  const [type, setType] = useState('project');
  const [step, setStep] = useState(1);

  // Step 1 — basics
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [myRole, setMyRole] = useState('lead');
  const [selfResponsibility, setSelfResponsibility] = useState('');
  const [relatedId, setRelatedId] = useState('');
  const stageGrouped = type === 'project' || type === 'paper';
  const [stage, setStage] = useState('Upcoming');
  const [status, setStatus] = useState(STATUS_OPTIONS.project[0]);

  const verticalOptions = creatableVerticalsFor();
  const [selectedVerticals, setSelectedVerticals] = useState(() =>
    me.vertical_id && verticalOptions.some((v) => v.id === me.vertical_id)
      ? [me.vertical_id]
      : verticalOptions.slice(0, 1).map((v) => v.id)
  );

  function changeType(id) {
    setType(id);
    if (id !== 'growth') {
      setStage('Upcoming');
      setStatus(STATUS_OPTIONS[id][0]);
    }
  }

  // Step 2 — people, added one at a time from a dropdown of every
  // assignable candidate org-wide (assignableUsersFor no longer scopes by
  // vertical — cross-vertical assignment is the whole point). The wizard
  // owner is never a candidate here; their own involvement was already
  // captured in Step 1.
  const [addedMembers, setAddedMembers] = useState([]); // [{ id, user, role, responsibility }]
  const [pickerRole, setPickerRole] = useState('contributor');
  const [pickerResponsibility, setPickerResponsibility] = useState('');
  const [pickerUserId, setPickerUserId] = useState('');

  const candidates = assignableUsersFor(me).filter(
    (u) => u.id !== me.id && !addedMembers.some((m) => m.id === u.id)
  );
  // Re-derived every render rather than trusted as-is, same reasoning
  // QuickUpdateWidget's own comment documents elsewhere in this app: once
  // someone's added, they drop out of `candidates`, so a stale `pickerUserId`
  // would silently point at someone no longer in the list.
  const selectedPickerId = candidates.some((u) => u.id === pickerUserId) ? pickerUserId : candidates[0]?.id ?? '';

  // A brief "✓ Added" confirmation next to the button — clicking "+ Add to
  // project" had no feedback at all before this, so there was no way to
  // tell it actually registered versus nothing happening. Same fade-after-
  // a-moment pattern NotifyForm already uses elsewhere in this app for the
  // same reason (confirming a send).
  const [justAdded, setJustAdded] = useState('');

  function addMember() {
    const user = candidates.find((u) => u.id === selectedPickerId);
    if (!user) return;
    setAddedMembers((cur) => [
      ...cur,
      { id: user.id, user, role: pickerRole, responsibility: pickerResponsibility.trim() },
    ]);
    setJustAdded(user.full_name);
    setTimeout(() => setJustAdded(''), 1600);
    setPickerUserId('');
    setPickerRole('contributor');
    setPickerResponsibility('');
  }

  function removeMember(id) {
    setAddedMembers((cur) => cur.filter((m) => m.id !== id));
  }

  // Who's actually leading this, derived from the same role picks already
  // made (Step 1's "Your role", each added person's own Role) rather than a
  // separate field to fill in — but made explicit and visible rather than
  // left implicit, since setting your own role to Contributor with no one
  // else marked Lead yet otherwise silently leaves this unanswered until
  // someone notices "Lead: Unassigned" on the created project itself.
  const projectLead = myRole === 'lead' ? me : addedMembers.find((m) => m.role === 'lead')?.user ?? null;

  // Step 3 — status
  const [targetDate, setTargetDate] = useState('');
  const [initialProgress, setInitialProgress] = useState('');
  const [nextMilestone, setNextMilestone] = useState('');
  const [planDueDate, setPlanDueDate] = useState('');
  // An upcoming project/paper hasn't started — nothing to report as "done
  // so far" yet, only what's planned. Proposal/blue_sky_idea have no stage
  // concept at all (flat status list instead, see STATUS_OPTIONS/
  // STAGE_FOR_STATUS in data.js), so both fields always show for those.
  const showDoneSoFar = !stageGrouped || stage !== 'Upcoming';

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const canProceed =
    step === 1 ? !!(title.trim() && description.trim() && selectedVerticals.length) : true;

  // Awaits the real write and only closes on success — a failure (a pending
  // migration, a network blip, whatever) surfaces right here instead of the
  // modal quietly closing as if it had worked, which is what the previous
  // fire-and-forget `onAdd(fields); onClose();` shape actually did.
  async function submit() {
    const otherMembers = addedMembers.map((m) => ({
      user_id: m.id,
      role_on_item: m.role,
      responsibility: m.responsibility,
    }));

    setSubmitting(true);
    setSubmitError('');
    try {
      await onAdd({
        type,
        title: title.trim(),
        description: description.trim(),
        target_date: targetDate,
        related_work_item_id: type === 'blue_sky_idea' ? relatedId || null : null,
        status: stageGrouped ? STAGE_DEFAULT_STATUS[type][stage] : status,
        role_on_item: myRole,
        responsibility: selfResponsibility.trim(),
        progress_note: showDoneSoFar ? initialProgress.trim() : '',
        plan_note: nextMilestone.trim(),
        plan_due_date: planDueDate || null,
        owning_verticals: selectedVerticals,
        initial_member_ids: otherMembers,
      });
      onClose();
    } catch (err) {
      setSubmitError(err.message || 'Could not create this — try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <label className="tiny muted">Work type</label>
        <div className="segmented" style={{ marginTop: 6, flexWrap: 'wrap' }}>
          {WORK_TYPE_OPTIONS.map((o) => (
            <button key={o.id} type="button" aria-pressed={type === o.id} onClick={() => changeType(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {type === 'growth' ? (
        <AddNoteForm
          projects={projects}
          onAdd={async (fields) => {
            await onAddNote(fields);
            onClose();
          }}
          onCancel={onClose}
        />
      ) : (
        <>
          <WizardSteps step={step} />

          {step > 1 ? (
            <div className="row" style={{ gap: 20, flexWrap: 'wrap', marginBottom: 4 }}>
              <p className="tiny muted">
                <strong>Vertical(s): </strong>
                {selectedVerticals.map((id) => verticalName(id)).join(', ') || 'None selected'}
              </p>
              <p className="tiny muted">
                <strong>Project lead: </strong>
                {projectLead ? (
                  `${projectLead.full_name}${projectLead.id === me.id ? ' (you)' : ''}`
                ) : (
                  <span className="danger">Not assigned yet — mark someone as Lead below</span>
                )}
              </p>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="stack" style={{ gap: 10 }}>
              <div>
                <label className="tiny muted" htmlFor="wiz-title">
                  Title *
                </label>
                <input
                  id="wiz-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Grid flexibility assessment"
                  autoFocus
                />
              </div>
              <div>
                <label className="tiny muted" htmlFor="wiz-description">
                  Project description *
                </label>
                <textarea
                  id="wiz-description"
                  style={{ minHeight: 110 }}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this work, and why does it matter? Give people context before they're assigned to it."
                />
              </div>
              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                <div style={{ width: 170 }}>
                  <label className="tiny muted" htmlFor="wiz-role">
                    Your role
                  </label>
                  <select id="wiz-role" value={myRole} onChange={(e) => setMyRole(e.target.value)}>
                    <option value="lead">Lead</option>
                    <option value="contributor">Contributor</option>
                  </select>
                </div>
                <div className="grow" style={{ minWidth: 200 }}>
                  <label className="tiny muted">Vertical(s) *</label>
                  <VerticalMultiSelect options={verticalOptions} selected={selectedVerticals} onChange={setSelectedVerticals} />
                </div>
              </div>
              <div>
                <label className="tiny muted" htmlFor="wiz-self-responsibility">
                  What are you working on <span className="dim">(optional)</span>
                </label>
                <input
                  id="wiz-self-responsibility"
                  value={selfResponsibility}
                  onChange={(e) => setSelfResponsibility(e.target.value)}
                  placeholder="e.g. Overall coordination, stakeholder outreach"
                />
              </div>
              {type === 'blue_sky_idea' ? (
                <div>
                  <label className="tiny muted" htmlFor="wiz-related">
                    Related project (optional)
                  </label>
                  <select id="wiz-related" value={relatedId} onChange={(e) => setRelatedId(e.target.value)}>
                    <option value="">General idea — not tied to a project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="stack" style={{ gap: 12 }}>
              <div>
                <label className="tiny muted">Add people</label>
                <p className="tiny muted" style={{ marginTop: 2 }}>
                  Add as many as you need — pick someone, set their role and what they're working on, then "+ Add
                  to project". They'll drop into the list below and you can add the next person right away.
                </p>
              </div>
              {candidates.length ? (
                <div className="card" style={{ padding: 12 }}>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div className="grow" style={{ minWidth: 180 }}>
                      <label className="tiny muted" htmlFor="wiz-add-person">
                        Person
                      </label>
                      <select id="wiz-add-person" value={selectedPickerId} onChange={(e) => setPickerUserId(e.target.value)}>
                        {candidates.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name} — {verticalName(u.vertical_id)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ width: 150 }}>
                      <label className="tiny muted" htmlFor="wiz-add-role">
                        Role
                      </label>
                      <select id="wiz-add-role" value={pickerRole} onChange={(e) => setPickerRole(e.target.value)}>
                        <option value="contributor">Contributor</option>
                        <option value="lead">Lead</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <label className="tiny muted" htmlFor="wiz-add-responsibility">
                      What are they working on
                    </label>
                    <textarea
                      id="wiz-add-responsibility"
                      style={{ minHeight: 60 }}
                      value={pickerResponsibility}
                      onChange={(e) => setPickerResponsibility(e.target.value)}
                      placeholder="e.g. Literature review, data collection…"
                    />
                  </div>
                  <div className="row" style={{ marginTop: 8, gap: 10, justifyContent: 'flex-end' }}>
                    {justAdded ? <span className="tiny ok">✓ Added {justAdded}</span> : null}
                    <button type="button" className="primary" style={{ fontSize: 13 }} onClick={addMember}>
                      + Add to project
                    </button>
                  </div>
                </div>
              ) : (
                <p className="tiny muted">Everyone assignable has already been added.</p>
              )}
              <AddedMembersTable rows={addedMembers} onRemove={removeMember} />
            </div>
          ) : null}

          {step === 3 ? (
            <div className="stack" style={{ gap: 10 }}>
              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                <div style={{ width: 170 }}>
                  <label className="tiny muted" htmlFor="wiz-stage">
                    {stageGrouped ? 'Stage' : 'Status'}
                  </label>
                  {stageGrouped ? (
                    <select id="wiz-stage" value={stage} onChange={(e) => setStage(e.target.value)}>
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {stageLabel(type, s)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select id="wiz-stage" value={status} onChange={(e) => setStatus(e.target.value)}>
                      {STATUS_OPTIONS[type].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div style={{ width: 160 }}>
                  <label className="tiny muted" htmlFor="wiz-date">
                    Target date
                  </label>
                  <input id="wiz-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
                </div>
              </div>
              {showDoneSoFar ? (
                <div>
                  <label className="tiny muted" htmlFor="wiz-progress">
                    What's been done so far
                  </label>
                  <textarea
                    id="wiz-progress"
                    style={{ minHeight: 90 }}
                    value={initialProgress}
                    onChange={(e) => setInitialProgress(e.target.value)}
                    placeholder="e.g. Literature review has been completed. Initial stakeholder meetings finished."
                  />
                </div>
              ) : null}
              <div>
                <label className="tiny muted" htmlFor="wiz-milestone">
                  What are the next steps
                </label>
                <textarea
                  id="wiz-milestone"
                  style={{ minHeight: 90 }}
                  value={nextMilestone}
                  onChange={(e) => setNextMilestone(e.target.value)}
                  placeholder="e.g. Prepare first draft. Collect remaining datasets."
                />
              </div>
              <div style={{ width: 160 }}>
                <label className="tiny muted" htmlFor="wiz-plan-due">
                  Next steps due by <span className="dim">(optional)</span>
                </label>
                <input
                  id="wiz-plan-due"
                  type="date"
                  value={planDueDate}
                  onChange={(e) => setPlanDueDate(e.target.value)}
                />
              </div>
              <p className="tiny muted">These become this item's first logged Progress/Planned entry.</p>
            </div>
          ) : null}

          {submitError ? (
            <p className="tiny danger" style={{ marginTop: 10 }}>
              {submitError}
            </p>
          ) : null}

          <div className="between" style={{ marginTop: 18 }}>
            <div className="row" style={{ gap: 8 }}>
              {step > 1 ? (
                <button type="button" className="quiet" disabled={submitting} onClick={() => setStep((s) => s - 1)}>
                  ← Back
                </button>
              ) : null}
              <button type="button" className="quiet" disabled={submitting} onClick={onClose}>
                Cancel
              </button>
            </div>
            {step < STEP_LABELS.length ? (
              <button type="button" className="primary" disabled={!canProceed} onClick={() => setStep((s) => s + 1)}>
                Next →
              </button>
            ) : (
              <button type="button" className="primary" disabled={!title.trim() || submitting} onClick={submit}>
                {submitting ? 'Creating…' : `Create ${WORK_TYPE_OPTIONS.find((o) => o.id === type)?.label}`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
