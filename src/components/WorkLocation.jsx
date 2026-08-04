import { useEffect, useState } from 'react';
import { Avatar, Pill } from './ui.jsx';
import {
  users,
  WORK_LOCATIONS,
  mondayOf,
  weekdayDates,
  locationOn,
  setWorkLocation,
  formatDate,
} from '../data.js';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const LOCATION_KEYS = Object.keys(WORK_LOCATIONS);

function LocationBadge({ location }) {
  if (!location) return <span className="tiny dim">—</span>;
  return <Pill tone={WORK_LOCATIONS[location].tone}>{WORK_LOCATIONS[location].label}</Pill>;
}

// Built UI-first against data.js's mock-only workLocations array, confirmed
// working, then wired to a real table (migration 0014) the same session —
// setWorkLocation now awaits a genuine Supabase write for a real signed-in
// session (falls back to the same local-only behavior otherwise).
//
// "Your week" is a draft-then-save surface, not save-on-every-click: picking
// a day's location only edits local `draft` state (Mon can be WFH, Tue can
// be office — any real-world mix), and nothing reaches the database until
// "Update" is pressed, which writes every changed day in one pass. Replaced
// an earlier same-location-for-every-day-only bulk button — real weeks are
// rarely one location every day, so that didn't cover the actual use case.
export default function WorkLocation({ me }) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [query, setQuery] = useState('');
  // workLocations is a plain mutated array, not React state (see
  // workItems/members) — bumping this is what makes a successful save
  // (and anyone else's synced changes) actually show up.
  const [, bump] = useState(0);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  const dates = weekdayDates(weekStart);

  // Re-seeds the draft from whatever's actually saved whenever the visible
  // week changes — a draft pick is a scratchpad for the week on screen, not
  // something carried across navigating away from it.
  useEffect(() => {
    const next = {};
    weekdayDates(weekStart).forEach((d) => {
      next[d] = locationOn(me.id, d);
    });
    setDraft(next);
    setError('');
  }, [weekStart, me.id]);

  function shiftWeek(days) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + days);
    setWeekStart(mondayOf(d));
  }

  function pickDraft(dateIso, location) {
    setDraft((d) => ({ ...d, [dateIso]: d[dateIso] === location ? null : location }));
  }

  const hasChanges = dates.some((d) => (draft[d] ?? null) !== locationOn(me.id, d));

  // Only writes the days that actually changed from what's saved — not a
  // blind loop over all 5, so re-clicking Update with nothing new to say
  // does zero real writes.
  async function saveWeek() {
    setError('');
    setSaving(true);
    try {
      for (const dateIso of dates) {
        const next = draft[dateIso] ?? null;
        if (next !== locationOn(me.id, dateIso)) {
          await setWorkLocation(me.id, dateIso, next);
        }
      }
      bump((n) => n + 1);
    } catch (err) {
      setError(err.message || 'Could not save — try again.');
    } finally {
      setSaving(false);
    }
  }

  const filteredUsers = users.filter((u) => u.full_name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="card">
        <div className="between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2>Your week</h2>
            <p className="tiny muted">Mark where you're working from each day — visible to everyone.</p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="quiet" style={{ fontSize: 13 }} onClick={() => shiftWeek(-7)}>
              ← Prev week
            </button>
            <span className="tiny muted" style={{ alignSelf: 'center', whiteSpace: 'nowrap' }}>
              {formatDate(dates[0])} – {formatDate(dates[4])}
            </span>
            <button type="button" className="quiet" style={{ fontSize: 13 }} onClick={() => shiftWeek(7)}>
              Next week →
            </button>
          </div>
        </div>

        <div className="row" style={{ gap: 14, marginTop: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {dates.map((dateIso, i) => {
            const picked = draft[dateIso] ?? null;
            return (
              <div key={dateIso} style={{ minWidth: 140 }}>
                <p className="tiny muted" style={{ marginBottom: 6 }}>
                  {DAY_LABELS[i]} · {formatDate(dateIso)}
                </p>
                <div className="stack" style={{ gap: 4 }}>
                  {LOCATION_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={picked === key ? 'primary' : 'quiet'}
                      style={{ fontSize: 12, textAlign: 'left' }}
                      onClick={() => pickDraft(dateIso, key)}
                    >
                      {WORK_LOCATIONS[key].label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="between" style={{ marginTop: 16, alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <p className="tiny muted">
            {hasChanges ? "You've picked days above — click Update to save them." : 'Nothing to save — this matches what\'s already recorded.'}
          </p>
          <button type="button" className="primary" style={{ fontSize: 13 }} onClick={saveWeek} disabled={saving || !hasChanges}>
            {saving ? 'Updating…' : 'Update'}
          </button>
        </div>
        {error ? (
          <p className="tiny danger" style={{ marginTop: 10 }}>
            {error}
          </p>
        ) : null}
      </div>

      <div className="card">
        <div className="between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <h2>Everyone this week</h2>
          <input
            style={{ maxWidth: 220 }}
            placeholder="Search people…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search people"
          />
        </div>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table>
            <thead>
              <tr>
                <th>Person</th>
                {dates.map((dateIso, i) => (
                  <th key={dateIso}>{DAY_LABELS[i]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <Avatar user={u} size={22} />
                      <span>
                        {u.full_name}
                        {u.id === me.id ? <span className="tiny muted"> (you)</span> : null}
                      </span>
                    </div>
                  </td>
                  {dates.map((dateIso) => (
                    <td key={dateIso}>
                      <LocationBadge location={locationOn(u.id, dateIso)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tiny muted" style={{ marginTop: 10 }}>
          Everyone's real schedule, pulled from the database — refresh to see anyone else's updates.
        </p>
      </div>
    </div>
  );
}
