import { supabase } from './lib/supabaseClient.js';

// Mock data layer.
//
// Every object here matches the column names in the planned Postgres schema,
// so replacing this file with Supabase queries should not require touching
// any component. Read the exported selectors at the bottom — those are the
// only things components import.

// Real ACPET verticals + people, corrected 2026-07-29. `type` distinguishes
// a thematic vertical from the crosscutting lab, from a support function
// (e.g. Communications), from administration (Executive Assistant to the
// Director — a peer function alongside the Director, not a team under
// them) — all four share the same lead/roster shape.
// `is_crosscutting` is kept alongside `type` for backward compatibility with
// existing code that already reads it. Leads left `null` are explicitly
// "don't know yet" per the user, not oversights — do not fill these in with
// a guess.
export const verticals = [
  { id: 'v1', name: 'People-centric Power Reform', lead_id: 'u2', co_lead_id: null, is_crosscutting: false, type: 'thematic' },
  { id: 'v2', name: 'Critical Minerals & Circular Economy', lead_id: 'u4', co_lead_id: 'u5', is_crosscutting: false, type: 'thematic' },
  { id: 'v3', name: 'Coal Transition', lead_id: 'u6', co_lead_id: null, is_crosscutting: false, type: 'thematic' },
  { id: 'v4', name: 'Social Impact of Energy Transition', lead_id: null, co_lead_id: null, is_crosscutting: false, type: 'thematic' },
  { id: 'v5', name: 'Energy Futures Lab', lead_id: 'u6', co_lead_id: null, is_crosscutting: true, type: 'crosscutting' },
  { id: 'v6', name: 'Communications', lead_id: 'u13', co_lead_id: null, is_crosscutting: false, type: 'support' },
  { id: 'v7', name: 'Administration', lead_id: 'u15', co_lead_id: null, is_crosscutting: false, type: 'administration' },
];

// Valid values for user.role, in ascending order of privilege:
// 'employee' < 'vertical_lead' / 'co_lead' (equivalent scope: their own
// team's people/items, distinct titles) < 'senior_research_lead' (org-wide
// read, same as director, but write actions scoped to their own teams — see
// canActOnItem — and no budget/people-admin) < 'director'
//
// job_title is a separate free-text field for the person's actual
// designation (Senior Research Fellow, Research Associate, Junior Research
// Associate, Manager - Communications, Research Manager, Executive
// Assistant, Communication Associate, Consultant, etc.) — it does not
// affect permissions. 'role' is the only field that does.
//
// Emails are placeholders (firstname@ashoka.edu.in) — real addresses
// weren't provided yet, only names/titles/reporting lines. Swap these for
// the real thing once known; nothing else references the email format.
//
// qualifications and phone are optional, self-reported profile fields (edited
// from the profile panel); omitted here since they start blank for everyone.
export const users = [
  {
    id: 'u1',
    email: 'vaibhav.chowdary@ashoka.edu.in',
    full_name: 'Mr. Vaibhav Chowdary',
    job_title: 'Director',
    role: 'director',
    vertical_id: null,
    reports_to: null,
  },
  {
    id: 'u2',
    email: 'gaurav.bhatiani@ashoka.edu.in',
    full_name: 'Dr. Gaurav Bhatiani',
    job_title: 'Senior Fellow',
    role: 'vertical_lead',
    vertical_id: 'v1',
    reports_to: 'u1',
  },
  {
    // Also a member of Energy Futures Lab (v5) alongside her primary team
    // here — see verticalMemberships below. reports_to stays u2: the second
    // team is a membership fact, not a reporting-line change.
    id: 'u3',
    email: 'navya@ashoka.edu.in',
    full_name: 'Ms. Navya',
    job_title: 'Research Associate',
    role: 'employee',
    vertical_id: 'v1',
    reports_to: 'u2',
  },
  {
    id: 'u4',
    email: 'animesh.ghosh@ashoka.edu.in',
    full_name: 'Dr. Animesh Ghosh',
    job_title: 'Senior Research Fellow',
    role: 'vertical_lead',
    vertical_id: 'v2',
    reports_to: 'u1',
  },
  {
    id: 'u5',
    email: 'upasna.ranjan@ashoka.edu.in',
    full_name: 'Mrs. Upasna Ranjan',
    job_title: 'Co-lead',
    role: 'co_lead',
    vertical_id: 'v2',
    reports_to: 'u4',
  },
  {
    // Research Lead, org-wide — same access tier as the Director minus
    // budget + People & roles admin (see canSeeBudget / ORG_WIDE_ROLES
    // below). Leads both Energy Futures Lab (v5) and Coal Transition (v3).
    // His org-wide *read* access is unrestricted, but write actions (assign,
    // comment) are scoped to teams he actually leads/belongs to — see
    // canActOnItem below.
    id: 'u6',
    email: 'anandajit.goswami@ashoka.edu.in',
    full_name: 'Dr. Anandajit Goswami',
    job_title: 'Research Lead',
    role: 'senior_research_lead',
    vertical_id: 'v5',
    reports_to: 'u1',
  },
  {
    id: 'u7',
    email: 'saptarshi.poddar@ashoka.edu.in',
    full_name: 'Mr. Saptarshi Poddar',
    job_title: 'Junior Research Associate',
    role: 'employee',
    vertical_id: 'v5',
    reports_to: 'u6',
  },
  {
    // Real email confirmed by the person themselves 2026-07-30 (was a
    // firstname.lastname@ashoka.edu.in placeholder) — the first real login
    // account, created via scripts/create-accounts.mjs.
    id: 'u8',
    email: 'jolinson.dass@ashoka.edu.in',
    full_name: 'Mr. Jolinson Richi',
    job_title: 'Junior Research Associate',
    role: 'employee',
    vertical_id: 'v5',
    reports_to: 'u6',
  },
  // u9-u11: confirmed 2026-07-29 as Coal Transition (v3) members, led by
  // Goswami.
  {
    id: 'u9',
    email: 'aishwarya.ramachandran@ashoka.edu.in',
    full_name: 'Dr. Aishwarya Ramachandran',
    job_title: 'Research Manager',
    role: 'employee',
    vertical_id: 'v3',
    reports_to: 'u6',
  },
  {
    id: 'u10',
    email: 'amrapali.tiwari@ashoka.edu.in',
    full_name: 'Dr. Amrapali Tiwari',
    job_title: 'Research Associate',
    role: 'employee',
    vertical_id: 'v3',
    reports_to: 'u6',
  },
  {
    id: 'u11',
    email: 'anvesha.adhikari@ashoka.edu.in',
    full_name: 'Ms. Anvesha S Adhikari',
    job_title: 'Research Associate',
    role: 'employee',
    vertical_id: 'v3',
    reports_to: 'u6',
  },
  {
    // Moved into Social Impact of Energy Transition (v4) as a plain member
    // 2026-07-30, per the user — the vertical's lead stays unassigned
    // (unaffected by this). No longer an org-wide contributor now that he
    // has a home team; reports_to stays null since his reporting line
    // wasn't stated (not guessed).
    id: 'u12',
    email: 'shubham.jain@ashoka.edu.in',
    full_name: 'Dr. Shubham Jain',
    job_title: 'Research Associate',
    role: 'employee',
    vertical_id: 'v4',
    reports_to: null,
  },
  {
    // Leads Communications (v6) — role bumped from 'employee' to
    // 'vertical_lead' since she genuinely manages Bipashna (u14); previously
    // her plain 'employee' role meant visibleUsers/visibleItems returned
    // nothing for her despite the real reporting line already being set.
    id: 'u13',
    email: 'piya.srinivasan@ashoka.edu.in',
    full_name: 'Dr. Piya Srinivasan',
    job_title: 'Manager, Communications',
    role: 'vertical_lead',
    vertical_id: 'v6',
    reports_to: 'u1',
  },
  {
    id: 'u14',
    email: 'bipashna.sharma@ashoka.edu.in',
    full_name: 'Ms. Bipashna Sharma',
    job_title: 'Communications Associate',
    role: 'employee',
    vertical_id: 'v6',
    reports_to: 'u13',
  },
  {
    // Leads the new Administration team (v7) — added 2026-07-30. Reports
    // directly to the Director (an Executive Assistant's natural reporting
    // line) even though Administration renders as a peer to the Director in
    // the org chart, not nested under the verticals — those are two
    // different things (reporting line vs. visual placement).
    id: 'u15',
    email: 'c.surendran@ashoka.edu.in',
    full_name: 'C Surendran',
    job_title: 'Executive Assistant',
    role: 'vertical_lead',
    vertical_id: 'v7',
    reports_to: 'u1',
  },
  {
    // Added 2026-07-31, explicitly project-basis per the user: no home
    // vertical at all, on purpose — they work across whichever projects
    // they're assigned to rather than belonging to one team. reports_to
    // left null since it wasn't stated (not guessed), same convention as
    // u12 above.
    id: 'u16',
    email: 'katelyn.patta@ashoka.edu.in',
    full_name: 'Ms. Katelyn Patta',
    job_title: 'Junior Research Associate',
    role: 'employee',
    vertical_id: null,
    reports_to: null,
  },
  {
    id: 'u17',
    email: 'varusha.khare@ashoka.edu.in',
    full_name: 'Ms. Varusha Khare',
    job_title: 'Junior Research Associate',
    role: 'employee',
    vertical_id: null,
    reports_to: null,
  },
];

// Extra (non-primary) team memberships — a person's *primary* team is still
// users[].vertical_id; this only records additional teams they also belong
// to. Mirrors workItemVerticals's join-table shape/pattern below.
// Shape: { vertical_id, user_id }.
export const verticalMemberships = [
  { vertical_id: 'v5', user_id: 'u3' }, // Navya — also on Energy Futures Lab, alongside her primary team (v1)
];

// No real project/paper/proposal data has been provided yet — left empty
// rather than filled with placeholder examples, since that would misattribute
// invented work to real named people above. Add real work items here once
// they're known; every screen already handles the empty state correctly.
export const workItems = [];
export const members = [];

// Many-to-many: a work item can be jointly owned by more than one vertical
// (e.g. a project both Energy Futures Lab and Power sector are running) —
// this is the first-class fact that replaced a single `owning_vertical`
// field. Shape: { work_item_id, vertical_id }.
export const workItemVerticals = [];

// week_of is the Monday of the week the update covers.
export const checkins = [];

// Freeform "anything else for ACPET's growth" notes — not tied to a status
// pipeline, not a work_item. Shape: { id, author_id, body,
// work_item_id (nullable — optional tag to a related item), created_at }.
// created_at anchors to CURRENT_WEEK, same as the rest of the mock — never a
// live `new Date()`, since same-session notes can't be meaningfully
// time-sorted anyway (see visibleNotes callers, which sort by insertion order).
export const comments = [];

export const notifications = [];

// current week, hardcoded for the mock
export const CURRENT_WEEK = '2026-07-27';

// Work location tracker (2026-07-31) — built UI-first against this array
// mock-only, confirmed working, then wired to a real table (migration
// 0014) the same session. Real rows merge into this array exactly like
// every other feature here (_real-tagged, syncWorkLocations below), so
// every existing consumer (locationOn, the WorkLocation component) keeps
// working unchanged.
export const WORK_LOCATIONS = {
  office_1: { label: 'Tata Smart Grid Lab', tone: 'blue' },
  office_2: { label: 'Okhla Office', tone: 'amber' },
  wfh: { label: 'WFH', tone: 'green' },
};

// { id, user_id, date ('YYYY-MM-DD'), location (a WORK_LOCATIONS key) } — one
// row per person per day, upserted by setWorkLocation below.
export const workLocations = [];
let nextWorkLocationSeq = 1;

// Local calendar date as 'YYYY-MM-DD' — not `toISOString().slice(0, 10)`,
// which converts to UTC first and can silently shift the date by a day
// depending on the browser's timezone. Everything here works in the
// viewer's own local calendar day, not UTC.
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Monday of the week containing `d` — takes a Date in, rather than reaching
// for `new Date()` itself, same "never a live clock inside data.js, the
// caller computes `now` once" rule formatRelativeTime/isFridayReminderWindow
// already established; the component computes today's real date once and
// passes it in.
export function mondayOf(d) {
  const x = new Date(d);
  const day = x.getDay(); // 0 = Sunday .. 6 = Saturday
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

// The 5 weekday dates (Mon-Fri), as 'YYYY-MM-DD', for the week starting at
// `monday` (pass mondayOf's own output straight in).
export function weekdayDates(monday) {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return isoDate(d);
  });
}

export function locationOn(userId, dateIso) {
  return workLocations.find((w) => w.user_id === userId && w.date === dateIso)?.location ?? null;
}

// Sets, changes, or (passing null) clears the given person's location for
// one day. Self-only by construction — the UI only ever calls this for the
// signed-in viewer's own id, and work_locations_update_own/insert_own/
// delete_own (migration 0014) enforce the same thing server-side.
export async function setWorkLocation(userId, dateIso, location) {
  const idx = workLocations.findIndex((w) => w.user_id === userId && w.date === dateIso);
  const isRealSelf = realAuthContext && userId === realAuthContext.mockUserId;

  if (isRealSelf) {
    if (!location) {
      const { error } = await supabase
        .from('work_locations')
        .delete()
        .eq('user_id', realAuthContext.authId)
        .eq('date', dateIso);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('work_locations')
        .upsert({ user_id: realAuthContext.authId, date: dateIso, location }, { onConflict: 'user_id,date' });
      if (error) throw error;
    }
  }

  if (!location) {
    if (idx >= 0) workLocations.splice(idx, 1);
    return;
  }
  if (idx >= 0) {
    workLocations[idx] = { ...workLocations[idx], location, _real: !!isRealSelf };
  } else {
    workLocations.push({
      id: `wl-local-${nextWorkLocationSeq++}`,
      user_id: userId,
      date: dateIso,
      location,
      _real: !!isRealSelf,
    });
  }
}

// helpers -------------------------------------------------------------

// vertical_lead's label is generic "Team lead" since this role now covers
// leads of any team type — thematic vertical, crosscutting lab, or support
// function (e.g. Communications) — not just thematic verticals.
export const ROLE_LABEL = {
  director: 'Director',
  senior_research_lead: 'Senior research lead',
  vertical_lead: 'Team lead',
  co_lead: 'Co-lead',
  employee: 'Employee',
};

export const ROLE_TONE = {
  director: 'red',
  senior_research_lead: 'blue',
  vertical_lead: 'violet',
  co_lead: 'amber',
  employee: '',
};

export const TYPE_LABELS = {
  project: { singular: 'project', plural: 'Projects', tone: 'green' },
  paper: { singular: 'paper', plural: 'Papers', tone: 'blue' },
  proposal: { singular: 'proposal', plural: 'Proposals', tone: 'amber' },
  blue_sky_idea: { singular: 'blue-sky idea', plural: 'Blue sky', tone: 'violet' },
};

// Canonical type order for tab strips/aggregate loops — matches the Vertical
// Dashboard's explicit nav order (Projects, Proposals, Papers, Blue-sky).
// Shared between WorkWorkspace.jsx's per-type boards and VerticalOverview.jsx's
// snapshot metrics so both iterate the same order and neither keeps its own
// copy.
export const WORK_TYPES = ['project', 'proposal', 'paper', 'blue_sky_idea'];

// Terminal status per type — used for "Completed"/"Pending" summary counts.
// There's no completed_at timestamp anywhere in this schema, so a "Completed
// this month" figure was simplified to a plain running count rather than
// fabricating a time window the data can't actually support yet.
const TERMINAL_STATUS = { project: 'Complete', paper: 'Published', proposal: 'Awarded', blue_sky_idea: 'Implemented' };
export function isCompleted(item) {
  return item.status === TERMINAL_STATUS[item.type];
}

// Abbreviations for compact "N items" table cells (Team/Director tables).
export const TYPE_ABBR = { project: 'P', paper: 'Pa', proposal: 'Pr', blue_sky_idea: 'BS' };

// Display label + pill tone for a team's `type` field (thematic vertical,
// crosscutting lab, or support function) — shared by the org chart and the
// Director's Employees tab so the two don't drift into different wording.
export const TEAM_TYPE_META = {
  thematic: { label: 'Thematic vertical', tone: 'violet' },
  crosscutting: { label: 'Crosscutting lab', tone: 'amber' },
  support: { label: 'Support function', tone: 'green' },
  administration: { label: 'Administration', tone: 'red' },
};

// Renders a countsByType() result as "2P · 1Pa · 3BS", skipping zero counts —
// shared by every table that shows a per-person item breakdown, so a new
// type only needs a TYPE_ABBR entry, not a hunt through every call site.
export function formatCounts(counts) {
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([type, n]) => `${n}${TYPE_ABBR[type]}`);
  return parts.length ? parts.join(' · ') : '—';
}

const AVATAR_TONES = ['violet', 'blue', 'green', 'amber', 'red'];

export function toneForUser(userId) {
  const i = users.findIndex((u) => u.id === userId);
  return AVATAR_TONES[(i < 0 ? 0 : i) % AVATAR_TONES.length];
}

export function initials(name) {
  return name
    .replace(/^(Dr\.|Mr\.|Ms\.|Mrs\.)\s+/i, '')
    .replace(/\s*\(.*\)\s*$/, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function getUser(id) {
  return users.find((u) => u.id === id) || null;
}

// Bridges a real Supabase Auth session to this mock's data model: once
// someone is genuinely authenticated, the rest of the app still reads role/
// vertical/reporting-line from this mock (the "swap every selector for a
// live query" pass is separate, still-deferred work — see context.md) — so
// App.jsx looks up the signed-in email here to get the `me` object every
// other screen already expects.
export function getUserByEmail(email) {
  const target = email.trim().toLowerCase();
  return users.find((u) => u.email.toLowerCase() === target) || null;
}

export function getVertical(id) {
  return verticals.find((v) => v.id === id) || null;
}

export function verticalName(id) {
  return getVertical(id)?.name ?? '—';
}

// Defensive: a person should never be shown as both lead and contributor on
// the same item at once (the real `members` table's primary key is
// (work_item_id, user_id), so this can't happen in the live database — but
// stale/duplicate local rows from an in-progress session could still produce
// it, which is exactly the "same member listed twice with two different
// roles" redundancy this collapses). When two rows exist for one user on one
// item, "lead" wins rather than showing both.
function dedupeByUser(rows) {
  const byUser = new Map();
  for (const m of rows) {
    const existing = byUser.get(m.user_id);
    if (!existing || (existing.role_on_item !== 'lead' && m.role_on_item === 'lead')) {
      byUser.set(m.user_id, m);
    }
  }
  return [...byUser.values()];
}

export function membersOf(workItemId) {
  return dedupeByUser(members.filter((m) => m.work_item_id === workItemId))
    .map((m) => ({ ...m, user: getUser(m.user_id) }))
    .filter((m) => m.user);
}

// The verticals that jointly own a work item (see workItemVerticals above).
export function verticalsOf(workItemId) {
  return workItemVerticals
    .filter((wv) => wv.work_item_id === workItemId)
    .map((wv) => getVertical(wv.vertical_id))
    .filter(Boolean);
}

// A person's teams *beyond* their primary one (see verticalMemberships above).
export function extraVerticalsOf(userId) {
  return verticalMemberships
    .filter((vm) => vm.user_id === userId)
    .map((vm) => getVertical(vm.vertical_id))
    .filter(Boolean);
}

// Every team a person belongs to — primary first, then extras, deduped.
export function allTeamsOf(userId) {
  const user = getUser(userId);
  const primary = user?.vertical_id ? getVertical(user.vertical_id) : null;
  const extras = extraVerticalsOf(userId);
  const seen = new Set(primary ? [primary.id] : []);
  const teams = primary ? [primary] : [];
  for (const v of extras) {
    if (!seen.has(v.id)) {
      seen.add(v.id);
      teams.push(v);
    }
  }
  return teams;
}

// Every person on a team — those with it as their primary vertical, union
// those with it as an extra membership (e.g. Navya shows up on both her
// primary team's roster and Energy Futures Lab's).
export function membersOfVertical(verticalId) {
  const primary = users.filter((u) => u.vertical_id === verticalId);
  const extraUserIds = verticalMemberships
    .filter((vm) => vm.vertical_id === verticalId)
    .map((vm) => vm.user_id);
  const extra = users.filter(
    (u) => extraUserIds.includes(u.id) && !primary.some((p) => p.id === u.id)
  );
  return [...primary, ...extra];
}

// People who work across every vertical rather than belonging to one.
export function orgWideContributors() {
  return users.filter((u) => u.is_org_wide_contributor);
}

export function itemsForUser(userId) {
  // Deduped by work_item_id for the same reason membersOf dedupes by
  // user_id — one person, one item, one role shown, never two.
  const byItem = new Map();
  for (const m of members.filter((m) => m.user_id === userId)) {
    const existing = byItem.get(m.work_item_id);
    if (!existing || (existing.role_on_item !== 'lead' && m.role_on_item === 'lead')) {
      byItem.set(m.work_item_id, m);
    }
  }
  return [...byItem.values()]
    .map((m) => ({
      ...workItems.find((w) => w.id === m.work_item_id),
      role_on_item: m.role_on_item,
    }))
    .filter((w) => w.id);
}

let nextWorkItemSeq = 1;

// Bridges a real signed-in Supabase session to this mock's user id — set
// once by App.jsx right after a real sign-in (see handleSignedIn), read by
// addWorkItem/syncRealWorkItems/deleteWorkItem below. This is deliberately a
// narrow bridge, not the full "swap every selector for a live query" rewrite
// (still separate, deferred work) — real rows get merged into these same
// mock arrays (tagged `_real: true`) so every existing selector/component
// (itemsForUser, visibleItems, WorkItemCard, Overview, AddWork, ...) keeps
// working completely unchanged; only add/delete/sync know the difference.
let realAuthContext = null; // { authId, mockUserId, verticalId }

export function setRealAuthContext(ctx) {
  realAuthContext = ctx;
}

// Pulls every real work item *this session's RLS can see* (just the
// viewer's own items for an employee; everything, org-wide, for a director/
// senior_research_lead — RLS decides, this query applies no extra filter of
// its own) and merges them into the mock workItems/members/workItemVerticals
// arrays. Real member rows and real owning-verticals both get mapped back to
// their *mock* equivalents (by email, and by team name respectively) so
// existing mock-keyed selectors (itemsForUser, verticalsOf, membersOf, ...)
// resolve them correctly regardless of who authored the item — not just the
// syncing viewer. Safe to call more than once — any previously-synced real
// rows are dropped and re-merged first, so it can't duplicate.
export async function syncRealWorkItems() {
  if (!realAuthContext) return;
  const { mockUserId } = realAuthContext;

  const [{ data: rows, error }, { data: realVerticals }] = await Promise.all([
    supabase
      .from('work_items')
      .select(
        '*, members(user_id, role_on_item, responsibility, target_date, assigned_at, assigned_by, profiles!members_user_id_fkey(email)), work_item_verticals(vertical_id, verticals(name))'
      )
      .order('created_at', { ascending: false }),
    supabase.from('verticals').select('id, name'),
  ]);
  if (error) {
    console.error('syncRealWorkItems failed:', error.message);
    return;
  }

  // Real team UUID -> this mock's matching vertical id, matched by name —
  // the live `verticals` table and this mock's `verticals` array are seeded
  // with the same real team names (see scripts/seed-teams.mjs).
  const realVerticalIdToMockId = new Map();
  for (const rv of realVerticals ?? []) {
    const mockV = verticals.find((v) => v.name === rv.name);
    if (mockV) realVerticalIdToMockId.set(rv.id, mockV.id);
  }

  for (let i = workItems.length - 1; i >= 0; i--) {
    if (workItems[i]._real) workItems.splice(i, 1);
  }
  for (let i = members.length - 1; i >= 0; i--) {
    if (members[i]._real) members.splice(i, 1);
  }
  for (let i = workItemVerticals.length - 1; i >= 0; i--) {
    if (workItemVerticals[i]._real) workItemVerticals.splice(i, 1);
  }

  for (const row of rows ?? []) {
    const { members: realMembers, work_item_verticals: realWiv, ...item } = row;
    workItems.push({ ...item, _real: true });

    for (const m of realMembers ?? []) {
      const mockPerson = m.profiles?.email ? getUserByEmail(m.profiles.email) : null;
      // A real member whose profile email doesn't match any of the 15 known
      // people (a stray/unmapped real account) is skipped entirely rather
      // than attributed to the syncing viewer. That fallback used to exist
      // ("better than silently dropping the row") but it's actively wrong:
      // if the syncing viewer is *also* a genuine member of this same item,
      // it produces a real duplicate (work_item_id, user_id) entry — their
      // own row plus this misattributed one — which is exactly the bug that
      // surfaced as a duplicate-key warning (and, worse, would misattribute
      // a stranger's real comments/updates as if the viewer had posted
      // them). Not being able to display someone we can't map to a known
      // person is the correct, safe behavior here, not a guess.
      if (!mockPerson) continue;
      members.push({
        work_item_id: item.id,
        user_id: mockPerson.id,
        role_on_item: m.role_on_item,
        responsibility: m.responsibility,
        target_date: m.target_date,
        assigned_at: m.assigned_at,
        assigned_by: m.assigned_by,
        _real: true,
      });
    }

    for (const wv of realWiv ?? []) {
      const mockVerticalId = realVerticalIdToMockId.get(wv.vertical_id);
      if (mockVerticalId) {
        workItemVerticals.push({ work_item_id: item.id, vertical_id: mockVerticalId, _real: true });
      }
    }
  }
}

// Pulls every real comment/growth-note this session's RLS can see (mirrors
// comments_select in 0002_rls_policies.sql) and merges it into the mock
// `comments` array, same _real-tagged merge pattern as syncRealWorkItems.
// author_id comes back as a real profile uuid; mapped to the matching mock
// person by email (profiles!comments_author_id_fkey — Postgres's default
// FK constraint name for comments.author_id, same convention
// members_user_id_fkey already relies on above).
export async function syncRealComments() {
  if (!realAuthContext) return;
  const { data: rows, error } = await supabase
    .from('comments')
    .select('*, profiles!comments_author_id_fkey(email)')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('syncRealComments failed:', error.message);
    return;
  }

  for (let i = comments.length - 1; i >= 0; i--) {
    if (comments[i]._real) comments.splice(i, 1);
  }
  for (const row of rows ?? []) {
    const { profiles, ...note } = row;
    const mockAuthor = profiles?.email ? getUserByEmail(profiles.email) : null;
    // Skip rather than misattribute to the syncing viewer if the real
    // author doesn't map to any of the 15 known people — same reasoning as
    // syncRealWorkItems' member-mapping fix above (the old fallback here
    // could put a stranger's real comment in the viewer's own mouth).
    if (!mockAuthor) continue;
    comments.push({ ...note, author_id: mockAuthor.id, _real: true });
  }
}

// Same shape as syncRealComments, for the contributions table (see
// contributions_select in 0007_comments_contributions_notify.sql).
export async function syncRealContributions() {
  if (!realAuthContext) return;
  const { data: rows, error } = await supabase
    .from('contributions')
    .select('*, profiles!contributions_user_id_fkey(email)')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('syncRealContributions failed:', error.message);
    return;
  }

  for (let i = contributions.length - 1; i >= 0; i--) {
    if (contributions[i]._real) contributions.splice(i, 1);
  }
  for (const row of rows ?? []) {
    const { profiles, ...note } = row;
    const mockUser = profiles?.email ? getUserByEmail(profiles.email) : null;
    // Skip rather than misattribute to the syncing viewer — same reasoning
    // as syncRealWorkItems'/syncRealComments' fixes above.
    if (!mockUser) continue;
    contributions.push({ ...note, user_id: mockUser.id, _real: true });
  }
}

// notifications_select_own (0002) already restricts every row Supabase
// returns here to this session's own auth.uid(), so every row belongs to
// the signed-in viewer — no email lookup needed, just their own mock id.
export async function syncRealNotifications() {
  if (!realAuthContext) return;
  const { data: rows, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('syncRealNotifications failed:', error.message);
    return;
  }

  for (let i = notifications.length - 1; i >= 0; i--) {
    if (notifications[i]._real) notifications.splice(i, 1);
  }
  for (const row of rows ?? []) {
    notifications.push({ ...row, recipient_id: realAuthContext.mockUserId, _real: true });
  }
}

// Single entry point for pulling every real table into the mock layer —
// called on sign-in/session-restore, and available for a manual "Refresh"
// action (see EmployeeHome.jsx/DirectorHome.jsx headers) since none of this
// is wired to live Realtime subscriptions yet, so a second real account's
// changes otherwise only show up on this session's next sign-in or reload.
export async function syncRealData() {
  await Promise.all([
    syncRealWorkItems(),
    syncRealComments(),
    syncRealContributions(),
    syncRealNotifications(),
    syncWorkLocations(),
  ]);
}

// Pulls every real work_locations row (RLS lets everyone read all of
// them — see migration 0014's work_locations_select) and merges it into
// the mock array, same _real-tagged merge/skip-unmapped-author pattern
// syncRealWorkItems/syncRealComments/syncRealContributions already use.
export async function syncWorkLocations() {
  if (!realAuthContext) return;
  const { data: rows, error } = await supabase
    .from('work_locations')
    .select('date, location, profiles!work_locations_user_id_fkey(email)');
  if (error) {
    console.error('syncWorkLocations failed:', error.message);
    return;
  }

  for (let i = workLocations.length - 1; i >= 0; i--) {
    if (workLocations[i]._real) workLocations.splice(i, 1);
  }
  for (const row of rows ?? []) {
    const mockUser = row.profiles?.email ? getUserByEmail(row.profiles.email) : null;
    if (!mockUser) continue;
    workLocations.push({
      id: `wl-real-${mockUser.id}-${row.date}`,
      user_id: mockUser.id,
      date: row.date,
      location: row.location,
      _real: true,
    });
  }
}

async function addRealWorkItem({ type, title, description, target_date, status, progress_note, plan_note, owning_verticals, role_on_item, responsibility }) {
  const { authId, mockUserId } = realAuthContext;

  const { data: item, error } = await supabase
    .from('work_items')
    .insert({
      type,
      title,
      description: description || '',
      status,
      target_date: target_date || null,
      progress_note: progress_note || '',
      plan_note: plan_note || '',
      created_by: authId,
    })
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from('members')
    .insert({ work_item_id: item.id, user_id: authId, role_on_item, responsibility: responsibility || null });

  workItems.push({ ...item, _real: true });
  members.push({ work_item_id: item.id, user_id: mockUserId, role_on_item, responsibility: responsibility || null, _real: true });

  // Defaults to the author's own vertical (mock id) when no explicit list
  // is given, same as the mock path below. Matched to the live table by
  // name (same approach syncRealWorkItems uses) since a work item can now
  // be tagged to more than one vertical at creation, not just the signed-in
  // user's own.
  const mockVerticalIds = owning_verticals ?? (getUser(mockUserId)?.vertical_id ? [getUser(mockUserId).vertical_id] : []);
  if (mockVerticalIds.length) {
    const { data: realVerticals } = await supabase.from('verticals').select('id, name');
    for (const mockVid of mockVerticalIds) {
      const real = realVerticals?.find((rv) => rv.name === verticalName(mockVid));
      if (!real) continue; // no matching live row yet — see scripts/seed-teams.mjs
      await supabase.from('work_item_verticals').insert({ work_item_id: item.id, vertical_id: real.id });
      workItemVerticals.push({ work_item_id: item.id, vertical_id: mockVid, _real: true });
    }
  }

  return item;
}

// Mutates the module-level workItems/members arrays in place and returns the
// new item. Callers must trigger their own re-render (these arrays aren't
// React state) — see EmployeeHome.jsx's bumpItems. Always returns a Promise
// now (awaits a real insert for a real-auth session; resolves immediately
// otherwise) — same shape either way, so call sites just need one `await`.
export async function addWorkItem(
  {
    type,
    title,
    description = '',
    target_date,
    related_work_item_id = null,
    status,
    role_on_item = 'lead',
    responsibility = '',
    progress_note = '',
    plan_note = '',
    owning_verticals,
    // Every other member picked in the New Work wizard's Assign step, each
    // { user_id, role_on_item, responsibility } — the author's own row above
    // is handled separately since it's written at creation time, not via a
    // later assign call.
    initial_member_ids = [],
  },
  authorUserId
) {
  const resolvedStatus = status || STATUS_OPTIONS[type][0];

  let item;
  if (realAuthContext && authorUserId === realAuthContext.mockUserId) {
    item = await addRealWorkItem({
      type,
      title,
      description,
      target_date,
      status: resolvedStatus,
      progress_note,
      plan_note,
      owning_verticals,
      role_on_item,
      responsibility,
    });
  } else {
    const author = getUser(authorUserId);
    item = {
      id: `w-local-${nextWorkItemSeq++}`,
      type,
      title,
      description,
      status: resolvedStatus,
      target_date: target_date || null,
      related_work_item_id: related_work_item_id || null,
      progress_note: progress_note || '',
      plan_note: plan_note || '',
      budget_total: 0,
      budget_spent: 0,
      // Anchors to CURRENT_WEEK, same as every other mock timestamp — needed
      // now so timelineOf() has a "created" event for mock items too (real
      // items already get this for free from Postgres's own default).
      created_at: CURRENT_WEEK,
    };
    workItems.push(item);
    members.push({
      work_item_id: item.id,
      user_id: authorUserId,
      role_on_item,
      responsibility: responsibility || null,
      // null assigned_at/assigned_by = "self-added as author", same
      // convention 0001's schema comment documents for the real table —
      // timelineOf() falls back to the item's own created_at for this row.
      assigned_at: null,
      assigned_by: null,
    });
    // Defaults to the author's own vertical (today's single-vertical
    // behavior) when no explicit list is given — a work item can be linked
    // to more than one vertical via workItemVerticals.
    const verticalIds = owning_verticals ?? (author?.vertical_id ? [author.vertical_id] : []);
    for (const verticalId of verticalIds) {
      workItemVerticals.push({ work_item_id: item.id, vertical_id: verticalId });
    }
  }

  // Cross-vertical members picked at creation time (see assignableUsersFor)
  // — reuses assignWorkItem so real-vs-mock dispatch and the "added you"
  // notification stay in one place regardless of item type.
  for (const m of initial_member_ids) {
    if (m.user_id === authorUserId) continue;
    await assignWorkItem(
      { work_item_id: item.id, user_id: m.user_id, role_on_item: m.role_on_item || 'contributor', responsibility: m.responsibility },
      authorUserId
    );
  }

  return item;
}

// Deletes a work item — real (Supabase, RLS-checked — see migration 0005)
// if it was synced/created for real, mock-only splice otherwise. Either way
// the mock arrays are cleaned up immediately so the UI updates without
// needing a fresh sync.
export async function deleteWorkItem(workItemId) {
  const idx = workItems.findIndex((w) => w.id === workItemId);
  if (idx >= 0 && workItems[idx]._real) {
    // Exact count, not just "no error" — an RLS-blocked delete (no matching
    // policy, or one that doesn't cover this row) isn't a Postgres *error*,
    // it's a normal "matched zero rows" success. A previous attempt at this
    // exact check was reverted mid-session after it appeared to "break" a
    // working delete — turned out the delete was never actually reaching
    // Postgres at all: work_items_delete had gone missing from the live
    // database (found only once this check was reinstated and things it
    // flagged were tracked down for real), so every "successful" delete all
    // session had only ever removed the local copy. Restored properly now
    // that the real policy is confirmed back in place.
    const { error, count } = await supabase
      .from('work_items')
      .delete({ count: 'exact' })
      .eq('id', workItemId);
    if (error) throw error;
    if (!count) throw new Error("Delete didn't go through — you may not have permission to remove this.");
  }

  if (idx >= 0) workItems.splice(idx, 1);
  for (let i = members.length - 1; i >= 0; i--) {
    if (members[i].work_item_id === workItemId) members.splice(i, 1);
  }
  for (let i = workItemVerticals.length - 1; i >= 0; i--) {
    if (workItemVerticals[i].work_item_id === workItemId) workItemVerticals.splice(i, 1);
  }
  for (let i = comments.length - 1; i >= 0; i--) {
    if (comments[i].work_item_id === workItemId) comments[i].work_item_id = null;
  }
}

// Edits an existing item's own fields (title/status/target_date/progress_note/
// plan_note) — real (Supabase, RLS-checked — see migration 0006) if it was
// synced/created for real, mock mutate-in-place otherwise. Never touches
// type/members/verticals — this is a correction, not a re-categorization.
export async function updateWorkItem(workItemId, fields) {
  const idx = workItems.findIndex((w) => w.id === workItemId);
  if (idx < 0) return;

  if (workItems[idx]._real) {
    const { data, error } = await supabase
      .from('work_items')
      .update(fields)
      .eq('id', workItemId)
      .select()
      .single();
    if (error) throw error;
    workItems[idx] = { ...data, _real: true };
  } else {
    Object.assign(workItems[idx], fields);
  }
}

// Whether an item is archived — a hidden-from-the-active-board, recoverable
// state distinct from delete (see deleteWorkItem, which stays a real
// removal). Nothing reads archived_at except the two call sites below and
// WorkWorkspace.jsx's "Show archived" toggle.
export function isArchived(item) {
  return !!item.archived_at;
}

// Archives (or restores) a work item — goes through updateWorkItem so it
// reuses the exact same real-vs-mock branch and the existing
// work_items_update RLS policy (migration 0006: item's creator or a
// director), same as any other field edit. Real items get a true wall-clock
// timestamp (this is a genuine "when did this happen" fact, not a mock
// scenario date); mock items anchor to CURRENT_WEEK like everything else in
// the mock layer.
export async function archiveWorkItem(workItemId, archived) {
  const item = workItems.find((w) => w.id === workItemId);
  if (!item) return;
  const archived_at = archived ? (item._real ? new Date().toISOString() : CURRENT_WEEK) : null;
  await updateWorkItem(workItemId, { archived_at });
}

let nextCommentSeq = 1;

// Looks up a mock user's real profiles.id by email — null if they don't
// have a real account yet. Shared by every real-write path below that
// needs to address someone else (assignWorkItem, notifyMembers): the mock
// `user_id`/`recipientIds` passed around the app are always mock ids, but a
// real RPC/insert needs the real auth uuid.
async function realProfileId(mockUser) {
  if (!mockUser) return null;
  const { data } = await supabase.from('profiles').select('id').eq('email', mockUser.email).maybeSingle();
  return data?.id ?? null;
}

// A growth note (or a plain comment, tied to no particular item) — real
// (Supabase, RLS already allows this as a direct insert — comments_insert_own
// has no work_item_id restriction, see 0002_rls_policies.sql) whenever the
// author has a real session AND the note isn't pinned to a mock-only item
// (can't attach a real row to an item that was never really created);
// mock-only mutate-and-push otherwise, same as always.
export async function addGrowthNote({ body, work_item_id }, authorUserId) {
  const item = work_item_id ? workItems.find((w) => w.id === work_item_id) : null;
  const canGoReal = realAuthContext && authorUserId === realAuthContext.mockUserId && (!work_item_id || item?._real);

  if (canGoReal) {
    const { data, error } = await supabase
      .from('comments')
      .insert({ author_id: realAuthContext.authId, body, work_item_id: work_item_id || null })
      .select()
      .single();
    if (error) throw error;
    const note = { ...data, author_id: authorUserId, _real: true };
    comments.push(note);
    return note;
  }

  const note = {
    id: `c-local-${nextCommentSeq++}`,
    author_id: authorUserId,
    body,
    work_item_id: work_item_id || null,
    created_at: CURRENT_WEEK,
  };
  comments.push(note);
  return note;
}

// Deletes a comment — a growth note (work_item_id null) or a per-item
// comment, same table either way. Real (Supabase, RLS-checked, see migration
// 0010's comments_delete: the author or a director) if it was synced/created
// for real, mock-only splice otherwise. Mirrors deleteWorkItem's own
// real-vs-mock shape exactly. Named generically (not deleteGrowthNote) since
// CommentThread's per-item comments use this too now (2026-07-31) — it was
// never actually growth-note-specific, comments_delete has no work_item_id
// restriction.
export async function deleteComment(commentId) {
  const idx = comments.findIndex((c) => c.id === commentId);
  if (idx >= 0 && comments[idx]._real) {
    // See deleteWorkItem's comment: an exact count catches an RLS-blocked
    // delete masquerading as success (0 rows matched, no error) — this is
    // exactly what surfaced comments_delete having gone missing from the
    // live database for a stretch of this same session.
    const { error, count } = await supabase
      .from('comments')
      .delete({ count: 'exact' })
      .eq('id', commentId);
    if (error) throw error;
    if (!count) throw new Error("Delete didn't go through — you may not have permission to remove this.");
  }
  if (idx >= 0) comments.splice(idx, 1);
}

// Edits a comment/growth note's own text in place — author only (real:
// comments_update_own, migration 0012; comments_update_for_cascade's
// creator-of-the-item rule is a different, unrelated policy for the
// work_item_id-nulling cascade, not user-facing editing).
export async function updateComment(commentId, body) {
  const c = comments.find((c) => c.id === commentId);
  if (!c) return;
  if (c._real) {
    const { error } = await supabase.from('comments').update({ body }).eq('id', commentId);
    if (error) throw error;
  }
  c.body = body;
}

let nextNotificationSeq = 1;

// A senior assigning a work item to someone else. For a real (Supabase-
// backed) item, calls the assign_work_item() RPC in
// supabase/migrations/0002_rls_policies.sql — which upserts the real
// membership and inserts the real notification atomically — provided the
// target already has a real account (looked up by email); otherwise, and
// for every mock item, falls back to the mock-only upsert + notification
// this always did. Same mutate-and-return contract as
// addWorkItem/addGrowthNote either way.
export async function assignWorkItem({ work_item_id, user_id, role_on_item = 'contributor', responsibility }, assignerUserId) {
  const item = workItems.find((w) => w.id === work_item_id);
  const target = getUser(user_id);

  if (item?._real && realAuthContext && target) {
    const profileId = await realProfileId(target);

    if (profileId) {
      const { data, error } = await supabase.rpc('assign_work_item', {
        p_work_item_id: work_item_id,
        p_user_id: profileId,
        p_role_on_item: role_on_item,
        p_responsibility: responsibility || null,
      });
      if (error) throw error;

      // The RPC returns the real members row, `assigned_at` set server-side
      // via now() — use that real timestamp rather than the mock's fixed
      // CURRENT_WEEK constant. Using CURRENT_WEEK here was a real bug: for
      // a real item, item.created_at is a genuine current timestamp, so
      // CURRENT_WEEK ('2026-07-27', a fixed mock date well in the past)
      // sorted *before* it — timelineOf ended up attributing "created this"
      // to whoever was assigned, not whoever actually created the item.
      let row = members.find((m) => m.work_item_id === work_item_id && m.user_id === user_id);
      if (row) {
        Object.assign(row, { role_on_item, responsibility: responsibility || null, assigned_by: assignerUserId, assigned_at: data.assigned_at, _real: true });
      } else {
        row = { work_item_id, user_id, role_on_item, responsibility: responsibility || null, assigned_by: assignerUserId, assigned_at: data.assigned_at, _real: true };
        members.push(row);
      }
      // The RPC already inserts the real "added you" notification
      // server-side — nothing further to push here, unlike the mock
      // fallback below.
      return row;
    }
    // Target has no real account yet — fall through to the mock-only
    // branch so the UI still reflects this locally for the rest of the
    // session; it just won't survive the next syncRealWorkItems() until
    // they get a real account (see scripts/create-accounts.mjs).
  }

  let row = members.find(
    (m) => m.work_item_id === work_item_id && m.user_id === user_id
  );
  if (row) {
    Object.assign(row, {
      role_on_item,
      responsibility: responsibility || null,
      assigned_by: assignerUserId,
      assigned_at: CURRENT_WEEK,
    });
  } else {
    row = {
      work_item_id,
      user_id,
      role_on_item,
      responsibility: responsibility || null,
      assigned_by: assignerUserId,
      assigned_at: CURRENT_WEEK,
    };
    members.push(row);
  }

  const assigner = getUser(assignerUserId);
  notifications.push({
    id: `n-local-${nextNotificationSeq++}`,
    recipient_id: user_id,
    kind: 'added_to_item',
    source_id: work_item_id,
    body: `${assigner?.full_name ?? 'Someone'} added you as ${role_on_item} on "${
      item?.title ?? 'a work item'
    }".`,
    is_read: false,
    created_at: CURRENT_WEEK,
  });
  return row;
}

// A person setting the deadline for their own piece of a project — distinct
// from the item's own single target_date (the overall project deadline,
// set once at creation): "if I'm added for web-portal development, that
// deadline should be set by me," not dictated by whoever created the
// project. Self-only by design (members_update_own, migration 0013) — no
// director override, unlike delete elsewhere in this schema; a deadline for
// your own task isn't something to moderate the way removing content is.
export async function updateMemberDeadline(workItemId, userId, targetDate) {
  const row = members.find((m) => m.work_item_id === workItemId && m.user_id === userId);
  if (!row) return;
  if (row._real && realAuthContext && userId === realAuthContext.mockUserId) {
    const { error } = await supabase
      .from('members')
      .update({ target_date: targetDate || null })
      .eq('work_item_id', workItemId)
      .eq('user_id', realAuthContext.authId);
    if (error) throw error;
  }
  row.target_date = targetDate || null;
}

// Post a comment on a work item AND notify everyone else already on that
// item (excluding the author) — this is what makes a lead's "do it this
// way, show me Wednesday" reply on a member's work item actually land as a
// notification for that member, instead of only being visible if they
// happen to reopen the comment thread. For a real item, calls the
// add_item_comment() RPC (0007_comments_contributions_notify.sql) so the
// insert-and-notify happens atomically for real, same reasoning as
// assignWorkItem; otherwise wraps addGrowthNote + a mock notification push,
// same as this always did.
export async function addItemComment({ body, work_item_id }, authorUserId) {
  const item = workItems.find((w) => w.id === work_item_id);

  if (item?._real && realAuthContext && authorUserId === realAuthContext.mockUserId) {
    const { data, error } = await supabase.rpc('add_item_comment', {
      p_work_item_id: work_item_id,
      p_body: body,
    });
    if (error) throw error;
    const note = { ...data, author_id: authorUserId, _real: true };
    comments.push(note);
    return note;
  }

  const note = await addGrowthNote({ body, work_item_id }, authorUserId);
  const author = getUser(authorUserId);
  const recipientIds = membersOf(work_item_id)
    .map((m) => m.user_id)
    .filter((uid) => uid !== authorUserId);
  for (const uid of recipientIds) {
    notifications.push({
      id: `n-local-${nextNotificationSeq++}`,
      recipient_id: uid,
      kind: 'comment',
      source_id: work_item_id,
      body: `${author?.full_name ?? 'Someone'} commented: "${body}"`,
      is_read: false,
      created_at: CURRENT_WEEK,
    });
  }
  return note;
}

export const contributions = []; // { id, work_item_id, user_id, body, created_at }
let nextContributionSeq = 1;

export function contributionsOn(workItemId) {
  return contributions
    .filter((c) => c.work_item_id === workItemId)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}

// One row per person on the item — their most recent "what I'm working on
// this week" note, in the order they last posted (a fresh post moves to the
// bottom rather than reshuffling the whole list on every render).
export function latestContributionsOn(workItemId) {
  const latest = new Map();
  for (const c of contributionsOn(workItemId)) {
    latest.set(c.user_id, c); // later entries overwrite earlier ones per user
  }
  return [...latest.values()]
    .map((c) => ({ ...c, user: getUser(c.user_id) }))
    .filter((c) => c.user);
}

// A single member's most recent updates *across every item they're on within
// one vertical* (unlike latestContributionsOn, which is one item's updates
// across all its members) — this is what the Vertical Overview's per-person
// activity card needs: "what has this person actually been doing lately,"
// pulled from the same contributions they already post inside each project,
// not a separate thing they enter here (see VerticalOverview.jsx).
export function latestUpdatesForUser(userId, verticalId, limit = 3) {
  return contributions
    .filter((c) => c.user_id === userId)
    .map((c) => ({ ...c, item: workItems.find((w) => w.id === c.work_item_id) }))
    .filter((c) => c.item && verticalsOf(c.item.id).some((v) => v.id === verticalId))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
}

// A member logging their own weekly update on a shared project — distinct
// from the item's single lead-only progress_note/plan_note (see
// WorkItemCard/EditItemForm), so several contributors can each leave their
// own note without overwriting each other's. For a real item, calls the
// add_contribution() RPC (0007_comments_contributions_notify.sql), same
// insert-and-notify-atomically reasoning as addItemComment; otherwise
// mock-only, same as this always did.
export async function addContribution({ work_item_id, body }, authorUserId) {
  const item = workItems.find((w) => w.id === work_item_id);

  if (item?._real && realAuthContext && authorUserId === realAuthContext.mockUserId) {
    const { data, error } = await supabase.rpc('add_contribution', {
      p_work_item_id: work_item_id,
      p_body: body,
    });
    if (error) throw error;
    const note = { ...data, user_id: authorUserId, _real: true };
    contributions.push(note);
    return note;
  }

  const note = {
    id: `k-local-${nextContributionSeq++}`,
    work_item_id,
    user_id: authorUserId,
    body,
    created_at: CURRENT_WEEK,
  };
  contributions.push(note);

  const author = getUser(authorUserId);
  const recipientIds = membersOf(work_item_id)
    .map((m) => m.user_id)
    .filter((uid) => uid !== authorUserId);
  for (const uid of recipientIds) {
    notifications.push({
      id: `n-local-${nextNotificationSeq++}`,
      recipient_id: uid,
      kind: 'contribution',
      source_id: work_item_id,
      body: `${author?.full_name ?? 'Someone'} posted this week's update on "${
        item?.title ?? 'a work item'
      }": "${body}"`,
      is_read: false,
      created_at: CURRENT_WEEK,
    });
  }
  return note;
}

// Edits a contribution's own text in place — author only (real:
// contributions_update_own, migration 0012). Distinct from just posting a
// fresh one via addContribution (that's a new dated log entry, the natural
// "this week's update" flow); this corrects a mistake in an existing entry
// without adding another row or changing whose "latest" it counts as.
export async function updateContribution(contributionId, body) {
  const c = contributions.find((c) => c.id === contributionId);
  if (!c) return;
  if (c._real) {
    const { error } = await supabase.from('contributions').update({ body }).eq('id', contributionId);
    if (error) throw error;
  }
  c.body = body;
}

// Deletes a contribution — real (Supabase, RLS-checked, see migration
// 0012's contributions_delete_own: the author or a director) if it was
// synced/created for real, mock-only splice otherwise. Same real-vs-mock
// shape as deleteComment/deleteWorkItem.
export async function deleteContribution(contributionId) {
  const idx = contributions.findIndex((c) => c.id === contributionId);
  if (idx >= 0 && contributions[idx]._real) {
    const { error, count } = await supabase
      .from('contributions')
      .delete({ count: 'exact' })
      .eq('id', contributionId);
    if (error) throw error;
    if (!count) throw new Error("Delete didn't go through — you may not have permission to remove this.");
  }
  if (idx >= 0) contributions.splice(idx, 1);
}

// A vertical lead/co-lead broadcasting a note to one or more of their own
// vertical's members. For a real sender, resolves each recipient's real
// profile id and calls the notify_members() RPC — anyone in the list
// without a real account yet still gets the mock-only push below so they
// see it locally this session (never both, to avoid a duplicate once a
// real recipient's copy shows up via syncRealNotifications).
export async function notifyMembers({ recipientIds, body }, senderUserId) {
  const sender = getUser(senderUserId);
  let mockOnlyIds = recipientIds;

  if (realAuthContext && senderUserId === realAuthContext.mockUserId) {
    const realIds = [];
    mockOnlyIds = [];
    for (const uid of recipientIds) {
      const profileId = await realProfileId(getUser(uid));
      if (profileId) realIds.push(profileId);
      else mockOnlyIds.push(uid);
    }
    if (realIds.length) {
      const { error } = await supabase.rpc('notify_members', { p_recipient_ids: realIds, p_body: body });
      if (error) throw error;
    }
  }

  for (const uid of mockOnlyIds) {
    notifications.push({
      id: `n-local-${nextNotificationSeq++}`,
      recipient_id: uid,
      kind: 'lead_note',
      source_id: null,
      body: `${sender?.full_name ?? 'Your lead'}: ${body}`,
      is_read: false,
      created_at: CURRENT_WEEK,
    });
  }
}

export function isLeadOn(userId, workItemId) {
  return members.some(
    (m) =>
      m.user_id === userId &&
      m.work_item_id === workItemId &&
      m.role_on_item === 'lead'
  );
}

export function countsByType(userId) {
  const items = itemsForUser(userId);
  const counts = {};
  for (const type of Object.keys(TYPE_LABELS)) {
    counts[type] = items.filter((i) => i.type === type).length;
  }
  return counts;
}

export function lastCheckin(userId) {
  const mine = checkins
    .filter((c) => c.author_id === userId && c.submitted_at)
    .sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1));
  return mine[0] || null;
}

export function daysSinceCheckin(userId, today = CURRENT_WEEK) {
  const last = lastCheckin(userId);
  if (!last) return null;
  const diff =
    (new Date(today).getTime() - new Date(last.submitted_at).getTime()) /
    86400000;
  return Math.max(0, Math.round(diff));
}

export function filedThisWeek(userId, week = CURRENT_WEEK) {
  return checkins.some(
    (c) => c.author_id === userId && c.week_of === week && c.submitted_at
  );
}

export function currentFocus(userId) {
  const last = lastCheckin(userId);
  if (last) return last.update_note;
  const items = itemsForUser(userId);
  return items.length ? items[0].title : 'No work items yet.';
}

export function notificationsFor(userId) {
  return notifications
    .filter((n) => n.recipient_id === userId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

// Every comment tagged to a specific work item — a per-project thread, not
// scoped by the commenter's own vertical/reports-to (unlike visibleNotes).
// Deliberately unfiltered by viewer: whoever can already see the item (i.e.
// its WorkItemCard got rendered at all, via visibleItems) should see every
// comment on it, since a shared project may have contributors from several
// verticals each leaving their own updates.
export function commentsOn(workItemId) {
  return comments
    .filter((c) => c.work_item_id === workItemId)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}

// A single merged, chronological history for a work item's detail page:
// created -> each person added later -> every comment -> every per-person
// weekly update (contributionsOn's full history, not just latestContributionsOn's
// one-per-person snapshot). Deliberately does NOT include a status-change log
// ("Proposal submitted", "Paper published", etc.) — this schema only ever
// stores an item's *current* status, never a timestamped history of past
// values, so fabricating one here would misrepresent data the model doesn't
// actually track (same discipline as WorkWorkspace's "Completed" stat, which
// dropped a fabricated "this month" window for the same reason).
export function timelineOf(workItemId) {
  const item = workItems.find((w) => w.id === workItemId);
  if (!item) return [];

  const memberRows = members
    .filter((m) => m.work_item_id === workItemId)
    .map((m) => ({ ...m, user: getUser(m.user_id), at: m.assigned_at || item.created_at }))
    .filter((m) => m.user && m.at)
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  const events = [];
  // The earliest member row is, by construction (addWorkItem always adds the
  // author as the first member), whoever created the item — folded into one
  // "Created" event instead of a separate "assigned" entry at the same
  // instant, so the founder doesn't appear twice.
  const [founder, ...laterMembers] = memberRows;
  if (founder) {
    events.push({
      kind: 'created',
      at: item.created_at || founder.at,
      user: founder.user,
      role: founder.role_on_item,
      responsibility: founder.responsibility,
    });
  } else if (item.created_at) {
    events.push({ kind: 'created', at: item.created_at, user: null });
  }
  for (const m of laterMembers) {
    events.push({
      kind: 'assigned',
      at: m.at,
      user: m.user,
      role: m.role_on_item,
      responsibility: m.responsibility,
      by: getUser(m.assigned_by),
    });
  }
  for (const c of commentsOn(workItemId)) {
    events.push({ kind: 'comment', at: c.created_at, user: getUser(c.author_id), body: c.body });
  }
  for (const c of contributionsOn(workItemId)) {
    events.push({ kind: 'update', at: c.created_at, user: getUser(c.user_id), body: c.body });
  }

  return events.filter((e) => e.at).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

// Visibility. In production these become RLS policies (see
// supabase/migrations/0002_rls_policies.sql's is_org_wide()/is_lead_tier(),
// kept in sync with these exact two arrays); here they mirror the same
// rules so the UI can be built against realistic data.
//
// Reversed 2026-07-30's section-19 "Admin vs Editor" model per explicit
// direction 2026-07-31: senior_research_lead (currently just Dr. Goswami)
// is scoped exactly like vertical_lead/co_lead now — no more org-wide read.
// "He is another lead, that's it — only Director is the superuser." Only
// the role's ROLE_LABEL/title stays distinct; permissions do not.
// Exported (was unexported) so App.jsx/Overview.jsx/Team.jsx can share these
// instead of each re-deriving their own copy of the same 2-way split.
export const ORG_WIDE_ROLES = ['director'];
export const VERTICAL_LEAD_ROLES = ['vertical_lead', 'co_lead', 'senior_research_lead'];

export function isOrgWideRole(role) {
  return ORG_WIDE_ROLES.includes(role);
}
export function isLeadTierRole(role) {
  return VERTICAL_LEAD_ROLES.includes(role);
}

export function visibleUsers(viewer) {
  if (ORG_WIDE_ROLES.includes(viewer.role)) {
    return users.filter((u) => u.id !== viewer.id);
  }
  if (VERTICAL_LEAD_ROLES.includes(viewer.role)) {
    return users.filter(
      (u) =>
        u.id !== viewer.id &&
        (u.vertical_id === viewer.vertical_id || u.reports_to === viewer.id)
    );
  }
  return [];
}

// Which verticals a viewer leads, co-leads, or belongs to (home + extra) —
// used to scope senior_research_lead's WRITE actions (assign/comment), never
// their READ visibility (visibleItems/visibleUsers/commentsOn stay org-wide/
// unfiltered for this tier — see canActOnItem below). Also the basis of the
// Vertical Lead Portal's own scoping (see verticalsLedBy) — that portal
// deliberately shows only a lead's own team(s), a narrower, presentational
// view than what their read permissions would technically allow.
export function leadershipVerticalIds(viewer) {
  const ids = new Set();
  for (const v of verticals) {
    if (v.lead_id === viewer.id || v.co_lead_id === viewer.id) ids.add(v.id);
  }
  if (viewer.vertical_id) ids.add(viewer.vertical_id);
  for (const v of extraVerticalsOf(viewer.id)) ids.add(v.id);
  return ids;
}

// Full vertical objects for leadershipVerticalIds — e.g. Dr. Goswami leads
// both Coal Transition and Energy Futures Lab, so this returns both; a plain
// vertical_lead gets back exactly their one team. Drives the Vertical Lead
// Portal's per-vertical overview cards and grouped Projects/Proposals tabs.
export function verticalsLedBy(viewer) {
  const ids = leadershipVerticalIds(viewer);
  return verticals.filter((v) => ids.has(v.id));
}

// Which vertical(s) a NEW work item can be explicitly tagged to, in the New
// Work wizard's own Basics step (2026-07-31: brought back as an explicit
// field there per direct correction — deriving it purely from whoever gets
// assigned, tried earlier the same day, wasn't what was actually wanted).
// Every viewer, any role, sees every vertical — the real server-side check
// (wiv_insert in 0002_rls_policies.sql) only ever verifies the work item's
// creator, never which vertical(s) it's tagged to, so restricting this
// client-side would just be a UI limit the backend never enforced.
export function creatableVerticalsFor() {
  return verticals;
}

// Who a viewer can send a broadcast "notify" note to (see notifyMembers).
// director: anyone org-wide — same unrestricted write access as everywhere
// else. senior_research_lead: same own-teams-only scoping as canActOnItem —
// broad read access doesn't extend to messaging every team org-wide.
// vertical_lead/co_lead: unchanged, same as their existing visibleUsers.
export function notifiableUsersFor(viewer) {
  if (viewer.role === 'director') {
    return users.filter((u) => u.id !== viewer.id);
  }
  if (viewer.role === 'senior_research_lead') {
    const scope = leadershipVerticalIds(viewer);
    return users.filter(
      (u) =>
        u.id !== viewer.id &&
        (scope.has(u.vertical_id) || allTeamsOf(u.id).some((v) => scope.has(v.id)))
    );
  }
  return visibleUsers(viewer);
}

// Can viewer take a write action (assign a person, post a comment) on this
// work item? Read access (commentsOn, visibleItems) is NEVER gated by this —
// only posting/assigning. director: unrestricted. senior_research_lead: only
// within teams they lead/belong to, or an item they're already a member of
// — org-wide read access doesn't mean free rein to act on every other
// team's work, per the Director-vs-"Editor" distinction. Everyone else:
// always true here since their own visibleItems scoping already keeps
// out-of-scope items from rendering as a card at all.
export function canActOnItem(viewer, item) {
  if (!viewer) return false;
  if (viewer.role === 'director') return true;
  if (viewer.role === 'senior_research_lead') {
    const scope = leadershipVerticalIds(viewer);
    if (verticalsOf(item.id).some((v) => scope.has(v.id))) return true;
    return members.some((m) => m.work_item_id === item.id && m.user_id === viewer.id);
  }
  return true;
}

// Who a viewer can assign onto a work item. Broadened 2026-07-31, per
// explicit direction that this org runs project-first, not vertical-first:
// "the entire team works on the basis of project... people from any
// vertical" need to be pickable, not just people already tied to the
// item's own vertical(s) or the assigner's own team. The real authority
// check was never here anyway — canActOnItem (which items a lead-tier
// viewer may act on at all) and assign_work_item()'s RPC (which re-checks
// that same authority server-side) never restricted the *target* user's
// vertical, only whether the assigner has standing on the item itself. So
// widening this to the whole org doesn't loosen any actual write
// permission — it only removes a client-side candidate-list filter that
// was stricter than what the backend ever enforced. Employees still get
// nothing (canAssign gates the whole feature before this is ever called).
// Bug fixed 2026-07-31 (same session): this still gated on role — only
// lead-tier/director got any candidates at all, everyone else got an empty
// list. That's still correct for the *post-creation* Assign button
// (Team.jsx's WorkItemCard gates that separately via canAssign, unaffected
// by this function), but wrong for the New Work wizard's own "add people to
// the project I'm creating myself" step — any employee self-logging their
// own work should be able to pull in collaborators on it, org-wide, same as
// everyone else now can. No role check left here at all.
export function assignableUsersFor(viewer) {
  return users.filter((u) => u.id !== viewer.id);
}

export function visibleItems(viewer) {
  if (ORG_WIDE_ROLES.includes(viewer.role)) return workItems;
  if (VERTICAL_LEAD_ROLES.includes(viewer.role)) {
    const reportIds = users
      .filter((u) => u.reports_to === viewer.id)
      .map((u) => u.id);
    return workItems.filter(
      (w) =>
        workItemVerticals.some(
          (wv) => wv.work_item_id === w.id && wv.vertical_id === viewer.vertical_id
        ) ||
        members.some(
          (m) => m.work_item_id === w.id && reportIds.includes(m.user_id)
        )
    );
  }
  return itemsForUser(viewer.id);
}

// Same rollup shape as visibleItems, but scoped through the comment's
// *author* rather than owning_vertical/membership — comments have no vertical
// of their own, only whoever wrote them.
export function visibleNotes(viewer) {
  if (ORG_WIDE_ROLES.includes(viewer.role)) return comments;
  if (VERTICAL_LEAD_ROLES.includes(viewer.role)) {
    const reportIds = users
      .filter((u) => u.reports_to === viewer.id)
      .map((u) => u.id);
    return comments.filter((c) => {
      if (c.author_id === viewer.id || reportIds.includes(c.author_id)) return true;
      const author = getUser(c.author_id);
      return author?.vertical_id === viewer.vertical_id;
    });
  }
  return comments.filter((c) => c.author_id === viewer.id);
}

export function canSeeBudget(viewer) {
  return viewer.role === 'director';
}

export function formatLakh(paise) {
  if (!paise) return '₹0';
  return `₹${(paise / 100000).toFixed(1)}L`;
}

// week_of is always a Monday; the check-in for that week is due the Friday
// that closes it out — i.e. Monday + 4 days.
export function checkinDueDate(weekOf) {
  const d = new Date(weekOf);
  d.setDate(d.getDate() + 4);
  return d.toISOString().slice(0, 10);
}

// Deliberate, isolated exception to "never a live clock": every other date
// in this mock anchors to the fixed CURRENT_WEEK, but a Friday-afternoon
// nudge is meaningless unless it reacts to the real current moment. Takes
// `now` as a param (rather than defaulting to `new Date()` internally) so
// callers/tests can pass a fixed Date and get a deterministic result.
export function isFridayReminderWindow(now) {
  return now.getDay() === 5 && now.getHours() >= 14;
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

// A deliberate, isolated exception to "never a live clock" (same category as
// isFridayReminderWindow above) — a relative-time label ("2 hours ago") is
// meaningless without comparing to the real current moment. Takes `now` as a
// param rather than reaching for `new Date()` internally so callers compute
// it once per render (VerticalOverview.jsx) instead of drifting across many
// cards, and so it stays testable with a fixed Date.
export function formatRelativeTime(iso, now) {
  if (!iso) return '—';
  const then = new Date(iso);
  const diffMin = Math.round((now - then) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  return formatDate(iso);
}

export function statusTone(status) {
  const s = status.toLowerCase();
  // 'proposed' and 'not pursuing' are deliberately left untoned (fall through
  // to '') — both are neutral/closed states, not a success or a failure.
  if (['on track', 'accepted', 'published', 'awarded', 'implemented'].includes(s)) return 'green';
  if (['at risk', 'revisions'].includes(s)) return 'amber';
  if (['blocked', 'rejected', 'overdue', 'not pursuing'].includes(s)) return 'red';
  if (['under review', 'submitted', 'drafting', 'in progress', 'adopted'].includes(s)) return 'blue';
  return '';
}

export const STATUS_OPTIONS = {
  project: ['Planning', 'On track', 'At risk', 'Blocked', 'Complete'],
  paper: [
    'Drafting',
    'Internal review',
    'Submitted',
    'Under review',
    'Revisions',
    'Accepted',
    'Published',
  ],
  // 'In progress' = actively applying/drafting; 'Not pursuing' = decided not
  // to apply (distinct from 'Rejected', which means we applied and lost).
  proposal: ['In progress', 'Submitted', 'Under review', 'Awarded', 'Rejected', 'Not pursuing'],
  blue_sky_idea: ['Proposed', 'Adopted', 'Implemented'],
};

// Computed display-only grouping for Overview scanning — project/paper only.
// Proposal and blue_sky_idea intentionally have no stage grouping (confirmed
// with the user): proposals just show their own status, and blue-sky ideas
// show their own Proposed/Adopted/Implemented status, flat.
const STAGE_FOR_STATUS = {
  project: {
    Planning: 'Upcoming',
    'On track': 'Ongoing',
    'At risk': 'Ongoing',
    Blocked: 'Ongoing',
    Complete: 'Delivered',
  },
  paper: {
    Drafting: 'Upcoming',
    'Internal review': 'Upcoming',
    Submitted: 'Ongoing',
    'Under review': 'Ongoing',
    Revisions: 'Ongoing',
    Accepted: 'Ongoing',
    Published: 'Delivered',
  },
};

export function stageOf(item) {
  return STAGE_FOR_STATUS[item.type]?.[item.status] ?? null;
}

// The reverse of STAGE_FOR_STATUS — one representative status per stage, for
// the Add-item form's simple Upcoming/Ongoing/Delivered picker (project/paper
// only; proposal/blue_sky_idea expose their own real status list instead).
export const STAGE_DEFAULT_STATUS = {
  project: { Upcoming: 'Planning', Ongoing: 'On track', Delivered: 'Complete' },
  paper: { Upcoming: 'Drafting', Ongoing: 'Under review', Delivered: 'Published' },
};

// Paper's "Delivered" stage reads as "Completed" in the UI (per the user's
// own wording for papers); project keeps "Delivered" as-is.
export function stageLabel(type, stage) {
  return type === 'paper' && stage === 'Delivered' ? 'Completed' : stage;
}
