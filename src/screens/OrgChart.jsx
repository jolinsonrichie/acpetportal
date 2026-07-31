import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/ui.jsx';
import {
  verticals,
  users,
  getUser,
  membersOfVertical,
  extraVerticalsOf,
  allTeamsOf,
  orgWideContributors,
  ROLE_LABEL,
} from '../data.js';

// The connector lines used to be positioned with CSS percentage/calc() math
// that *assumed* the tick grid's geometry matched the real box grid's
// geometry below it — correct in principle, but any tiny rounding
// difference between the two (browser zoom, OS display scaling, subpixel
// snapping) shows up as a visibly misaligned line, since a couple of CSS
// pixels is very noticeable on a thin 2px line. Measuring the *actual*
// rendered center of each box via getBoundingClientRect and positioning the
// lines from those real numbers sidesteps that entirely — there's no
// "should line up" left to get wrong, only "is measured to line up."
function useBoxCenters(rowRef, boxRefs, deps) {
  const [centers, setCenters] = useState(null);

  useLayoutEffect(() => {
    function measure() {
      const rowEl = rowRef.current;
      if (!rowEl) return;
      const rowRect = rowEl.getBoundingClientRect();
      const next = boxRefs.current.map((el) => {
        if (!el) return 0;
        const r = el.getBoundingClientRect();
        return r.left + r.width / 2 - rowRect.left;
      });
      if (next.length) setCenters(next);
    }
    measure();
    // Re-measure after the Archivo webfont finishes loading — it can
    // reflow box widths slightly after the first paint.
    document.fonts?.ready?.then(measure);
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    if (rowRef.current) ro.observe(rowRef.current);
    return () => {
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return centers;
}

// Small flat single-color icon set, hand-drawn (no icon library in this
// project) — just enough shapes to give each team box a recognizable glyph
// matching the reference mockup. `size` controls both width/height.
function IconPerson({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7z" />
    </svg>
  );
}
function IconGroup({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="8" r="3.2" />
      <circle cx="16.5" cy="9.4" r="2.6" />
      <path d="M2.3 20c0-3.9 3-6 6.7-6s6.7 2.1 6.7 6z" />
      <path d="M15 14.5c2.7.5 4.3 2.4 4.3 5.5h-3.1" />
    </svg>
  );
}
function IconDiamond({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 3h12l4 6.2L12 21 2 9.2z" />
    </svg>
  );
}
function IconBars({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="12" width="4.2" height="9" rx="1" />
      <rect x="9.9" y="7" width="4.2" height="14" rx="1" />
      <rect x="16.8" y="3" width="4.2" height="18" rx="1" />
    </svg>
  );
}
function IconChat({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v8A2.5 2.5 0 0117.5 16H9l-5 4v-4a2.5 2.5 0 01-2-2.45z" />
    </svg>
  );
}
function IconBulb({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a7 7 0 00-4 12.7c.7.5 1.1 1.3 1.1 2.1v.4h5.8v-.4c0-.8.4-1.6 1.1-2.1A7 7 0 0012 2z" />
      <rect x="9.2" y="19" width="5.6" height="1.7" rx="0.8" />
      <rect x="9.9" y="21.2" width="4.2" height="1.4" rx="0.7" />
    </svg>
  );
}
function IconStar({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.5l2.9 6 6.6.8-4.8 4.6 1.2 6.5L12 17l-5.9 3.4 1.2-6.5-4.8-4.6 6.6-.8z" />
    </svg>
  );
}

// One accent (icon color + icon-circle tint) per column in the main row,
// cycling by position — reuses the exact tone vars already behind Pills
// elsewhere in the app, not a new palette. Icons are matched to each
// vertical by id since they're purely decorative chrome, not derived data;
// a newly-added team just falls back to the next color/IconGroup in line.
const ORG_ACCENTS = [
  { fg: 'var(--red-fg)', bg: 'var(--red-bg)', Icon: IconPerson },
  { fg: 'var(--violet-fg)', bg: 'var(--violet-bg)', Icon: IconDiamond },
  { fg: 'var(--blue-fg)', bg: 'var(--blue-bg)', Icon: IconBars },
  { fg: 'var(--green-fg)', bg: 'var(--green-bg)', Icon: IconGroup },
  { fg: 'var(--amber-fg)', bg: 'var(--amber-bg)', Icon: IconChat },
];

// The card's "Led by X" line already names the lead — repeating them inside
// the member list below would just be the same fact twice, so the roster
// only shows everyone *else* (co-leads included, since a co-lead is a real
// member and isn't named anywhere else on the card).
function RosterList({ roster, vertical, meId, horizontal }) {
  const shown = roster.filter((p) => p.id !== vertical.lead_id);
  if (!shown.length) {
    return (
      <p className="tiny muted">
        {roster.length ? 'No other members yet.' : 'No one assigned yet.'}
      </p>
    );
  }
  return (
    <div className={`org-roster${horizontal ? ' horizontal' : ''}`}>
      {shown.map((p) => {
        const also = extraVerticalsOf(p.id).filter((v) => v.id !== vertical.id);
        return (
          <div className="org-roster-row" key={p.id}>
            <Avatar user={p} size={horizontal ? 26 : 22} />
            <div>
              <p className="tiny" style={{ fontWeight: 600 }}>
                {p.full_name}
                {p.id === meId ? ' · you' : ''}
                {p.id === vertical.co_lead_id ? ' · co-lead' : ''}
              </p>
              <p className="tiny muted">
                {p.job_title}
                {also.length ? ` · also on: ${also.map((v) => v.name).join(', ')}` : ''}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// forwardRef so OrgChart can measure this box's real rendered center (see
// useBoxCenters above) instead of assuming where CSS grid math put it.
const VerticalBox = forwardRef(function VerticalBox({ vertical, myTeamIds, meId, accent, style }, ref) {
  const lead = getUser(vertical.lead_id);
  const coLead = getUser(vertical.co_lead_id);
  const roster = membersOfVertical(vertical.id);
  const isMine = myTeamIds.has(vertical.id);
  const Icon = accent.Icon;

  return (
    <div
      ref={ref}
      className={`org-vbox${isMine ? ' me' : ''}`}
      style={{ ...style, '--vbox-accent': accent.fg }}
    >
      {isMine ? <span className="org-me-badge">(You)</span> : null}
      <span className="org-icon-badge" style={{ color: accent.fg, background: accent.bg }}>
        <Icon size={20} />
      </span>
      <p className="org-vbox-title">{vertical.name}</p>
      <p className="org-vbox-led" style={{ color: accent.fg }}>
        {lead ? `Led by ${lead.full_name}` : 'Lead unassigned'}
        {coLead ? ` · Co-led by ${coLead.full_name}` : ''}
      </p>
      <RosterList roster={roster} vertical={vertical} meId={meId} />
    </div>
  );
});

export default function OrgChart({ me }) {
  const navigate = useNavigate();

  const director = users.find((u) => u.role === 'director');
  const thematic = verticals.filter((v) => v.type === 'thematic');
  const crosscutting = verticals.filter((v) => v.type === 'crosscutting');
  // Communications (support) sits as a normal box alongside the thematic
  // verticals — it only serves its own function, not the whole org, so it
  // doesn't get the wrap-around frame treatment.
  const support = verticals.filter((v) => v.type === 'support');
  const mainRow = [...thematic, ...support];
  // Administration wraps the whole chart as an outer frame instead — unlike
  // Communications, admin genuinely keeps every team running ("without them
  // the work won't even happen in office," per the user), so it's modeled
  // as touching everything rather than sitting beside the Director or inside
  // the regular team row.
  const administration = verticals.filter((v) => v.type === 'administration');
  const contributors = orgWideContributors();

  // "Belongs to" for highlight purposes = member of (home + extra) OR
  // leads it — a lead/co-lead should see their own team highlighted even
  // when it isn't their formally-declared home vertical.
  const myTeamIds = new Set([
    ...allTeamsOf(me.id).map((v) => v.id),
    ...verticals.filter((v) => v.lead_id === me.id || v.co_lead_id === me.id).map((v) => v.id),
  ]);

  const frameIsMine = administration.some((v) => myTeamIds.has(v.id));
  const legendLabel = administration.length
    ? administration
        .map((v) => {
          const roster = membersOfVertical(v.id);
          const names = roster
            .map((p) => p.full_name + (p.id === v.lead_id ? ' (lead)' : ''))
            .join(', ');
          return `${v.name} — ${names || 'no one assigned yet'}`;
        })
        .join('  ·  ')
    : null;

  const rowRef = useRef(null);
  const boxRefs = useRef([]);
  boxRefs.current = [];
  const centers = useBoxCenters(rowRef, boxRefs, [mainRow.length]);
  const barGeometry = centers
    ? { left: centers[0], width: centers[centers.length - 1] - centers[0] }
    : null;

  return (
    <div className="app org-chart-shell stack" style={{ gap: 28 }}>
      <div className="between">
        <div className="row" style={{ gap: 12 }}>
          <span className="org-title-bar" />
          <div>
            <h1>Org Chart</h1>
            <p className="small muted">How ACPET's teams and people fit together.</p>
          </div>
        </div>
        <button
          onClick={() => {
            // Not just isOrgWideRole(me.role) ? '/director' : '/employee' —
            // that predates the section-51 three-way split and would bounce
            // a vertical_lead/co_lead/senior_research_lead through /employee
            // first (RequireRole redirects them on to /lead anyway, but
            // there's no reason to take the detour).
            if (me.role === 'director') navigate('/director');
            else if (me.role === 'employee') navigate('/employee');
            else navigate('/lead');
          }}
        >
          ← Back
        </button>
      </div>

      <div className={`org-frame${frameIsMine ? ' me' : ''}`}>
        {legendLabel ? (
          <div className="org-admin-badge">
            <IconGroup size={15} />
            <span>{legendLabel}</span>
          </div>
        ) : null}

        {director ? (
          <div className="org-director-row">
            <div className={`org-node static${me.id === director.id ? ' me' : ''}`}>
              {me.id === director.id ? <span className="org-me-badge">(You)</span> : null}
              <div className="org-director-inner">
                <Avatar user={director} size={44} />
                <div>
                  <p className="org-vbox-title" style={{ marginTop: 0 }}>
                    {director.full_name}
                  </p>
                  {director.job_title !== ROLE_LABEL[director.role] ? (
                    <p className="tiny muted">{director.job_title}</p>
                  ) : null}
                  <p className="org-role-tag">{ROLE_LABEL[director.role]}</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="org-connector">
          <div className="org-connector-stem" />
          {barGeometry ? (
            <>
              <div className="org-connector-bar" style={{ left: barGeometry.left, width: barGeometry.width }} />
              {mainRow.map((v, i) => (
                <span key={v.id} className="org-connector-tick" style={{ left: centers[i] }} />
              ))}
            </>
          ) : null}
        </div>

        <div
          ref={rowRef}
          className="org-verticals-row"
          style={{ gridTemplateColumns: `repeat(${mainRow.length}, 1fr)` }}
        >
          {mainRow.map((v, i) => (
            <VerticalBox
              key={v.id}
              ref={(el) => (boxRefs.current[i] = el)}
              vertical={v}
              myTeamIds={myTeamIds}
              meId={me.id}
              accent={ORG_ACCENTS[i % ORG_ACCENTS.length]}
              style={{ animationDelay: `${i * 0.06}s` }}
            />
          ))}
        </div>

        {crosscutting.length ? (
          <>
            <div className="org-connector up">
              <div className="org-connector-stem" />
              {barGeometry ? (
                <>
                  <div className="org-connector-bar" style={{ left: barGeometry.left, width: barGeometry.width }} />
                  {mainRow.map((v, i) => (
                    <span key={v.id} className="org-connector-tick" style={{ left: centers[i] }} />
                  ))}
                </>
              ) : null}
            </div>

            {crosscutting.map((v, i) => {
              const lead = getUser(v.lead_id);
              const roster = membersOfVertical(v.id);
              const isMine = myTeamIds.has(v.id);
              return (
                <div
                  key={v.id}
                  className={`org-efl-band${isMine ? ' me' : ''}`}
                  style={{ marginTop: 4, animationDelay: `${(mainRow.length + i) * 0.06}s` }}
                >
                  {isMine ? <span className="org-me-badge">(You)</span> : null}
                  <div className="org-efl-header">
                    <span className="org-icon-badge org-icon-badge-lg" style={{ color: 'var(--amber-fg)', background: 'var(--amber-bg)' }}>
                      <IconBulb size={26} />
                    </span>
                    <div className="org-efl-text">
                      <p className="org-vbox-title">{v.name}</p>
                      <p className="org-vbox-led" style={{ color: 'var(--amber-fg)' }}>
                        {lead ? `Led by ${lead.full_name}` : 'Lead unassigned'}
                      </p>
                    </div>
                  </div>
                  <RosterList roster={roster} vertical={v} meId={me.id} horizontal />
                </div>
              );
            })}
          </>
        ) : null}

        <div className="org-legend-bar">
          <span className="org-legend-item">
            <IconStar size={14} /> Leads &amp; Directors
          </span>
          <span className="org-legend-item">
            <IconGroup size={14} /> Teams
          </span>
          <span className="org-legend-item">
            <IconBulb size={14} /> Cross-cutting Lab
          </span>
        </div>
      </div>

      {contributors.length ? (
        <div className="org-contributors">
          <p
            className="tiny muted"
            style={{ textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}
          >
            Org-wide contributors
          </p>
          <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
            {contributors.map((p) => (
              <div
                key={p.id}
                className={`org-node dashed${p.id === me.id ? ' me' : ''}`}
                style={{ minWidth: 200 }}
              >
                {p.id === me.id ? <span className="org-me-badge">(You)</span> : null}
                <Avatar user={p} size={30} />
                <p className="org-vbox-title" style={{ marginTop: 6 }}>
                  {p.full_name}
                </p>
                <p className="tiny muted">{p.job_title}</p>
                <p className="tiny dim" style={{ marginTop: 4 }}>
                  Works across every team
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
