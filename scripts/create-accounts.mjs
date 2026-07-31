// One-off admin script — run this LOCALLY on your own machine, never in the
// browser. It creates real Supabase Auth accounts with a shared temporary
// password so each person can sign in once and set their own password (see
// src/screens/ChangePassword.jsx). This is the only place in this project
// that ever touches the Supabase *service_role* key — that key bypasses RLS
// entirely, so it must never be committed, never pasted into chat, and never
// put in a VITE_-prefixed .env var (Vite would ship it to every browser).
//
// Usage:
//   1. In the Supabase dashboard: Settings -> API -> reveal the
//      `service_role` secret key.
//   2. Run (PowerShell):
//        $env:SUPABASE_URL="https://xxxx.supabase.co"
//        $env:SUPABASE_SERVICE_ROLE_KEY="paste-the-secret-key-here"
//        node scripts/create-accounts.mjs
//      (bash/zsh: `export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...`)
//   3. Share the temp password (below) with each person out-of-band (Slack/
//      in person) — not over email in plaintext if you can help it.
//
// Everyone in src/data.js's roster gets a real account (2026-07-30 decision,
// reversed from the earlier "leave Anandajit/the Director out until ready" —
// testing real data entry end-to-end needs every tested role to actually
// authenticate for real, not fall back to the mock roster). NOTE: most of
// these emails are still the placeholder firstname.lastname@ashoka.edu.in
// guesses data.js itself documents as unconfirmed (only
// jolinson.dass@ashoka.edu.in is a confirmed real mailbox) — fine for this
// testing phase since nothing here sends mail to them (email_confirm skips
// the confirmation email), but swap in confirmed addresses before the real
// rollout, or people will be locked out of accounts tied to inboxes they
// don't check.

import { createClient } from '@supabase/supabase-js';
import { TEMP_LOGIN_PASSWORD } from '../src/authConfig.js';
import { users } from '../src/data.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Kept in sync with authConfig.js's TEMP_LOGIN_PASSWORD — that's what
// Login.jsx signs real accounts in with while the password field is
// detached, so accounts created here must share the same value.
const TEMP_PASSWORD = process.env.TEMP_PASSWORD || TEMP_LOGIN_PASSWORD;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first — see the comment at the top of this file.');
  process.exit(1);
}

// Derived straight from data.js's users array rather than hand-maintained —
// full_name is passed through to handle_new_user()'s raw_user_meta_data,
// but that mock array is still the source of truth the app actually reads
// from; this is just what shows up if anyone looks at the raw auth.users
// record. Edit data.js's roster, not this list, to add/remove people.
const PEOPLE = users.map((u) => ({ email: u.email, full_name: u.full_name }));

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Looks up an existing auth.users row by email — the admin SDK has no
// direct "get by email", only paginated listUsers().
async function findExistingUser(email) {
  const target = email.trim().toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match;
    if (data.users.length < 200) return null; // last page
  }
}

for (const person of PEOPLE) {
  const { data, error } = await admin.auth.admin.createUser({
    email: person.email,
    password: TEMP_PASSWORD,
    email_confirm: true, // skip the confirmation email — these are known ACPET addresses
    user_metadata: { full_name: person.full_name },
  });
  if (!error) {
    console.log(`created ${person.email}  (auth uid: ${data.user.id})`);
    continue;
  }

  if (!/already.*registered|already.*exists/i.test(error.message)) {
    console.error(`FAILED  ${person.email} — ${error.message}`);
    continue;
  }

  // Account already exists — most likely it already went through
  // ChangePassword.jsx and picked its own password, which would break the
  // email-only sign-in Login.jsx relies on right now (see authConfig.js).
  // Reset it back to the shared temp password and re-flag it so it goes
  // through ChangePassword again once the password field is reattached.
  const existing = await findExistingUser(person.email);
  if (!existing) {
    console.error(`FAILED  ${person.email} — reported as already existing but not found via listUsers()`);
    continue;
  }
  const { error: resetError } = await admin.auth.admin.updateUserById(existing.id, { password: TEMP_PASSWORD });
  if (resetError) {
    console.error(`FAILED  ${person.email} — could not reset existing account: ${resetError.message}`);
    continue;
  }
  const { error: profileError } = await admin
    .from('profiles')
    .update({ must_change_password: true })
    .eq('id', existing.id);
  if (profileError) {
    console.error(`reset password for ${person.email} but failed to re-flag must_change_password: ${profileError.message}`);
  } else {
    console.log(`reset   ${person.email}  (auth uid: ${existing.id}) — back on the shared temp password`);
  }
}

console.log(`\nTemporary password for all accounts above: ${TEMP_PASSWORD}`);
console.log('This is also the password Login.jsx uses behind the scenes while its password field is detached (see authConfig.js).');
