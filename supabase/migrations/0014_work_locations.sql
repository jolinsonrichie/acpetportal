-- Work location tracker — real backend (2026-07-31). Three fixed options
-- (Tata Smart Grid Lab / Okhla Office / WFH), one row per person per day,
-- upserted on (user_id, date). Built UI-first against a mock array (see
-- src/components/WorkLocation.jsx), confirmed working, then wired here.
--
-- Read is deliberately org-wide (`using (true)`) — this was built
-- specifically to be visible to everyone, not scoped by vertical or
-- reporting line the way most of this schema is. Write is self-only, same
-- reasoning members_update_own (migration 0013) already established: a
-- personal schedule isn't something to moderate, and no director override
-- is needed for a field like this.

create type public.work_location as enum ('office_1', 'office_2', 'wfh');

create table public.work_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  location public.work_location not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index work_locations_date_idx on public.work_locations (date);
create index work_locations_user_idx on public.work_locations (user_id);

alter table public.work_locations enable row level security;

create policy work_locations_select on public.work_locations
for select using (true);

create policy work_locations_insert_own on public.work_locations
for insert with check (user_id = auth.uid());

create policy work_locations_update_own on public.work_locations
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy work_locations_delete_own on public.work_locations
for delete using (user_id = auth.uid());

-- Same "add every new table to the realtime publication even though
-- nothing subscribes yet" convention 0003/0007 already established in this
-- schema.
alter publication supabase_realtime add table public.work_locations;
