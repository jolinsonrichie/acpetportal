import { useState } from 'react';
import { Avatar } from './ui.jsx';
import { AddNoteForm } from './Forms.jsx';
import {
  STATUS_OPTIONS,
  STAGE_DEFAULT_STATUS,
  stageLabel,
  creatableVerticalsFor,
  assignableUsersFor,
} from '../data.js';

const STAGES = ['Upcoming', 'Ongoing', 'Delivered'];
const WORK_TYPE_OPTIONS = [
  { id: 'project', label: 'Project' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'paper', label: 'Paper' },
  { id: 'blue_sky_idea', label: 'Blue-sky idea' },
  { id: 'growth', label: 'Growth note' },
];
const STEP_LABELS = ['Basics', 'Vertical(s)', 'Assign members', 'Status'];

// Searchable multi-select — a dropdown popover (checkboxes + a search box
// once there are enough options to be worth filtering) instead of the old
// always-visible checkbox row, per the redesign's explicit ask.
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
              filtered.map((v) => (
                <label className="multiselect-option" key={v.id}>
                  <input type="checkbox" checked={selected.includes(v.id)} onChange={() => toggle(v.id)} />
                  {v.name}
                </label>
              ))
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

// A clean, scannable table — replaces the old scattered checkbox row.
// `rows[0]` is always the wizard owner's own row (checkbox locked on, role
// fixed to whatever Step 1's "Your role" picked); every other row is a real
// candidate from the selected vertical(s), freely toggle-able.
function MemberAssignTable({ rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th />
            <th>Member</th>
            <th>Role</th>
            <th>Responsibility</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <input
                  type="checkbox"
                  checked={r.selected}
                  disabled={r.locked}
                  onChange={r.onToggle}
                  aria-label={`Include ${r.user.full_name}`}
                />
              </td>
              <td>
                <div className="row" style={{ gap: 8 }}>
                  <Avatar user={r.user} size={22} />
                  <span>
                    {r.user.full_name}
                    {r.locked ? <span className="tiny muted"> (you)</span> : null}
                  </span>
                </div>
              </td>
              <td>
                {r.locked ? (
                  <span className="muted" style={{ textTransform: 'capitalize' }}>
                    {r.role}
                  </span>
                ) : (
                  <select aria-label={`Role for ${r.user.full_name}`} value={r.role} onChange={r.onRoleChange}>
                    <option value="lead">Lead</option>
                    <option value="contributor">Contributor</option>
                  </select>
                )}
              </td>
              <td className="wrap">
                <input
                  aria-label={`Responsibility for ${r.user.full_name}`}
                  value={r.responsibility}
                  onChange={r.onResponsibilityChange}
                  placeholder="e.g. Literature review"
                />
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

// The redesigned "New Work" flow — a 4-step wizard for Project/Proposal/
// Paper/Blue-sky idea (Growth note stays its own single-page form below,
// since it has no title/status/verticals/members in this schema at all).
// Step 1 Basics -> Step 2 Vertical(s) -> Step 3 Assign members (populated
// only once a vertical is chosen) -> Step 4 Initial status. Replaces the old
// single always-visible form that showed every field at once.
export default function NewWorkWizard({ me, defaultVerticalId, projects, onAdd, onAddNote, onClose }) {
  const [type, setType] = useState('project');
  const [step, setStep] = useState(1);

  // Step 1 — basics
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [myRole, setMyRole] = useState('lead');
  const [targetDate, setTargetDate] = useState('');
  const [relatedId, setRelatedId] = useState('');
  const stageGrouped = type === 'project' || type === 'paper';
  const [stage, setStage] = useState('Upcoming');
  const [status, setStatus] = useState(STATUS_OPTIONS.project[0]);

  function changeType(id) {
    setType(id);
    if (id !== 'growth') {
      setStage('Upcoming');
      setStatus(STATUS_OPTIONS[id][0]);
    }
  }

  // Step 2 — vertical(s)
  const verticalOptions = creatableVerticalsFor(me);
  const [selectedVerticals, setSelectedVerticals] = useState(() => {
    if (defaultVerticalId && verticalOptions.some((v) => v.id === defaultVerticalId)) return [defaultVerticalId];
    return me.vertical_id && verticalOptions.some((v) => v.id === me.vertical_id)
      ? [me.vertical_id]
      : verticalOptions.slice(0, 1).map((v) => v.id);
  });

  // Step 3 — assign members. `assignments` only ever holds *other* people;
  // the wizard owner's own row is tracked separately (locked selected, role
  // mirrors Step 1's "Your role").
  const [selfResponsibility, setSelfResponsibility] = useState('');
  const [assignments, setAssignments] = useState({});
  const candidates = assignableUsersFor(me, selectedVerticals).filter((u) => u.id !== me.id);

  function toggleMember(id) {
    setAssignments((cur) => ({
      ...cur,
      [id]: { role: 'contributor', responsibility: '', ...cur[id], selected: !cur[id]?.selected },
    }));
  }
  function setMemberRole(id, role) {
    setAssignments((cur) => ({ ...cur, [id]: { selected: false, responsibility: '', ...cur[id], role } }));
  }
  function setMemberResponsibility(id, responsibility) {
    setAssignments((cur) => ({ ...cur, [id]: { selected: false, role: 'contributor', ...cur[id], responsibility } }));
  }

  // Step 4 — initial status
  const [initialProgress, setInitialProgress] = useState('');
  const [nextMilestone, setNextMilestone] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const canProceed =
    step === 1 ? !!(title.trim() && description.trim()) : step === 2 ? selectedVerticals.length > 0 : true;

  // Awaits the real write and only closes on success — a failure (a pending
  // migration, a network blip, whatever) surfaces right here instead of the
  // modal quietly closing as if it had worked, which is what the previous
  // fire-and-forget `onAdd(fields); onClose();` shape actually did.
  async function submit() {
    const otherMembers = candidates
      .filter((u) => assignments[u.id]?.selected)
      .map((u) => ({
        user_id: u.id,
        role_on_item: assignments[u.id].role,
        responsibility: assignments[u.id].responsibility,
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
        progress_note: initialProgress.trim(),
        plan_note: nextMilestone.trim(),
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

  const memberRows = [
    {
      id: me.id,
      user: me,
      locked: true,
      selected: true,
      role: myRole,
      responsibility: selfResponsibility,
      onResponsibilityChange: (e) => setSelfResponsibility(e.target.value),
    },
    ...candidates.map((u) => {
      const a = assignments[u.id] || { selected: false, role: 'contributor', responsibility: '' };
      return {
        id: u.id,
        user: u,
        locked: false,
        selected: !!a.selected,
        role: a.role,
        responsibility: a.responsibility,
        onToggle: () => toggleMember(u.id),
        onRoleChange: (e) => setMemberRole(u.id, e.target.value),
        onResponsibilityChange: (e) => setMemberResponsibility(u.id, e.target.value),
      };
    }),
  ];

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
                <div style={{ width: 150 }}>
                  <label className="tiny muted" htmlFor="wiz-role">
                    Your role
                  </label>
                  <select id="wiz-role" value={myRole} onChange={(e) => setMyRole(e.target.value)}>
                    <option value="lead">Lead</option>
                    <option value="contributor">Contributor</option>
                  </select>
                </div>
                <div style={{ width: 160 }}>
                  <label className="tiny muted" htmlFor="wiz-date">
                    Target date
                  </label>
                  <input id="wiz-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
                </div>
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
            <div className="stack" style={{ gap: 8 }}>
              <label className="tiny muted">Vertical(s)</label>
              <VerticalMultiSelect options={verticalOptions} selected={selectedVerticals} onChange={setSelectedVerticals} />
              <p className="tiny muted">
                Choose every vertical this work belongs to — a project can be jointly owned by more than one.
              </p>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="stack" style={{ gap: 8 }}>
              <label className="tiny muted">Assign members</label>
              {selectedVerticals.length ? (
                <MemberAssignTable rows={memberRows} />
              ) : (
                <p className="tiny muted">Go back and select a vertical first — members load from there.</p>
              )}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="stack" style={{ gap: 10 }}>
              <div>
                <label className="tiny muted" htmlFor="wiz-progress">
                  Initial progress
                </label>
                <textarea
                  id="wiz-progress"
                  style={{ minHeight: 90 }}
                  value={initialProgress}
                  onChange={(e) => setInitialProgress(e.target.value)}
                  placeholder="e.g. Literature review has been completed. Initial stakeholder meetings finished."
                />
              </div>
              <div>
                <label className="tiny muted" htmlFor="wiz-milestone">
                  Next milestone
                </label>
                <textarea
                  id="wiz-milestone"
                  style={{ minHeight: 90 }}
                  value={nextMilestone}
                  onChange={(e) => setNextMilestone(e.target.value)}
                  placeholder="e.g. Prepare first draft. Collect remaining datasets."
                />
              </div>
              <p className="tiny muted">These become the first entries in this item's activity timeline.</p>
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
            {step < 4 ? (
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
