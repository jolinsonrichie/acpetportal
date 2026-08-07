-- Edit/Archive/Delete opened to any member of the item, not just its
-- creator or a director (2026-08-07) — direct instruction: whoever entered
-- something (title, status, target date) and made a mistake, or anyone on
-- the item who needs to rewrite/correct/remove it, should be able to —
-- not just whoever happened to create it. Widens work_items_update/_delete
-- (0005/0006) and their two cascade-delete policies (wiv_delete,
-- members_delete, comments_update_for_cascade) to also allow
-- is_my_item(), the same "I am personally a member of this item" check
-- work_items_select's own third branch already uses (0002).
--
-- Deliberately not scoped narrower (e.g. "any Lead, not Contributors") —
-- the instruction was "for everyone," reasoning was "whoever made the
-- mistake should be able to fix it," and a Contributor is exactly who's
-- most likely to have entered the thing that needs fixing.
--
-- Superseded by this: canManage in src/components/Team.jsx (Edit/Archive/
-- Delete kebab + the Log update action from migration 0015) now also
-- checks isMember, not just isLeadOn/created_by/director — see that
-- commit. This migration is the database side actually catching up to
-- match, closing the gap flagged (not fixed) in 0015's own comment.

drop policy if exists work_items_update on public.work_items;
create policy work_items_update on public.work_items
for update using (
  created_by = auth.uid() or public.is_my_item(id) or public.my_role() = 'director'
)
with check (
  created_by = auth.uid() or public.is_my_item(id) or public.my_role() = 'director'
);

drop policy if exists work_items_delete on public.work_items;
create policy work_items_delete on public.work_items
for delete using (
  created_by = auth.uid() or public.is_my_item(id) or public.my_role() = 'director'
);

drop policy if exists wiv_delete on public.work_item_verticals;
create policy wiv_delete on public.work_item_verticals
for delete using (
  exists (
    select 1 from public.work_items w
    where w.id = work_item_id
      and (w.created_by = auth.uid() or public.is_my_item(w.id) or public.my_role() = 'director')
  )
);

drop policy if exists members_delete on public.members;
create policy members_delete on public.members
for delete using (
  exists (
    select 1 from public.work_items w
    where w.id = work_item_id
      and (w.created_by = auth.uid() or public.is_my_item(w.id) or public.my_role() = 'director')
  )
);

drop policy if exists comments_update_for_cascade on public.comments;
create policy comments_update_for_cascade on public.comments
for update using (
  work_item_id is not null
  and exists (
    select 1 from public.work_items w
    where w.id = work_item_id
      and (w.created_by = auth.uid() or public.is_my_item(w.id) or public.my_role() = 'director')
  )
) with check (true);
