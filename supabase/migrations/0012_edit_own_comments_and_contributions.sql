-- Edit support for comments/growth notes and contributions, plus delete for
-- contributions (2026-07-31) — explicit ask: "enable edit option and delete
-- option for everything whenever people enter the detail in it." Delete
-- already existed for work items (0005) and comments/growth notes (0010);
-- this fills the remaining gaps.

-- comments_update_for_cascade (0005) only lets a work item's creator/director
-- null out work_item_id when the parent item is deleted — it was never a
-- general "edit your own comment" policy, and doesn't cover growth notes at
-- all (work_item_id is not null is part of its USING clause). This is the
-- actual first "edit my own comment/growth note" support. Author-only, no
-- director override — matches comments_delete's creator-or-director rule for
-- *removing* something, but rewriting someone else's words is a different,
-- not-requested capability.
create policy comments_update_own on public.comments
for update using (author_id = auth.uid())
with check (author_id = auth.uid());

-- contributions had no update/delete policy at all before this — only
-- contributions_select/contributions_insert_own (0007). Same author-owns-it
-- shape as everywhere else in this schema; delete also allows a director
-- override, matching work_items_delete/comments_delete's existing pattern.
create policy contributions_update_own on public.contributions
for update using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy contributions_delete_own on public.contributions
for delete using (user_id = auth.uid() or public.my_role() = 'director');
