import { useState } from 'react';

// Growth notes are freeform (no title/status/verticals/members in this
// schema), so they stay a plain single-page form — the New Work wizard
// (NewWorkWizard.jsx) mounts this directly for that one type rather than
// running it through the 4-step Project/Proposal/Paper/Blue-sky flow.
export function AddNoteForm({ onAdd, onCancel, projects = [] }) {
  const [body, setBody] = useState('');
  const [relatedId, setRelatedId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Awaits onAdd and only lets the caller close on success — a real failure
  // surfaces here instead of the form silently vanishing as if it worked.
  async function submit(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onAdd({ body: body.trim(), work_item_id: relatedId || null });
    } catch (err) {
      setError(err.message || 'Could not post — try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label className="tiny muted" htmlFor="new-note-body">
        What's the update or idea?
      </label>
      <textarea
        id="new-note-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="e.g. Ran a lunch-and-learn on battery storage policy for the team"
        autoFocus
        style={{ marginBottom: 10 }}
      />

      <label className="tiny muted" htmlFor="new-note-related">
        Tag to a project (optional)
      </label>
      <select
        id="new-note-related"
        value={relatedId}
        onChange={(e) => setRelatedId(e.target.value)}
      >
        <option value="">Not tied to a project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>

      {error ? (
        <p className="tiny danger" style={{ marginTop: 8 }}>
          {error}
        </p>
      ) : null}

      <div className="row" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button type="button" className="quiet" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={saving || !body.trim()}>
          {saving ? 'Adding…' : 'Add note'}
        </button>
      </div>
    </form>
  );
}
