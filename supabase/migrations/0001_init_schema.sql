-- ACPET Work Portal — initial schema.
--
-- Translates src/data.js's mock shapes into real Postgres tables. Column
-- names match the mock 1:1 wherever possible so that swapping the mock's
-- selectors for Supabase queries later shouldn't require touching component
-- code (see README.md's "Wiring up Supabase later").

create extension if not exists pgcrypto;

-- Enums -----------------------------------------------------------------

create type public.user_role as enum (
  'director', 'senior_research_lead', 'vertical_lead', 'co_lead', 'employee'
);

create type public.work_item_type as enum (
  'project', 'paper', 'proposal', 'blue_sky_idea'
);

create type public.item_role as enum ('lead', 'contributor');

-- verticals ---------------------------------------------------------------
-- lead_id -> profiles is added after profiles exists (circular reference).

create table public.verticals (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  lead_id uuid,
  is_crosscutting boolean not null default false,
  created_at timestamptz not null default now()
);

-- profiles (1:1 with auth.users) ------------------------------------------
-- job_title is free text and never affects permissions — only `role` does,
-- same rule data.js has documented since the org data first landed.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null,
  job_title text not null default '',
  role public.user_role not null default 'employee',
  vertical_id uuid references public.verticals (id) on delete set null,
  reports_to uuid references public.profiles (id) on delete set null,
  qualifications text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  constraint profiles_email_domain_check check (email ~* '@ashoka\.edu\.in$'),
  constraint profiles_not_own_manager check (reports_to is null or reports_to <> id)
);

alter table public.verticals
  add constraint verticals_lead_id_fkey
  foreign key (lead_id) references public.profiles (id) on delete set null;

create index profiles_vertical_idx on public.profiles (vertical_id);
create index profiles_reports_to_idx on public.profiles (reports_to);

-- Auto-provision a profile row on signup, and enforce the domain
-- restriction server-side — the real version of what src/authConfig.js's
-- ALLOWED_EMAIL_DOMAIN has only ever foreshadowed client-side.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email !~* '@ashoka\.edu\.in$' then
    raise exception 'Only @ashoka.edu.in addresses may sign up (got %)', new.email;
  end if;

  insert into public.profiles (id, email, full_name, job_title, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'job_title', ''),
    'employee'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Guard against a user promoting themselves via the self-update policy
-- (see 0002_rls_policies.sql's profiles_update_self) — role/vertical_id/
-- reports_to changes are director-only, same as People & roles today.
create or replace function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() = old.id and (
    new.role is distinct from old.role
    or new.vertical_id is distinct from old.vertical_id
    or new.reports_to is distinct from old.reports_to
  ) then
    if (select role from public.profiles where id = auth.uid()) <> 'director' then
      raise exception 'Only a director can change role, vertical, or reporting line';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_self_update
  before update on public.profiles
  for each row execute function public.prevent_self_privilege_escalation();

-- work_items ----------------------------------------------------------------
-- No owning_vertical column — ownership is entirely represented by the
-- many-to-many work_item_verticals table below (a work item can be jointly
-- owned by more than one vertical). budget_total/budget_spent stay flat
-- here rather than in a separately-secured table (same trust model as the
-- mock's canSeeBudget() app-level check today — revisit later if real
-- DB-level budget enforcement is wanted).
create table public.work_items (
  id uuid primary key default gen_random_uuid(),
  type public.work_item_type not null,
  title text not null,
  status text not null,
  target_date date,
  related_work_item_id uuid references public.work_items (id) on delete set null,
  progress_note text not null default '',
  plan_note text not null default '',
  budget_total bigint not null default 0,
  budget_spent bigint not null default 0,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint work_items_budget_nonnegative check (budget_total >= 0 and budget_spent >= 0),
  -- Mirrors STATUS_OPTIONS in src/data.js exactly. Any future edit to
  -- STATUS_OPTIONS needs a matching migration here — accepted trade-off,
  -- confirmed with the user, in exchange for the database physically
  -- rejecting an invalid status/type pairing.
  constraint work_items_status_matches_type check (
    (type = 'project' and status in ('Planning','On track','At risk','Blocked','Complete'))
    or (type = 'paper' and status in ('Drafting','Internal review','Submitted','Under review','Revisions','Accepted','Published'))
    or (type = 'proposal' and status in ('In progress','Submitted','Under review','Awarded','Rejected','Not pursuing'))
    or (type = 'blue_sky_idea' and status in ('Proposed','Adopted','Implemented'))
  )
);

create index work_items_type_idx on public.work_items (type);
create index work_items_related_idx on public.work_items (related_work_item_id);
create index work_items_created_by_idx on public.work_items (created_by);

-- work_item_verticals: the new many-to-many ownership join table — the
-- first-class multi-vertical fact this pass adds. No share/weight column
-- yet (confirmed) — just records which verticals are linked.
create table public.work_item_verticals (
  work_item_id uuid not null references public.work_items (id) on delete cascade,
  vertical_id uuid not null references public.verticals (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (work_item_id, vertical_id)
);

create index work_item_verticals_vertical_idx on public.work_item_verticals (vertical_id);

-- members ---------------------------------------------------------------
-- assigned_by/assigned_at are both null for "author auto-added themselves
-- on create" (today's only insertion path) and populated only when a
-- senior explicitly assigns someone via the new assign_work_item() RPC.
create table public.members (
  work_item_id uuid not null references public.work_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_on_item public.item_role not null default 'contributor',
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (work_item_id, user_id),
  constraint members_assignment_pair_check check ((assigned_by is null) = (assigned_at is null))
);

create index members_user_idx on public.members (user_id);

-- checkins ----------------------------------------------------------------
-- The write path is currently dead in the UI (the Check-in tab was
-- removed), but read functions (lastCheckin/filedThisWeek/daysSinceCheckin/
-- currentFocus) still depend on this exact shape elsewhere (Director's
-- Employees table, the Team tab's CheckinFlag) — carried forward as-is.
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  week_of date not null,
  submitted_at timestamptz,
  update_note text not null default '',
  unique (author_id, week_of)
);

create index checkins_author_idx on public.checkins (author_id);

-- comments (freeform "growth notes") ---------------------------------------
-- No status, no title, optionally tagged to a work item — not a work_item
-- itself.
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  work_item_id uuid references public.work_items (id) on delete set null,
  created_at timestamptz not null default now()
);

create index comments_author_idx on public.comments (author_id);
create index comments_work_item_idx on public.comments (work_item_id);

-- notifications -------------------------------------------------------------
-- kind is deliberately `text`, not an enum, to stay in lockstep with
-- NOTIF_TITLE in EmployeeHome.jsx without a migration every time a new kind
-- is added. 'added_to_item' is the kind the assign feature uses.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  source_id uuid,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
