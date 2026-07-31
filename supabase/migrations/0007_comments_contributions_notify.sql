-- ACPET Work Portal — real backend for comments, per-item weekly
-- "contributions", and lead broadcast notes (2026-07-30).
--
-- Until now, only work_items/members/work_item_verticals ever reached the
-- database for real — comments, growth notes, contributions (a brand new
-- concept added to the app this week, with no table at all yet), and lead
-- broadcasts were mock-only, in-memory in whichever browser tab created
-- them, invisible to anyone else regardless of how real their account was.
-- This closes that gap:
--   1. contributions: the table addContribution() needed and never had.
--   2. add_item_comment() / add_contribution() / notify_members(): security-
--      definer RPCs, same pattern as assign_work_item() in
--      0002_rls_policies.sql — needed because notifications has *no* direct
--      insert policy (deliberately, per that file's own comment: a raw
--      insert policy would let any lead-tier client forge a notification to
--      anyone). The comment/contribution row itself could be inserted
--      directly under existing policies, but doing it inside the RPC keeps
--      "insert the row" and "notify everyone else on it" atomic, same
--      reasoning assign_work_item() already uses.

-- contributions --------------------------------------------------------------

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.work_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index contributions_work_item_idx on public.contributions (work_item_id);
create index contributions_user_idx on public.contributions (user_id);

alter table public.contributions enable row level security;

-- Same visibility as members_select: whoever can already see the item can
-- see who's posted an update on it.
create policy contributions_select on public.contributions
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

-- Direct insert of your own row only — the safety net behind
-- add_contribution() below, same relationship members_insert has to
-- assign_work_item().
create policy contributions_insert_own on public.contributions
for insert with check (user_id = auth.uid());

alter publication supabase_realtime add table public.contributions;

-- can_see_work_item() ----------------------------------------------------------
-- Mirrors work_items_select's own predicate (0002_rls_policies.sql) exactly.
-- Needed because add_item_comment()/add_contribution() below are `security
-- definer` — they run with the function owner's privileges, bypassing RLS
-- entirely inside the function body, so without this guard any
-- authenticated caller could comment/contribute on (and trigger real
-- notifications to the real members of) a work item they have no access to
-- see at all. assign_work_item() already re-checks visibility the same way
-- before acting; this is that same check, factored out so both new
-- functions share it instead of drifting apart.
create or replace function public.can_see_work_item(p_work_item_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.work_items w
    where w.id = p_work_item_id
      and (
        public.is_org_wide()
        or (
          public.is_lead_tier()
          and (
            exists (
              select 1 from public.work_item_verticals wiv
              where wiv.work_item_id = w.id and wiv.vertical_id = public.my_vertical_id()
            )
            or public.item_has_my_report(w.id)
          )
        )
        or (
          not public.is_org_wide() and not public.is_lead_tier()
          and public.is_my_item(w.id)
        )
      )
  );
$$;

-- add_item_comment() ----------------------------------------------------------
-- Inserts a comment tied to a work item and notifies every other member of
-- that item, atomically. Growth notes with no work_item_id skip this
-- entirely (nothing to notify) and just insert directly under the existing
-- comments_insert_own policy — see src/data.js's addGrowthNote.

create or replace function public.add_item_comment(
  p_work_item_id uuid,
  p_body text
) returns public.comments
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.comments;
  v_author_name text;
  v_recipient record;
begin
  if not public.can_see_work_item(p_work_item_id) then
    raise exception 'Work item not visible to you';
  end if;

  insert into public.comments (author_id, body, work_item_id)
  values (auth.uid(), p_body, p_work_item_id)
  returning * into v_row;

  select full_name into v_author_name from public.profiles where id = auth.uid();

  for v_recipient in
    select user_id from public.members where work_item_id = p_work_item_id and user_id <> auth.uid()
  loop
    insert into public.notifications (recipient_id, kind, source_id, body)
    values (
      v_recipient.user_id,
      'comment',
      p_work_item_id,
      format('%s commented: "%s"', coalesce(v_author_name, 'Someone'), p_body)
    );
  end loop;

  return v_row;
end;
$$;

-- add_contribution() -----------------------------------------------------------
-- Same shape as add_item_comment(), for the "what I'm working on this week"
-- feature (see ContributionsPanel in src/components/Team.jsx).

create or replace function public.add_contribution(
  p_work_item_id uuid,
  p_body text
) returns public.contributions
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.contributions;
  v_title text;
  v_author_name text;
  v_recipient record;
begin
  if not public.can_see_work_item(p_work_item_id) then
    raise exception 'Work item not visible to you';
  end if;

  insert into public.contributions (work_item_id, user_id, body)
  values (p_work_item_id, auth.uid(), p_body)
  returning * into v_row;

  select title into v_title from public.work_items where id = p_work_item_id;
  select full_name into v_author_name from public.profiles where id = auth.uid();

  for v_recipient in
    select user_id from public.members where work_item_id = p_work_item_id and user_id <> auth.uid()
  loop
    insert into public.notifications (recipient_id, kind, source_id, body)
    values (
      v_recipient.user_id,
      'contribution',
      p_work_item_id,
      format('%s posted this week''s update on "%s": "%s"', coalesce(v_author_name, 'Someone'), coalesce(v_title, 'a work item'), p_body)
    );
  end loop;

  return v_row;
end;
$$;

-- notify_members() --------------------------------------------------------------
-- The lead-broadcast "send an update to your team" feature (NotifyForm in
-- src/components/Team.jsx). Restricted to org-wide/lead-tier callers, same
-- authority check as assign_work_item() — does not otherwise re-derive that
-- each recipient is actually one of the caller's own people; that scoping
-- already happens client-side (notifiableUsersFor in src/data.js), same
-- trust split the rest of this project uses (app-level scoping + a basic
-- role check here, not a full server-side re-derivation of every write
-- action's audience).
create or replace function public.notify_members(
  p_recipient_ids uuid[],
  p_body text
) returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_sender_name text;
  v_recipient uuid;
begin
  if not (public.is_org_wide() or public.is_lead_tier()) then
    raise exception 'Not permitted to notify members';
  end if;

  select full_name into v_sender_name from public.profiles where id = auth.uid();

  foreach v_recipient in array p_recipient_ids loop
    insert into public.notifications (recipient_id, kind, source_id, body)
    values (v_recipient, 'lead_note', null, format('%s: %s', coalesce(v_sender_name, 'Your lead'), p_body));
  end loop;
end;
$$;
