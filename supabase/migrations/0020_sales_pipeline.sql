-- Sales pipeline: an agency's sales team works a list of potential guarding clients.
--
-- Two layers:
--   prospects        platform-wide, public organisation-level facts loaded by us (RERA, GeM, OSM,
--                    our agency index). No agency_id, no personal data. Read-only to tenants that
--                    hold sales:read; written only by the service role (one-time import scripts).
--   leads & friends  per agency, private: stage, owner, notes, the people to call and their numbers.
--
-- Hot / Warm / Cold and the plain-language reasons are worked out in src/lib/domain/sales.ts when a
-- lead is created or its facts change, and stored on the lead (label, reasons), so the list sorts
-- and filters on plain columns.

-- ---------------------------------------------------------------------------
-- Permissions. sales:read is deliberately kept away from the Viewer role (client-facing and
-- finance staff), which otherwise receives every key whose action is 'read'.
-- ---------------------------------------------------------------------------
insert into public.permission_catalogue (key, resource, action, label, description, sort) values
  ('sales:read',   'sales', 'read',   'View sales leads',     'The sales pipeline: leads, people to call, follow-ups', 140),
  ('sales:write',  'sales', 'write',  'Work sales leads',     'Add leads, log calls and notes, move leads through stages', 141),
  ('sales:lookup', 'sales', 'lookup', 'Find mobile numbers',  'Use the monthly allowance of paid mobile-number lookups on top leads', 142)
on conflict (key) do update set
  resource = excluded.resource, action = excluded.action, label = excluded.label,
  description = excluded.description, sort = excluded.sort;

create or replace function public.seed_system_roles(p_agency_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  all_keys text[];
  reads text[];
begin
  select array_agg(key order by sort) into all_keys from public.permission_catalogue;
  select array_agg(key order by sort) into reads from public.permission_catalogue
  where action = 'read' and resource <> 'sales';

  insert into public.roles (agency_id, name, description, is_system, system_key, permissions) values
    (p_agency_id, 'Owner', 'Full control of the agency, including team and settings. Cannot be edited.', true, 'owner', all_keys),
    (p_agency_id, 'Manager', 'Runs operations across every module; cannot change settings or team access.', true, 'manager',
      (select array_agg(key) from public.permission_catalogue where key not in ('settings:write', 'team:manage'))),
    (p_agency_id, 'Supervisor', 'Runs the day at their sites: roster, attendance, patrols, tasks, incidents and leave. No KYC documents or exports.', true, 'supervisor',
      array['sites:read','guards:read','guards:write','roster:read','roster:write','attendance:read','attendance:correct','live:read',
            'events:read','events:acknowledge','incidents:read','incidents:write','patrols:read','patrols:write','tasks:read','tasks:write',
            'leave:read','leave:decide','reports:read']),
    (p_agency_id, 'Viewer', 'Read-only access to operations; for client-facing or finance staff.', true, 'viewer', reads)
  on conflict (agency_id, system_key) do nothing;
end $$;

-- Existing tenants: Owner and Manager pick the new keys up; Viewer is recomputed without sales.
do $$ begin
  alter table public.roles disable trigger roles_protect;
  update public.roles set permissions = (select array_agg(key order by sort) from public.permission_catalogue)
  where is_system and system_key = 'owner';
  alter table public.roles enable trigger roles_protect;
end $$;

update public.roles set permissions = (select array_agg(key) from public.permission_catalogue where key not in ('settings:write', 'team:manage'))
where is_system and system_key = 'manager';

update public.roles set permissions = (
  select array_agg(key order by sort) from public.permission_catalogue where action = 'read' and resource <> 'sales'
)
where is_system and system_key = 'viewer';

-- ---------------------------------------------------------------------------
-- Shared prospect list (platform layer)
-- ---------------------------------------------------------------------------
create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('rera', 'gem', 'osm', 'kpme', 'nabh', 'agency_index', 'manual')),
  source_ref text not null,
  source_url text,
  name text not null,
  segment text not null check (segment in (
    'apartment', 'developer_project', 'factory', 'office', 'it_park', 'hospital', 'school', 'college',
    'hotel', 'mall', 'jeweller', 'govt', 'warehouse', 'bank', 'other'
  )),
  address text,
  locality text,
  city text not null default 'Bengaluru',
  lat double precision,
  lng double precision,
  size_value numeric,
  size_unit text check (size_unit in ('flats', 'beds', 'students', 'rooms', 'acres', 'sq_ft', 'guards')),
  phone text,             -- public reception/business number only
  website text,
  developer text,
  completion_on date,
  registered_on date,
  tender_closes_on date,
  tender_ends_on date,
  tender_value_inr bigint,
  tender_guards int,
  incumbent_agency text,
  incumbent_software text check (incumbent_software in ('none', 'weak', 'strong', 'national')),
  incumbent_source_url text,
  notes text,
  -- Worked out by the import script with the same rules as leads (src/lib/domain/sales.ts), so
  -- "Find new leads" can sort thousands of rows by Hot/Warm/Cold in the database.
  label text not null default 'warm' check (label in ('hot', 'warm', 'cold')),
  reasons jsonb not null default '[]',
  est_guards int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_ref)
);
create index prospects_city_idx on public.prospects (city, segment);
create index prospects_label_idx on public.prospects (label, est_guards desc nulls last);
create index prospects_name_idx on public.prospects (lower(name));
create trigger prospects_touch before update on public.prospects for each row execute function public.touch_updated_at();

alter table public.prospects enable row level security;
create policy prospects_select on public.prospects for select to authenticated
  using (public.current_agency_id() is not null and public.has_permission('sales:read'));
-- No insert/update/delete policies: only the service role writes prospects.

-- ---------------------------------------------------------------------------
-- Per-agency pipeline
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete set null,
  name text not null,
  segment text not null check (segment in (
    'apartment', 'developer_project', 'factory', 'office', 'it_park', 'hospital', 'school', 'college',
    'hotel', 'mall', 'jeweller', 'govt', 'warehouse', 'bank', 'agency', 'other'
  )),
  address text,
  locality text,
  city text,
  lat double precision,
  lng double precision,
  size_value numeric,
  size_unit text check (size_unit in ('flats', 'beds', 'students', 'rooms', 'acres', 'sq_ft', 'guards')),
  website text,
  developer text,
  completion_on date,
  tender_closes_on date,
  tender_ends_on date,
  tender_value_inr bigint,
  tender_guards int,
  incumbent_agency text,
  incumbent_software text check (incumbent_software in ('none', 'weak', 'strong', 'national')),
  incumbent_source text,
  label text not null default 'warm' check (label in ('hot', 'warm', 'cold')),
  reasons jsonb not null default '[]',   -- [{ "kind", "text", "source", "url" }]
  stage text not null default 'new' check (stage in ('new', 'called', 'meeting', 'proposal', 'won', 'lost')),
  owner_id uuid references public.profiles(id) on delete set null,
  next_follow_up date,
  lost_reason text,
  won_site_id uuid references public.sites(id) on delete set null,
  source text not null default 'manual',
  source_url text,
  extra jsonb not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, prospect_id)
);
create index leads_agency_idx on public.leads (agency_id, stage, label);
create index leads_follow_up_idx on public.leads (agency_id, next_follow_up);
create trigger leads_touch before update on public.leads for each row execute function public.touch_updated_at();

create table public.lead_contacts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  full_name text not null,
  designation text,
  do_not_call boolean not null default false,
  whatsapp_ok boolean not null default false,
  source text not null default 'rep',   -- where the person came from: rep, website, tender, sheet, lookup ...
  source_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index lead_contacts_lead_idx on public.lead_contacts (lead_id);

create table public.lead_numbers (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  contact_id uuid references public.lead_contacts(id) on delete cascade,  -- null = the place's main number
  kind text not null check (kind in ('mobile', 'office', 'email')),
  value text not null,
  label text,                            -- e.g. "Reception", "Security desk"
  source text not null default 'rep',
  source_url text,
  status text not null default 'unknown' check (status in ('unknown', 'worked', 'no_answer', 'wrong')),
  last_tried_at timestamptz,
  created_at timestamptz not null default now()
);
create index lead_numbers_lead_idx on public.lead_numbers (lead_id);

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  kind text not null check (kind in ('call', 'visit', 'note', 'stage', 'created', 'lookup', 'update')),
  body text,
  outcome text check (outcome in ('reached', 'no_answer', 'wrong_number', 'wrong_person')),
  contact_id uuid references public.lead_contacts(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);

create table public.lead_lookups (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  contact_id uuid references public.lead_contacts(id) on delete set null,
  provider text not null,
  status text not null check (status in ('ok', 'not_found', 'error')),
  cost_paise int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index lead_lookups_agency_idx on public.lead_lookups (agency_id, created_at);

-- ---------------------------------------------------------------------------
-- RLS. Every table decides from its own agency_id, so no policy reads another table and there
-- is no recursion or INSERT ... RETURNING blind spot. Leads have no site scope: sales is
-- agency-wide.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['leads', 'lead_contacts', 'lead_numbers', 'lead_activities'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy %I on public.%I for select using (
      agency_id = public.current_agency_id() and public.has_permission('sales:read'))$p$, t || '_select', t);
    execute format($p$create policy %I on public.%I for insert with check (
      agency_id = public.current_agency_id() and public.has_permission('sales:write'))$p$, t || '_insert', t);
    execute format($p$create policy %I on public.%I for update using (
      agency_id = public.current_agency_id() and public.has_permission('sales:write'))
      with check (agency_id = public.current_agency_id() and public.has_permission('sales:write'))$p$, t || '_update', t);
    execute format($p$create policy %I on public.%I for delete using (
      agency_id = public.current_agency_id() and public.has_permission('sales:write'))$p$, t || '_delete', t);
  end loop;
end $$;

alter table public.lead_lookups enable row level security;
create policy lead_lookups_select on public.lead_lookups for select using (
  agency_id = public.current_agency_id() and public.has_permission('sales:read'));
create policy lead_lookups_insert on public.lead_lookups for insert with check (
  agency_id = public.current_agency_id() and public.has_permission('sales:lookup'));

-- ---------------------------------------------------------------------------
-- Prospects this agency has not added yet, best first. security invoker: RLS on both tables
-- still applies, so a caller without sales:read gets nothing.
-- ---------------------------------------------------------------------------
create or replace function public.sales_find_prospects(
  p_segment text default null,
  p_label text default null,
  p_q text default null,
  p_limit int default 300
)
returns setof public.prospects
language sql stable security invoker set search_path = public as $$
  select p.* from public.prospects p
  where (p_segment is null or p.segment = p_segment)
    and (p_label is null or p.label = p_label)
    and (p_q is null or p.name ilike '%' || p_q || '%' or p.locality ilike '%' || p_q || '%' or p.developer ilike '%' || p_q || '%')
    and not exists (
      select 1 from public.leads l where l.prospect_id = p.id and l.agency_id = public.current_agency_id()
    )
  order by case p.label when 'hot' then 0 when 'warm' then 1 else 2 end,
           p.est_guards desc nulls last, p.name
  limit least(coalesce(p_limit, 300), 1000)
$$;
