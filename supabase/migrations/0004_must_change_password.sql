-- Real Supabase Auth rollout (2026-07-30): accounts are pre-created by an
-- admin script with a shared temporary password (see scripts/create-accounts.mjs),
-- not self-signed-up. This column tracks whether a person is still on that
-- temporary password so the app can force them to a "set your password"
-- screen on first real login. Defaults true so every newly-created account
-- starts gated; the app flips it false once the person sets their own
-- password (src/screens/ChangePassword.jsx).
alter table public.profiles
  add column if not exists must_change_password boolean not null default true;

-- Not blocked by profiles_guard_self_update (0001) — that trigger only
-- watches role/vertical_id/reports_to — and profiles_update_self (0002)
-- already lets a person update their own row, so no RLS/policy change is
-- needed for the app to flip this column off after a successful password set.
