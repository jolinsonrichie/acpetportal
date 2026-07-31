// Mirrors the domain-restriction policy the real Supabase Auth setup will
// enforce server-side later. Client-side only for now — not a security
// boundary, see README.md.
export const ALLOWED_EMAIL_DOMAIN = 'ashoka.edu.in';

// The shared temporary password every account is pre-created with by
// scripts/create-accounts.mjs — not a login-screen fallback anymore
// (Login.jsx/DirectorLogin.jsx now always send whatever password was
// typed, real per-person passwords included). People still sign in with
// this value exactly once, by typing it themselves, before
// ChangePassword.jsx's must_change_password gate forces them to set their
// own. Must match TEMP_PASSWORD's default in scripts/create-accounts.mjs.
export const TEMP_LOGIN_PASSWORD = 'ACPET-Welcome-2026';
