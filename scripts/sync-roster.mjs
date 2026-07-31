// One-off admin script — run locally, never in the browser. Needs the
// service_role key, same secret as create-accounts.mjs/seed-teams.mjs (see
// create-accounts.mjs's usage comment for how to get it).
//
// What this fixes: create-accounts.mjs only creates the real auth.users +
// profiles row — Postgres's own on_auth_user_created trigger (see
// 0001_init_schema.sql) always defaults a fresh profile to
// role='employee', vertical_id=null, reports_to=null, regardless of who the
// person actually is. That's fine for the app's own UI (App.jsx resolves
// role/vertical/etc. from src/data.js's mock by email, not from the real
// profiles row), but every RLS policy in 0002_rls_policies.sql (is_org_wide,
// is_lead_tier, my_vertical_id, item_has_my_report, ...) reads the REAL
// profiles.role/vertical_id/reports_to — so until this runs, a real vertical
// lead's real Postgres account still looks like a plain employee to RLS,
// and their assign/comment/create actions will be silently scoped wrong (or
// rejected) even though the UI shows them correctly.
//
// This script pushes src/data.js's users/verticals arrays into the live
// `profiles`/`verticals` tables (matching by email, since mock ids like
// 'u2' don't exist in Postgres). Safe to re-run.
//
// Usage (PowerShell):
//   $env:SUPABASE_URL="https://<ref>.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="<service_role key>"
//   node scripts/sync-roster.mjs
//
// Requires every person to already have a real account (run
// create-accounts.mjs first) — anyone without one yet is skipped and
// logged, not silently dropped.
//
// NOT covered here (known gap, not this script's job): `verticals.type`
// (thematic/crosscutting/support/administration) and `co_lead_id` exist in
// the mock (sections 36/44) but were never added to the live schema — no
// RLS policy depends on either, so this doesn't block real permission
// scoping, just cosmetic team labeling if this data ever gets read live.

import { createClient } from '@supabase/supabase-js';
import { verticals, users } from '../src/data.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first — see the comment at the top of this file.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 1. Verticals — upsert by name (unique). lead_id is set in a second pass
// below, once every profile's real id is known.
const { data: liveVerticals, error: vErr } = await admin
  .from('verticals')
  .upsert(
    verticals.map((v) => ({ name: v.name, is_crosscutting: v.is_crosscutting })),
    { onConflict: 'name' }
  )
  .select('id, name');
if (vErr) {
  console.error('Failed to upsert verticals:', vErr.message);
  process.exit(1);
}
const liveVerticalIdByName = new Map(liveVerticals.map((v) => [v.name, v.id]));
const mockVerticalNameById = new Map(verticals.map((v) => [v.id, v.name]));

// 2. Every real profile so mock ids (users[].id, users[].reports_to) can be
// resolved to real auth uuids via email.
const { data: profiles, error: pErr } = await admin.from('profiles').select('id, email');
if (pErr) {
  console.error('Failed to fetch profiles:', pErr.message);
  process.exit(1);
}
const realIdByEmail = new Map(profiles.map((p) => [p.email.toLowerCase(), p.id]));
const mockUserById = new Map(users.map((u) => [u.id, u]));

function realVerticalIdFor(mockVerticalId) {
  if (!mockVerticalId) return null;
  const name = mockVerticalNameById.get(mockVerticalId);
  return name ? liveVerticalIdByName.get(name) ?? null : null;
}

// 3. Push role/vertical_id/reports_to/job_title/full_name onto each real
// profile — this is the part that actually fixes RLS scoping.
for (const u of users) {
  const realId = realIdByEmail.get(u.email.toLowerCase());
  if (!realId) {
    console.error(`SKIP    ${u.email} — no real account yet (run create-accounts.mjs first)`);
    continue;
  }

  const manager = u.reports_to ? mockUserById.get(u.reports_to) : null;
  const managerRealId = manager ? realIdByEmail.get(manager.email.toLowerCase()) ?? null : null;

  const { error } = await admin
    .from('profiles')
    .update({
      full_name: u.full_name,
      job_title: u.job_title,
      role: u.role,
      vertical_id: realVerticalIdFor(u.vertical_id),
      reports_to: managerRealId,
    })
    .eq('id', realId);

  if (error) console.error(`FAILED  ${u.email} — ${error.message}`);
  else console.log(`synced  ${u.email}  role=${u.role}  vertical=${mockVerticalNameById.get(u.vertical_id) ?? '—'}`);
}

// 4. Vertical leads — needs real profile ids, so this runs after step 3.
for (const v of verticals) {
  if (!v.lead_id) continue;
  const lead = mockUserById.get(v.lead_id);
  const leadRealId = lead ? realIdByEmail.get(lead.email.toLowerCase()) : null;
  const liveId = liveVerticalIdByName.get(v.name);
  if (!leadRealId || !liveId) {
    console.error(`SKIP lead for ${v.name} — ${lead?.email ?? v.lead_id} has no real account yet`);
    continue;
  }
  const { error } = await admin.from('verticals').update({ lead_id: leadRealId }).eq('id', liveId);
  if (error) console.error(`FAILED lead for ${v.name} — ${error.message}`);
  else console.log(`lead    ${v.name}  ->  ${lead.full_name}`);
}

console.log('\nDone. co_lead_id and team `type` are mock-only for now (see comment at top) — not a blocker for RLS.');
