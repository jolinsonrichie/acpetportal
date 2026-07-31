-- Fixes a real bug found 2026-07-31: a lead-tier creator (vertical_lead/
-- co_lead/senior_research_lead) inserting a brand-new work_item via
-- `.insert().select()` (needed to get the new row's id back) was rejected
-- by RLS — not on the INSERT policy itself (created_by = auth.uid() was
-- always correct), but because INSERT ... RETURNING also has to satisfy the
-- table's SELECT policy for the new row, and work_items_select's lead-tier
-- branch requires a work_item_verticals or members row to already exist —
-- which addWorkItem/addRealWorkItem only creates in a *separate*, later
-- insert. A director never hit this (is_org_wide() passes unconditionally),
-- which is why this went unnoticed until a real vertical_lead account
-- actually tried it end-to-end for the first time this session.
--
-- Fix: the row's own creator can always see it, full stop — independent of
-- whether membership/vertical linkage has landed yet. This is additive
-- (an extra `or`), so nothing anyone could already see stops being visible.

drop policy if exists work_items_select on public.work_items;

create policy work_items_select on public.work_items
for select using (
  created_by = auth.uid()
  or public.is_org_wide()
  or (
    public.is_lead_tier()
    and (
      exists (
        select 1 from public.work_item_verticals wiv
        where wiv.work_item_id = id and wiv.vertical_id = public.my_vertical_id()
      )
      or public.item_has_my_report(id)
    )
  )
  or (
    not public.is_org_wide() and not public.is_lead_tier()
    and public.is_my_item(id)
  )
);
