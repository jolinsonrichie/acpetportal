-- Reverses the section-19 "Admin vs Editor" model per explicit direction
-- 2026-07-31: "he is another lead that is it only director is the
-- superuser." senior_research_lead (currently just Dr. Goswami) no longer
-- gets org-wide read access — he's scoped exactly like vertical_lead/
-- co_lead, restricted to whichever verticals he actually leads/belongs to.
-- Only 'director' remains org-wide. The role value itself (and its distinct
-- ROLE_LABEL/title) is unchanged — this only narrows what it can see/do,
-- matching src/data.js's ORG_WIDE_ROLES/VERTICAL_LEAD_ROLES update.

create or replace function public.is_org_wide() returns boolean
language sql stable as $$ select public.my_role() = 'director'; $$;

create or replace function public.is_lead_tier() returns boolean
language sql stable as $$ select public.my_role() in ('vertical_lead', 'co_lead', 'senior_research_lead'); $$;
