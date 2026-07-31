// One-off admin script — run locally, never in the browser. Seeds the live
// verticals table with ACPET's real teams (teams aren't people — this is
// NOT the same thing as the "don't manually seed the real roster of people"
// decision from earlier; that was specifically about not inventing accounts
// nobody asked for) and points a real person's profile at their real team.
// Needs the service_role key — same secret as create-accounts.mjs, see that
// file's usage comment for how to get it.
//
// Usage (PowerShell):
//   $env:SUPABASE_URL="https://<ref>.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="<service_role key>"
//   node scripts/seed-teams.mjs
//
// Safe to re-run — verticals.name is unique, so this upserts by name rather
// than inserting duplicates on a second run.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Matches src/data.js's verticals array — lead_id left null for all of them
// here since we don't have real accounts/confirmed leads for most of these
// people yet; assign leads later (Director's People & roles, once that's
// wired to real data too) rather than guessing here.
const TEAMS = [
  { name: 'People-centric Power Reform', is_crosscutting: false },
  { name: 'Critical Minerals & Circular Economy', is_crosscutting: false },
  { name: 'Coal Transition', is_crosscutting: false },
  { name: 'Social Impact of Energy Transition', is_crosscutting: false },
  { name: 'Energy Futures Lab', is_crosscutting: true },
  { name: 'Communications', is_crosscutting: false },
];

// Person -> team assignments to apply after seeding. Add more here as more
// real accounts exist (create-accounts.mjs) and their real team is known.
const ASSIGNMENTS = [
  { email: 'jolinson.dass@ashoka.edu.in', teamName: 'Energy Futures Lab' },
];

const { data: teams, error: teamsError } = await admin
  .from('verticals')
  .upsert(TEAMS, { onConflict: 'name' })
  .select('id, name');

if (teamsError) {
  console.error('Failed to seed teams:', teamsError.message);
  process.exit(1);
}

console.log('Teams in place:');
for (const t of teams) console.log(`  ${t.name}  (${t.id})`);

for (const { email, teamName } of ASSIGNMENTS) {
  const team = teams.find((t) => t.name === teamName);
  if (!team) {
    console.error(`FAILED  ${email} — no team named "${teamName}" found`);
    continue;
  }
  const { error } = await admin.from('profiles').update({ vertical_id: team.id }).eq('email', email);
  if (error) {
    console.error(`FAILED  ${email} — ${error.message}`);
  } else {
    console.log(`assigned ${email} -> ${teamName}`);
  }
}
