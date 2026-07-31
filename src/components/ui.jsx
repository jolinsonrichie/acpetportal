import { useState } from 'react';
import { initials, toneForUser } from '../data.js';

const TONE_COLORS = {
  violet: ['var(--violet-bg)', 'var(--violet-fg)'],
  blue: ['var(--blue-bg)', 'var(--blue-fg)'],
  green: ['var(--green-bg)', 'var(--green-fg)'],
  amber: ['var(--amber-bg)', 'var(--amber-fg)'],
  red: ['var(--red-bg)', 'var(--red-fg)'],
};

export function Avatar({ user, size = 32 }) {
  const [bg, fg] = TONE_COLORS[toneForUser(user.id)] || TONE_COLORS.violet;
  return (
    <span
      className="avatar"
      title={user.full_name}
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontSize: Math.round(size * 0.36),
      }}
    >
      {initials(user.full_name)}
    </span>
  );
}

export function AvatarStack({ users, size = 24 }) {
  return (
    <span className="avatar-stack">
      {users.map((u) => (
        <Avatar key={u.id} user={u} size={size} />
      ))}
    </span>
  );
}

export function Pill({ tone = '', children }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

// A small kebab-triggered action menu (Edit/Archive/Delete and similar).
// Purely a trigger surface — each item's onClick does the real work in the
// caller (e.g. WorkItemCard's own editing/archiving/confirmingDelete state);
// this component just shows/hides the popover and closes it after any item
// is clicked (the click bubbles from the item up to the panel, which closes
// unconditionally — simpler than having every item manage its own close).
export function ActionMenu({ label = 'Actions', children }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="action-menu">
      <button
        type="button"
        className="quiet action-menu-trigger"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ⋮
      </button>
      {open ? (
        <>
          <span className="action-menu-backdrop" onClick={() => setOpen(false)} />
          <span className="action-menu-panel" role="menu" onClick={() => setOpen(false)}>
            {children}
          </span>
        </>
      ) : null}
    </span>
  );
}

export function Tabs({ tabs, active, onChange, badges = {} }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          className="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {badges[t.id] ? (
            <span className="dim" style={{ marginLeft: 6 }}>
              {badges[t.id]}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function Segmented({ options, active, onChange }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={o.id}
          aria-pressed={active === o.id}
          onClick={() => onChange(o.id)}
          style={{ fontSize: 13 }}
        >
          {o.label}
          {o.count !== undefined ? (
            <span className="dim" style={{ marginLeft: 6 }}>
              {o.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function Metric({ label, value }) {
  return (
    <div className="card flat">
      <p className="small muted">{label}</p>
      <p className="metric-value">{value}</p>
    </div>
  );
}

export function Empty({ title, hint, action }) {
  return (
    <div className="empty">
      <p className="small">{title}</p>
      {hint ? (
        <p className="tiny muted" style={{ marginTop: 2 }}>
          {hint}
        </p>
      ) : null}
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </div>
  );
}

export function BudgetBar({ spent, total }) {
  if (!total) return null;
  const pct = Math.min(100, Math.round((spent / total) * 100));
  return (
    <div className="row" style={{ gap: 10 }}>
      <div className="bar">
        <div className={pct > 85 ? 'over' : ''} style={{ width: `${pct}%` }} />
      </div>
      <span className="tiny muted" style={{ whiteSpace: 'nowrap' }}>
        {pct}%
      </span>
    </div>
  );
}
