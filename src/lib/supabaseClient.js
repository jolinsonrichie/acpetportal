import { createClient } from '@supabase/supabase-js';

// import.meta.env is a Vite-only construct — plain `undefined` when this
// module is loaded by a plain-Node admin script (create-accounts.mjs,
// seed-teams.mjs both transitively import this via `../src/data.js`, just
// for the `users` array — they never actually use `supabase` from here, but
// the import still runs at module-load time). Falling back to process.env
// lets those scripts run without a separate stub; the browser build is
// unaffected since Vite always provides a real import.meta.env object.
const env = import.meta.env || process.env;

// The `anon`/`publishable` key is designed to be public — RLS (see
// supabase/migrations/0002_rls_policies.sql) is the actual security
// boundary, not this key's secrecy. Never put the `service_role` key here.
export const supabase = createClient(
  env.VITE_SUPABASE_URL || env.SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY
);
