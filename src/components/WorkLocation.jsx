import { useState } from 'react';
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
export default function WorkLocation({ me }) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [query, setQuery] = useState('');
  // workLocations is a plain mutated array, not React state (same pattern
  // workItems/members already use) — bumping this is what makes clicking a
  // day's location actually re-render the grid below it.
  const [, bump] = useState(0);
  const [error, setError] = useState('');

  const dates = weekdayDates(weekStart);

  function shiftWeek(days) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + days);
    setWeekStart(mondayOf(d));
  }

  async function pick(dateIso, location) {
    const current = locationOn(me.id, dateIso);
    setError('');
    try {
      await setWorkLocation(me.id, dateIso, current === location ? null : location);
      bump((n) => n + 1);
    } catch (err) {
      setError(err.message || 'Could not save — try again.');
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
            const current = locationOn(me.id, dateIso);
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
                      className={current === key ? 'primary' : 'quiet'}
                      style={{ fontSize: 12, textAlign: 'left' }}
                      onClick={() => pick(dateIso, key)}
                    >
                      {WORK_LOCATIONS[key].label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
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
