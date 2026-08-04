-- Per-person task deadlines (2026-07-31) — explicit direction: a single
-- project-wide target_date doesn't fit once several people own different
-- pieces of it. work_items.target_date stays the overall project deadline,
-- set once at creation; this is a *separate* per-membership deadline, set
-- after creation by whoever's actually doing that piece of work, not
-- dictated by the project's creator.
alter table public.members
  add column if not exists target_date date;

-- No policy existed for updating a members row at all before this (only
-- select/insert/delete) — assign_work_item() is security definer and
-- bypasses RLS for the assigner's own upsert, but there was no path for a
-- member to touch their *own* row directly. Scoped to exactly your own row
-- — same "app only ever sends the one column it means to" trust split
-- notify_members()'s own comment already documents elsewhere in this
-- schema, not a column-level Postgres permission (RLS doesn't have those).
create policy members_update_own on public.members
for update using (user_id = auth.uid())
with check (user_id = auth.uid());
