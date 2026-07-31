-- Delete support for work items (2026-07-30) — the mock never had a delete
-- feature at all, so this is genuinely new, not a mirror of existing JS.
-- Rule: the item's creator can delete their own item; a director can delete
-- any item (same admin override used elsewhere in this file).
create policy work_items_delete on public.work_items
for delete using (created_by = auth.uid() or public.my_role() = 'director');

-- work_item_verticals and members both have `on delete cascade` foreign keys
-- to work_items — but RLS applies to cascade deletes too. Without delete
-- policies here, deleting a work_items row would fail with a permission
-- error the moment it tried to cascade into these tables.
create policy wiv_delete on public.work_item_verticals
for delete using (
  exists (
    select 1 from public.work_items w
    where w.id = work_item_id
      and (w.created_by = auth.uid() or public.my_role() = 'director')
  )
);

create policy members_delete on public.members
for delete using (
  exists (
    select 1 from public.work_items w
    where w.id = work_item_id
      and (w.created_by = auth.uid() or public.my_role() = 'director')
  )
);

-- comments.work_item_id is `on delete set null` (comments outlive the item
-- they were tagged to), which is an UPDATE under the hood — also needs a
-- policy, and it needs to cover comments authored by *other* people (e.g.
-- a colleague commented on the item before you delete it), not just your
-- own, since comments_insert_own only ever covered inserts.
create policy comments_update_for_cascade on public.comments
for update using (
  work_item_id is not null
  and exists (
    select 1 from public.work_items w
    where w.id = work_item_id
      and (w.created_by = auth.uid() or public.my_role() = 'director')
  )
) with check (true);
