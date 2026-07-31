-- ACPET Work Portal — Row Level Security.
--
-- Mirrors src/data.js's visibleUsers/visibleItems/visibleNotes/canSeeBudget
-- exactly, so this becomes the REAL security boundary once the app is
-- switched over — the JS versions become redundant then, not load-bearing
-- (see README.md: "Do not keep them as the security boundary").

-- Helper functions --------------------------------------------------------
-- security definer so a policy on `profiles` can read `profiles` without
-- infinite recursion (standard Supabase RLS pattern).

create or replace function public.my_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.my_vertical_id() returns uuid
language sql stable security definer set search_path = public as $$
  select vertical_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_org_wide() returns boolean
language sql stable as $$ select public.my_role() in ('director', 'senior_research_lead'); $$;

create or replace function public.is_lead_tier() returns boolean
language sql stable as $$ select public.my_role() in ('vertical_lead', 'co_lead'); $$;

-- "a direct report of mine is a member of this item" (visibleItems' reportIds check)
create or replace function public.item_has_my_report(p_work_item_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members m
    join public.profiles p on p.id = m.user_id
    where m.work_item_id = p_work_item_id and p.reports_to = auth.uid()
  );
$$;

-- "I am personally a member of this item" (itemsForUser(viewer.id) equivalent)
create or replace function public.is_my_item(p_work_item_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members m
    where m.work_item_id = p_work_item_id and m.user_id = auth.uid()
  );
$$;

-- profiles — mirrors visibleUsers, plus "always see yourself" (needed for
-- the app to load its own session identity) ---------------------------------

alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
for select using (
  id = auth.uid()
  or public.is_org_wide()
  or (
    public.is_lead_tier()
    and (vertical_id = public.my_vertical_id() or reports_to = auth.uid())
  )
);

-- Self-service profile fields (qualifications/phone/job_title in
-- ProfilePanel). The profiles_guard_self_update trigger (0001) blocks
-- role/vertical_id/reports_to changes through this same policy.
create policy profiles_update_self on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

-- Director's People & roles admin panel (role/vertical_id/reports_to edits).
create policy profiles_update_admin on public.profiles
for update using (public.my_role() = 'director') with check (true);

-- verticals -----------------------------------------------------------------

alter table public.verticals enable row level security;

create policy verticals_select_all on public.verticals
for select using (auth.role() = 'authenticated');

create policy verticals_write_admin on public.verticals
for all using (public.my_role() = 'director') with check (public.my_role() = 'director');

-- work_items — mirrors visibleItems, adapted for work_item_verticals --------

alter table public.work_items enable row level security;

create policy work_items_select on public.work_items
for select using (
  public.is_org_wide()
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

create policy work_items_insert on public.work_items
for insert with check (created_by = auth.uid());

-- work_item_verticals — same visibility gate as work_items -------------------

alter table public.work_item_verticals enable row level security;

create policy wiv_select on public.work_item_verticals
for select using (
  public.is_org_wide()
  or (
    public.is_lead_tier()
    and (vertical_id = public.my_vertical_id() or public.item_has_my_report(work_item_id))
  )
  or public.is_my_item(work_item_id)
);

create policy wiv_insert on public.work_item_verticals
for insert with check (
  exists (
    select 1 from public.work_items w
    where w.id = work_item_id and w.created_by = auth.uid()
  )
);

-- members — visible to whoever can see the underlying item ------------------

alter table public.members enable row level security;

create policy members_select on public.members
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

-- Two legitimate insert shapes: (a) author auto-adding themselves on
-- create, (b) a senior explicitly assigning someone else. In practice the
-- app should call the assign_work_item() RPC below for (b) rather than
-- insert directly, so the notification gets created atomically — this
-- policy is the safety net either way.
create policy members_insert on public.members
for insert with check (
  (user_id = auth.uid() and assigned_by is null)
  or (assigned_by = auth.uid() and (public.is_org_wide() or public.is_lead_tier()))
);

-- checkins — mirrors visibility via the author's identity -------------------

alter table public.checkins enable row level security;

create policy checkins_select on public.checkins
for select using (
  author_id = auth.uid()
  or public.is_org_wide()
  or (
    public.is_lead_tier()
    and exists (
      select 1 from public.profiles p
      where p.id = author_id
        and (p.vertical_id = public.my_vertical_id() or p.reports_to = auth.uid())
    )
  )
);

create policy checkins_insert_own on public.checkins
for insert with check (author_id = auth.uid());

-- comments — mirrors visibleNotes (scoped through the comment's author) -----

alter table public.comments enable row level security;

create policy comments_select on public.comments
for select using (
  author_id = auth.uid()
  or public.is_org_wide()
  or (
    public.is_lead_tier()
    and exists (
      select 1 from public.profiles p
      where p.id = author_id
        and (p.reports_to = auth.uid() or p.vertical_id = public.my_vertical_id())
    )
  )
);

create policy comments_insert_own on public.comments
for insert with check (author_id = auth.uid());

-- notifications — recipient-only, Realtime-ready (see 0003) -----------------

alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications
for select using (recipient_id = auth.uid());

create policy notifications_update_own on public.notifications
for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- No notifications_insert policy is defined deliberately — inserts happen
-- only via the assign_work_item() security-definer RPC below, which
-- re-derives kind/body/recipient server-side. A raw insert policy here
-- would let any lead-tier client forge a notification to anyone.

-- assign_work_item() — the real mutation path for the assign+notify feature.
-- Re-checks the assigner's authority using the exact same predicate as
-- work_items_select, then upserts the membership and inserts the
-- notification atomically.
create or replace function public.assign_work_item(
  p_work_item_id uuid,
  p_user_id uuid,
  p_role_on_item public.item_role default 'contributor'
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

  insert into public.members (work_item_id, user_id, role_on_item, assigned_by, assigned_at)
  values (p_work_item_id, p_user_id, p_role_on_item, auth.uid(), now())
  on conflict (work_item_id, user_id)
  do update set role_on_item = excluded.role_on_item,
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
