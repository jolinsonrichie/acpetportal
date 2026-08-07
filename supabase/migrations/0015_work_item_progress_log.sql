-- Progress/Planned made dynamic (2026-08-07) — "What work has been going
-- on"/"What's planned next" used to be two plain columns on work_items,
-- silently overwritten every time someone hit Save on the Edit form (see
-- EditItemForm in src/components/Team.jsx before this session) — no
-- history, no due date, and nothing to look back at before writing the
-- next entry. Direct ask: these should be dynamic (a real history you can
-- see the last entry of before logging a new one), and the "planned" half
-- needs a real due date, not just text.
--
-- work_items.progress_note/plan_note columns are left in place (not
-- dropped) but retired from the write path as of this migration — the app
-- no longer edits them going forward, this table is the new source of
-- truth for "what's the latest progress/plan." The insert below backfills
-- one history row per existing item that already had real text in either
-- column, so nothing written before today is lost — it just becomes each
-- item's first logged entry instead of vanishing behind a UI change.

create table public.work_item_updates (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.work_items (id) on delete cascade,
  progress_text text not null default '',
  plan_text text not null default '',
  plan_due_date date,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index work_item_updates_work_item_idx on public.work_item_updates (work_item_id, created_at desc);

alter table public.work_item_updates enable row level security;

-- Same visibility as contributions_select (0007) — whoever can already see
-- the item can see its progress/plan history.
create policy work_item_updates_select on public.work_item_updates
for select using (
  public.is_org_wide()
  or (
    public.is_lead_tier()
    and (
      exists (
        select 1 from public.work_item_verticals wiv
        where wiv.work_item_id = work_item_id and wiv.vertical_id = public.my_vertical_id()
      )
      or public.item_has_my_report(work_item_id)
    )
  )
  or public.is_my_item(work_item_id)
);

-- Logging a new entry needs the same authority as Edit/Archive/Delete on
-- the item itself (see canManage, src/components/Team.jsx) — creator, any
-- current member (not just Lead — per direct instruction in migration
-- 0016, "for everyone," since whoever entered something is who's most
-- likely to need to correct it), or a director. is_my_item() is the same
-- "I am personally a member of this item" check work_items_select's own
-- third branch already uses (0002).
create policy work_item_updates_insert on public.work_item_updates
for insert with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.work_items w
    where w.id = work_item_id
      and (
        w.created_by = auth.uid()
        or public.is_my_item(work_item_id)
        or public.my_role() = 'director'
      )
  )
);

alter publication supabase_realtime add table public.work_item_updates;

-- Backfill: whatever was already typed into progress_note/plan_note
-- becomes each item's first real history entry, attributed to the item's
-- own creator at the item's own created_at — not a guess, the actual
-- author and time this content was originally associated with. No due
-- date backfilled (target_date is the item's own overall date, not
-- specifically what this old plan text was due by — leaving it null here
-- is honest, not lossy).
insert into public.work_item_updates (work_item_id, progress_text, plan_text, created_by, created_at)
select id, coalesce(progress_note, ''), coalesce(plan_note, ''), created_by, created_at
from public.work_items
where coalesce(progress_note, '') <> '' or coalesce(plan_note, '') <> '';
