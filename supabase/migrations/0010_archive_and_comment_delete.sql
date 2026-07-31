-- Archive support for work items, and delete support for comments/growth
-- notes (2026-07-31) — the redesign asked for a recoverable "Archive" state
-- alongside the existing hard delete (kept as-is, already built/verified —
-- see 0005), plus deletion for growth notes, which never had it at all.

-- Purely additive columns — nullable, defaults to "not archived". No new RLS
-- policy needed: work_items_update (0006) already lets the item's creator or
-- a director update any column on the row, archived_at included.
alter table public.work_items
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id);

-- comments never had a delete policy at all (0005's comments_update_for_cascade
-- only covers the work_item_id-nulling side-effect of deleting the *parent*
-- work item) — this is the first real "delete my own growth note" support.
-- Same creator-or-director rule as every other delete policy in this file.
create policy comments_delete on public.comments
for delete using (author_id = auth.uid() or public.my_role() = 'director');
