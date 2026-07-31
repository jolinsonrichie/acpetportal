-- Edit support for work items (2026-07-30) — pairs with 0005's delete
-- policies. There was no update policy on work_items at all before this;
-- same rule as delete: the item's creator, or a director.
create policy work_items_update on public.work_items
for update using (created_by = auth.uid() or public.my_role() = 'director')
with check (created_by = auth.uid() or public.my_role() = 'director');
