// One-off admin script — run this LOCALLY, never in the browser. Connects
// directly to your Supabase project's Postgres database and runs the SQL
// migration files in supabase/migrations/, so you don't have to copy-paste
// each one into the Supabase dashboard's SQL Editor by hand.
//
// This needs your database CONNECTION STRING (with password) — this is a
// DIFFERENT secret from the service_role key used by create-accounts.mjs.
// Find it at: Supabase dashboard -> Project Settings -> Database ->
// Connection string -> "URI" tab. If you don't remember the password, reset
// it from that same page. This string must never be committed or pasted
// into chat — it's effectively full admin access to your database.
//
// Usage (PowerShell):
//   $env:DATABASE_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"
//   node scripts/run-migrations.mjs                     # runs every migration, in order
//   node scripts/run-migrations.mjs 0004_must_change_password.sql   # runs just one
//
// Safe to re-run: if a migration was already applied, Postgres will report
// "already exists" for things like `create table` — that specific file is
// then skipped (logged, not fatal) and the script moves on to the next one,
// since it means that one's already in place, not that something's broken.

import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Set DATABASE_URL first — see the comment at the top of this file.');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

const requested = process.argv[2];
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .filter((f) => !requested || f === requested);

if (!files.length) {
  console.error(requested ? `No migration file named "${requested}" found.` : 'No .sql files found in supabase/migrations/.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
} catch (err) {
  console.error(`Could not connect: ${err.message || err.code || err}`);
  console.error('Double-check DATABASE_URL — host/password/project ref are all easy to mistype when copying from the dashboard.');
  process.exit(1);
}

for (const file of files) {
  const sql = readFileSync(path.join(migrationsDir, file), 'utf8');
  console.log(`\n→ ${file}`);
  try {
    await client.query(sql);
    console.log('  done');
  } catch (err) {
    if (/already exists/i.test(err.message)) {
      console.log(`  already applied (${err.message}) — skipping, this is expected on a re-run`);
      continue;
    }
    console.error(`  FAILED: ${err.message}`);
    console.error('  Stopping here — fix the error above before continuing.');
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log('\nAll requested migrations applied.');
