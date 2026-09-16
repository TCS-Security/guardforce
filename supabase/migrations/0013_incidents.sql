-- Incidents (F11): major events a human reports — a fight, a theft, a fire, a medical
-- emergency, trespass, vandalism.
--
-- This is deliberately NOT the `events` table. `events` is the automated monitor feed
-- (late start, outside fence, missed patrol) written by emit_event/run_monitors and read
-- as a firehose. An incident is a narrative written by a person: it has a severity a
-- manager chose, a place, a time it happened (not the time it was typed), and a life
-- cycle that someone has to close.
--
-- The question the module exists to answer is "where was everyone when it happened",
-- which public.incident_guard_positions() below reconstructs from location_pings.

-- ---------------------------------------------------------------------------
-- Enums (idempotent: migrations are replayed by `supabase db reset`)
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where t.typname = 'incident_type' and n.nspname = 'public') then
    create type public.incident_type as enum (
      'fight', 'theft', 'fire', 'medical', 'trespass', 'vandalism',
      'property_damage', 'unauthorised_vehicle', 'altercation_with_client', 'other'
    );
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where t.typname = 'incident_severity' and n.nspname = 'public') then
    create type public.incident_severity as enum ('low', 'moderate', 'high', 'critical');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where t.typname = 'incident_status' and n.nspname = 'public') then
    create type public.incident_status as enum ('open', 'investigating', 'resolved');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  type public.incident_type not null default 'other',
  severity public.incident_severity not null default 'moderate',
  title text not null check (length(btrim(title)) >= 3),
  description text not null check (length(btrim(description)) >= 10),
  -- When it happened, which is rarely when it was typed up.
  occurred_at timestamptz not null default now(),
  -- Who filed it: a dashboard user, or a guard reporting from the app.
  reported_by uuid references public.profiles(id) on delete set null,
  reported_by_guard_id uuid references public.guards(id) on delete set null,
  -- The guard involved (victim, first responder, or the one who raised it on the post).
  guard_id uuid references public.guards(id) on delete set null,
  -- Where on the site, when the reporter could pin it. Null = "somewhere at this site".
  lat double precision,
  lng double precision,
  status public.incident_status not null default 'open',
  resolution text,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists incidents_agency_time_idx on public.incidents(agency_id, occurred_at desc);
create index if not exists incidents_site_time_idx on public.incidents(site_id, occurred_at desc);
create index if not exists incidents_status_idx on public.incidents(agency_id, status) where status <> 'resolved';
create index if not exists incidents_guard_idx on public.incidents(guard_id, occurred_at desc);

drop trigger if exists incidents_touch on public.incidents;
create trigger incidents_touch before update on public.incidents
  for each row execute function public.touch_updated_at();

-- Resolution bookkeeping is the database's job, not the caller's: leaving `resolved`
-- without a timestamp (or an unresolved row carrying one) would break every report.
create or replace function public.incidents_sync_resolution()
returns trigger language plpgsql as $$
begin
  if new.status = 'resolved' then
    if new.resolved_at is null then new.resolved_at := now(); end if;
    if new.resolved_by is null then new.resolved_by := auth.uid(); end if;
  else
    new.resolved_at := null;
    new.resolved_by := null;
  end if;
  return new;
end $$;
drop trigger if exists incidents_resolution on public.incidents;
create trigger incidents_resolution before insert or update on public.incidents
  for each row execute function public.incidents_sync_resolution();

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
insert into public.permission_catalogue (key, resource, action, label, description, sort) values
  ('incidents:read',  'incidents', 'read',  'View incidents',   'The incident log and the guard positions at the time', 65),
  ('incidents:write', 'incidents', 'write', 'Log incidents',    'Report incidents and move them through investigation to resolved', 66)
on conflict (key) do update set
  resource = excluded.resource, action = excluded.action, label = excluded.label,
  description = excluded.description, sort = excluded.sort;

-- New tenants: the supervisor role's permission list is spelled out, so it needs the keys
-- explicitly. Owner / Manager / Viewer derive theirs from the catalogue and pick them up free.
create or replace function public.seed_system_roles(p_agency_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  all_keys text[];
  reads text[];
begin
  select array_agg(key order by sort) into all_keys from public.permission_catalogue;
  select array_agg(key order by sort) into reads from public.permission_catalogue where action = 'read';

  insert into public.roles (agency_id, name, description, is_system, system_key, permissions) values
    (p_agency_id, 'Owner', 'Full control of the agency, including team and settings. Cannot be edited.', true, 'owner', all_keys),
    (p_agency_id, 'Manager', 'Runs operations across every module; cannot change settings or team access.', true, 'manager',
      (select array_agg(key) from public.permission_catalogue where key not in ('settings:write', 'team:manage'))),
    (p_agency_id, 'Supervisor', 'Runs the day at their sites: roster, attendance, patrols, tasks, incidents and leave. No KYC documents or exports.', true, 'supervisor',
      array['sites:read','guards:read','guards:write','roster:read','roster:write','attendance:read','attendance:correct','live:read',
            'events:read','events:acknowledge','incidents:read','incidents:write','patrols:read','patrols:write','tasks:read','tasks:write',
            'leave:read','leave:decide','reports:read']),
    (p_agency_id, 'Viewer', 'Read-only access to everything; for client-facing or finance staff.', true, 'viewer', reads)
  on conflict (agency_id, system_key) do nothing;
end $$;

-- Existing tenants: grant the new keys to the system roles that should hold them. The Owner
-- role row is guarded by roles_protect_owner, so the trigger is suspended for this statement.
do $$ begin
  alter table public.roles disable trigger roles_protect;
  update public.roles set permissions = (select array_agg(key order by sort) from public.permission_catalogue)
  where is_system and system_key = 'owner';
  alter table public.roles enable trigger roles_protect;
end $$;

update public.roles set permissions = (select array_agg(key) from public.permission_catalogue where key not in ('settings:write', 'team:manage'))
where is_system and system_key = 'manager';

update public.roles set permissions = (select array_agg(key order by sort) from public.permission_catalogue where action = 'read')
where is_system and system_key = 'viewer';

-- The supervisor role is editable, so only add; never rewrite what a tenant has customised.
update public.roles set permissions = permissions || array['incidents:read', 'incidents:write']
where is_system and system_key = 'supervisor' and not ('incidents:read' = any (permissions));

-- ---------------------------------------------------------------------------
-- RLS. Reads decide from the row plus site scope (never from role names); writes check
-- the permission key. accessible_site_ids() reads public.sites, not public.incidents, so
-- there is no policy cycle and no INSERT ... RETURNING blind spot.
-- ---------------------------------------------------------------------------
alter table public.incidents enable row level security;

drop policy if exists incidents_select on public.incidents;
create policy incidents_select on public.incidents for select using (
  agency_id = public.current_agency_id()
  and (
    public.sees_all_sites()
    or site_id in (select public.accessible_site_ids())
    or guard_id = public.current_guard_id()
    or reported_by_guard_id = public.current_guard_id()
  )
);

drop policy if exists incidents_insert on public.incidents;
create policy incidents_insert on public.incidents for insert with check (
  agency_id = public.current_agency_id()
  and public.has_permission('incidents:write')
  and site_id in (select public.accessible_site_ids())
);

drop policy if exists incidents_update on public.incidents;
create policy incidents_update on public.incidents for update
  using (
    agency_id = public.current_agency_id()
    and public.has_permission('incidents:write')
    and site_id in (select public.accessible_site_ids())
  )
  with check (
    agency_id = public.current_agency_id()
    and public.has_permission('incidents:write')
    and site_id in (select public.accessible_site_ids())
  );

drop policy if exists incidents_delete on public.incidents;
create policy incidents_delete on public.incidents for delete using (
  agency_id = public.current_agency_id()
  and public.has_permission('incidents:write')
  and site_id in (select public.accessible_site_ids())
);

-- ---------------------------------------------------------------------------
-- "Where was everyone when it happened."
--
-- For an incident, every guard who was on duty anywhere in the reader's site scope at
-- that moment, with the position closest in time to it. Position comes from the shift's
-- breadcrumb trail; failing that from the live presence row; failing that from the
-- check-in point. `source` says which, `gap_seconds` how far the fix is from the
-- incident, and `stale` whether the caller should treat the position as unknown rather
-- than draw a pin somewhere that is probably wrong.
-- ---------------------------------------------------------------------------
drop function if exists public.incident_guard_positions(uuid);
create function public.incident_guard_positions(p_incident_id uuid)
returns table (
  guard_id uuid,
  guard_name text,
  employee_code text,
  site_id uuid,
  site_name text,
  same_site boolean,
  shift_id uuid,
  shift_status public.shift_status,
  shift_name text,
  lat double precision,
  lng double precision,
  source text,
  recorded_at timestamptz,
  gap_seconds int,
  accuracy_m real,
  distance_m real,
  in_fence boolean,
  location_enabled boolean,
  stale boolean
) language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_inc public.incidents;
  v_origin extensions.geography;
  v_staleness int;
  v_shift record;
  v_fix record;
  v_lat double precision;
  v_lng double precision;
  v_source text;
  v_recorded timestamptz;
  v_accuracy real;
  v_gap int;
begin
  select * into v_inc from public.incidents where id = p_incident_id;
  if not found then return; end if;
  if not public.can_access_site(v_inc.site_id) then raise exception 'FORBIDDEN'; end if;

  select coalesce(staleness_min, 15) into v_staleness from public.agencies where id = v_inc.agency_id;

  -- Distances are measured from the pinned spot when there is one, otherwise from the site.
  if v_inc.lat is not null and v_inc.lng is not null then
    v_origin := extensions.ST_SetSRID(extensions.ST_MakePoint(v_inc.lng, v_inc.lat), 4326)::extensions.geography;
  else
    select geom into v_origin from public.sites where id = v_inc.site_id;
  end if;

  for v_shift in
    select sh.id, sh.guard_id as g_id, sh.site_id as s_id, sh.status, sh.started_at, sh.ended_at,
           sh.start_lat, sh.start_lng, sh.start_accuracy_m, sh.location_enabled,
           g.full_name, g.employee_code, s.name as s_name, st.name as st_name
    from public.shifts sh
    join public.guards g on g.id = sh.guard_id
    join public.sites s on s.id = sh.site_id
    left join public.shift_types st on st.id = sh.shift_type_id
    where sh.agency_id = v_inc.agency_id
      and sh.site_id in (select public.accessible_site_ids())
      and sh.status in ('in_progress', 'completed', 'void_location_off')
      and coalesce(sh.started_at, sh.scheduled_start) <= v_inc.occurred_at
      and coalesce(sh.ended_at, sh.scheduled_end, now()) >= v_inc.occurred_at
    order by (sh.site_id = v_inc.site_id) desc, g.full_name
  loop
    v_lat := null; v_lng := null; v_source := 'none'; v_recorded := null; v_accuracy := null;

    -- closest breadcrumb in time, before or after
    select lp.lat, lp.lng, lp.recorded_at, lp.accuracy_m into v_fix
    from public.location_pings lp
    where lp.shift_id = v_shift.id
    order by abs(extract(epoch from (lp.recorded_at - v_inc.occurred_at)))
    limit 1;
    if found then
      v_lat := v_fix.lat; v_lng := v_fix.lng; v_recorded := v_fix.recorded_at;
      v_accuracy := v_fix.accuracy_m; v_source := 'ping';
    end if;

    -- live presence, for an incident reported while the shift is still running
    if v_lat is null then
      select gp.lat, gp.lng, gp.last_seen_at, gp.accuracy_m into v_fix
      from public.guard_presence gp
      where gp.guard_id = v_shift.g_id and gp.shift_id = v_shift.id and gp.lat is not null;
      if found then
        v_lat := v_fix.lat; v_lng := v_fix.lng; v_recorded := v_fix.last_seen_at;
        v_accuracy := v_fix.accuracy_m; v_source := 'presence';
      end if;
    end if;

    -- last resort: where they stood when they checked in
    if v_lat is null and v_shift.start_lat is not null then
      v_lat := v_shift.start_lat; v_lng := v_shift.start_lng; v_recorded := v_shift.started_at;
      v_accuracy := v_shift.start_accuracy_m; v_source := 'check_in';
    end if;

    v_gap := case when v_recorded is null then null
                  else abs(extract(epoch from (v_recorded - v_inc.occurred_at)))::int end;

    guard_id := v_shift.g_id;
    guard_name := v_shift.full_name;
    employee_code := v_shift.employee_code;
    site_id := v_shift.s_id;
    site_name := v_shift.s_name;
    same_site := v_shift.s_id = v_inc.site_id;
    shift_id := v_shift.id;
    shift_status := v_shift.status;
    shift_name := v_shift.st_name;
    lat := v_lat;
    lng := v_lng;
    source := v_source;
    recorded_at := v_recorded;
    gap_seconds := v_gap;
    accuracy_m := v_accuracy;
    in_fence := case when v_lat is null then null else public.is_in_fence(v_shift.s_id, v_lat, v_lng) end;
    location_enabled := v_shift.location_enabled;
    distance_m := case
      when v_lat is null or v_origin is null then null
      else extensions.ST_Distance(v_origin, extensions.ST_SetSRID(extensions.ST_MakePoint(v_lng, v_lat), 4326)::extensions.geography)::real
    end;
    -- A fix from long before or after the incident says nothing about where they were then.
    stale := v_lat is null or v_gap is null or v_gap > v_staleness * 60;

    return next;
  end loop;
end $$;

grant execute on function public.incident_guard_positions(uuid) to authenticated;

-- The incident feed also belongs on the live surfaces.
do $$ begin
  alter publication supabase_realtime add table public.incidents;
exception when duplicate_object then null;
end $$;
