-- Two additive columns for the New Work wizard redesign (2026-07-31):

-- (1) A real "Project Description" field — context written *before* anyone
-- is assigned, distinct from progress_note ("what's been done") and
-- plan_note ("what's next"), neither of which this schema had before this.
-- No RLS change needed: work_items_update (0006) already covers any column
-- on a row its creator (or a director) owns.
alter table public.work_items
  add column if not exists description text;

-- (2) Per-member "responsibility" note (e.g. "Literature review", "Data
-- collection"), distinct from their Lead/Contributor role. Purely additive,
-- no RLS change needed: members_insert (0002) and its cascade-delete policy
-- (0005) already cover whatever columns are on the row, and
-- assign_work_item() (below) is the only path that writes it for a real
-- assignment made after creation.
alter table public.members
  add column if not exists responsibility text;

-- assign_work_item() gains an optional p_responsibility param, stored
-- alongside role_on_item/assigned_by/assigned_at on the same upsert — same
-- function, same security-definer re-check, just one more column threaded
-- through. Existing callers that don't pass it keep working unchanged
-- (defaults to null, which the upsert's "do update set" now also refreshes,
-- same as every other field on a re-assignment).
--
-- Postgres overloads functions by their full argument signature, so
-- `create or replace` with an added parameter creates a *second* function
-- rather than replacing the original 3-arg one — confirmed live after
-- first applying this migration (both signatures existed side by side).
-- Drop the old signature explicitly first so a fresh bootstrap of this
-- schema ends up with exactly one, matching what's actually live now.
drop function if exists public.assign_work_item(uuid, uuid, public.item_role);

create or replace function public.assign_work_item(
  p_work_item_id uuid,
  p_user_id uuid,
  p_role_on_item public.item_role default 'contributor',
  p_responsibility text default null
) returns public.members
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.members;
  v_title text;
  v_assigner_name text;
begin
  if not (public.is_org_wide() or public.is_lead_tier()) then
    raise exception 'Not permitted to assign work items';
  end if;

  if not exists (
    select 1 from public.work_items w
    where w.id = p_work_item_id
      and (
        public.is_org_wide()
        or exists (
          select 1 from public.work_item_verticals wiv
          where wiv.work_item_id = w.id and wiv.vertical_id = public.my_vertical_id()
        )
        or public.item_has_my_report(w.id)
      )
  ) then
    raise exception 'Work item not visible to you';
  end if;

  insert into public.members (work_item_id, user_id, role_on_item, responsibility, assigned_by, assigned_at)
  values (p_work_item_id, p_user_id, p_role_on_item, p_responsibility, auth.uid(), now())
  on conflict (work_item_id, user_id)
  do update set role_on_item = excluded.role_on_item,
                responsibility = excluded.responsibility,
                assigned_by = excluded.assigned_by,
                assigned_at = excluded.assigned_at
  returning * into v_row;

  select title into v_title from public.work_items where id = p_work_item_id;
  select full_name into v_assigner_name from public.profiles where id = auth.uid();

  insert into public.notifications (recipient_id, kind, source_id, body)
  values (
    p_user_id,
    'added_to_item',
    p_work_item_id,
    format('%s added you as %s on "%s".', coalesce(v_assigner_name, 'Someone'), p_role_on_item, coalesce(v_title, 'a work item'))
  );

  return v_row;
end;
$$;
