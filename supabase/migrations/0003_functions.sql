-- GuardForce domain functions: auth helpers, geofence, attendance, tracking RPCs

-- ---------------------------------------------------------------------------
-- Auth helpers (used by RLS and RPCs)
-- ---------------------------------------------------------------------------
create or replace function public.current_agency_id()
returns uuid language sql stable security definer set search_path = public as $$
  select agency_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_guard_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.guards where profile_id = auth.uid()
$$;

-- Sites the current user may see. Owners/admins: every site in agency. Supervisors: scoped. Guards: their home site.
create or replace function public.accessible_site_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select s.id from public.sites s
  where s.agency_id = public.current_agency_id()
    and (
      public.current_role() in ('owner', 'admin')
      or exists (select 1 from public.supervisor_sites ss where ss.site_id = s.id and ss.profile_id = auth.uid())
      or exists (select 1 from public.guards g where g.profile_id = auth.uid() and g.site_id = s.id)
    )
$$;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() in ('owner', 'admin', 'supervisor')
$$;

create or replace function public.can_access_site(p_site_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_site_id in (select public.accessible_site_ids())
$$;

-- ---------------------------------------------------------------------------
-- Geofence (FENCE-1): buffered fence check
-- ---------------------------------------------------------------------------
create or replace function public.site_distance_m(p_site_id uuid, p_lat double precision, p_lng double precision)
returns real language plpgsql stable security definer set search_path = public, extensions as $$
declare
  s record;
  pt extensions.geography;
  d real;
begin
  select fence_type, radius_m, geom into s from public.sites where id = p_site_id;
  if not found then return null; end if;
  pt := extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography;
  d := extensions.ST_Distance(s.geom, pt);
  if s.fence_type = 'radius' then
    -- distance beyond the radius edge (0 when inside)
    return greatest(d - s.radius_m, 0);
  end if;
  return d; -- polygon: distance to polygon boundary (0 when inside)
end $$;

create or replace function public.is_in_fence(p_site_id uuid, p_lat double precision, p_lng double precision)
returns boolean language plpgsql stable security definer set search_path = public, extensions as $$
declare
  leeway int;
  d real;
begin
  select leeway_m into leeway from public.sites where id = p_site_id;
  d := public.site_distance_m(p_site_id, p_lat, p_lng);
  if d is null then return null; end if;
  return d <= coalesce(leeway, 50);
end $$;

-- ---------------------------------------------------------------------------
-- KYC completeness (KYC-1): mandatory slots verified or at least uploaded
-- ---------------------------------------------------------------------------
create or replace function public.guard_kyc_missing(p_guard_id uuid)
returns text[] language plpgsql stable security definer set search_path = public as $$
declare
  g record;
  missing text[] := '{}';
  t public.document_type;
begin
  select * into g from public.guards where id = p_guard_id;
  if not found then return array['guard'];
  end if;
  if g.phone_verified_at is null then missing := array_append(missing, 'phone_verification'); end if;
  if g.registration_selfie_path is null then missing := array_append(missing, 'registration_selfie'); end if;
  if coalesce(g.designation, '') = '' then missing := array_append(missing, 'designation'); end if;
  foreach t in array array['aadhaar','pan','police_verification','guard_kyc']::public.document_type[] loop
    if not exists (
      select 1 from public.guard_documents d
      where d.guard_id = p_guard_id and d.type = t and d.status <> 'rejected' and d.file_path is not null
    ) then
      missing := array_append(missing, t::text);
    end if;
  end loop;
  return missing;
end $$;

create or replace function public.guard_kyc_complete(p_guard_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select cardinality(public.guard_kyc_missing(p_guard_id)) = 0
$$;

-- Block roster assignment when KYC incomplete
create or replace function public.assignments_require_kyc()
returns trigger language plpgsql as $$
begin
  if not public.guard_kyc_complete(new.guard_id) then
    raise exception 'KYC_INCOMPLETE: guard % cannot be rostered until mandatory KYC is complete (missing: %)',
      new.guard_id, array_to_string(public.guard_kyc_missing(new.guard_id), ', ')
      using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger shift_assignments_require_kyc before insert on public.shift_assignments
  for each row execute function public.assignments_require_kyc();
create trigger roster_patterns_require_kyc before insert on public.roster_patterns
  for each row execute function public.assignments_require_kyc();

-- ---------------------------------------------------------------------------
-- Events helper
-- ---------------------------------------------------------------------------
create or replace function public.emit_event(
  p_agency_id uuid, p_site_id uuid, p_guard_id uuid, p_shift_id uuid,
  p_type public.event_type, p_severity public.event_severity, p_title text, p_payload jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare eid uuid;
begin
  insert into public.events (agency_id, site_id, guard_id, shift_id, type, severity, title, payload)
  values (p_agency_id, p_site_id, p_guard_id, p_shift_id, p_type, p_severity, p_title, coalesce(p_payload, '{}'::jsonb))
  returning id into eid;
  -- fan out warn/critical events to managers as in-app notifications (push/WhatsApp dispatch reads this outbox)
  if p_severity <> 'info' then
    insert into public.notifications (agency_id, recipient_profile_id, channel, title, body, payload, event_id)
    select p_agency_id, p.id, 'in_app', p_title, coalesce(p_payload->>'body', ''), p_payload, eid
    from public.profiles p
    where p.agency_id = p_agency_id and p.is_active
      and (p.role in ('owner', 'admin')
           or (p.role = 'supervisor' and exists (select 1 from public.supervisor_sites ss where ss.profile_id = p.id and ss.site_id = p_site_id)));
  end if;
  return eid;
end $$;

-- ---------------------------------------------------------------------------
-- Roster materialisation: create shift_assignments (and scheduled shifts) for a date range
-- ---------------------------------------------------------------------------
create or replace function public.shift_window(p_date date, p_start time, p_end time, p_tz text)
returns table (starts_at timestamptz, ends_at timestamptz) language sql immutable as $$
  select
    (p_date::text || ' ' || p_start::text)::timestamp at time zone p_tz,
    case when p_end > p_start
      then (p_date::text || ' ' || p_end::text)::timestamp at time zone p_tz
      else ((p_date + 1)::text || ' ' || p_end::text)::timestamp at time zone p_tz
    end
$$;

create or replace function public.materialize_roster(p_agency_id uuid, p_from date, p_to date)
returns int language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  r record;
  d date;
  w record;
  tz text;
  aid uuid;
begin
  select timezone into tz from public.agencies where id = p_agency_id;
  for r in
    select rp.*, st.start_time, st.end_time
    from public.roster_patterns rp join public.shift_types st on st.id = rp.shift_type_id
    where rp.agency_id = p_agency_id and rp.starts_on <= p_to and (rp.ends_on is null or rp.ends_on >= p_from)
  loop
    d := greatest(p_from, r.starts_on);
    while d <= least(p_to, coalesce(r.ends_on, p_to)) loop
      if extract(dow from d)::int = any (r.weekdays) then
        select * into w from public.shift_window(d, r.start_time, r.end_time, tz);
        insert into public.shift_assignments (agency_id, site_id, guard_id, shift_type_id, pattern_id, shift_date, scheduled_start, scheduled_end, created_by)
        values (p_agency_id, r.site_id, r.guard_id, r.shift_type_id, r.id, d, w.starts_at, w.ends_at, r.created_by)
        on conflict (guard_id, shift_date, shift_type_id) do nothing
        returning id into aid;
        -- the shift_assignments_create_shift trigger creates the scheduled shift row
        if aid is not null then n := n + 1; end if;
      end if;
      d := d + 1;
    end loop;
  end loop;
  return n;
end $$;

-- Ad-hoc assignment also creates the scheduled shift row
create or replace function public.assignments_create_shift()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.shifts (agency_id, site_id, guard_id, shift_type_id, assignment_id, shift_date, scheduled_start, scheduled_end)
  values (new.agency_id, new.site_id, new.guard_id, new.shift_type_id, new.id, new.shift_date, new.scheduled_start, new.scheduled_end)
  on conflict (assignment_id) do nothing;
  return new;
end $$;
create trigger shift_assignments_create_shift after insert on public.shift_assignments
  for each row execute function public.assignments_create_shift();

-- ---------------------------------------------------------------------------
-- Attendance computation (ATT-4, LOC-1, LEAVE-1)
-- ---------------------------------------------------------------------------
create or replace function public.compute_trust(p_flags text[], p_accuracy real, p_battery int, p_mock boolean)
returns public.trust_level language sql immutable as $$
  select case
    when p_mock or 'TAMPER_SUSPECTED' = any(p_flags) or 'LOCATION_OFF' = any(p_flags) then 'suspicious'::public.trust_level
    when 'OUTSIDE_FENCE' = any(p_flags) or coalesce(p_accuracy, 0) > 50 or coalesce(p_battery, 100) < 10 or 'SYNCED_LATE' = any(p_flags) then 'flagged'::public.trust_level
    else 'clean'::public.trust_level
  end
$$;

create or replace function public.compute_attendance(p_shift_id uuid)
returns public.attendance_status language plpgsql security definer set search_path = public as $$
declare
  s record;
  a record;
  sched_min numeric;
  ratio numeric;
  result public.attendance_status;
  on_leave boolean;
begin
  select * into s from public.shifts where id = p_shift_id;
  if not found then return null; end if;
  select half_day_ratio into a from public.agencies where id = s.agency_id;

  select exists (
    select 1 from public.leave_requests lr
    where lr.guard_id = s.guard_id and lr.status = 'approved' and s.shift_date between lr.start_date and lr.end_date
  ) into on_leave;

  if s.override_attendance is not null then
    result := s.override_attendance;
  elsif on_leave and s.started_at is null then
    result := 'on_leave';
  elsif s.status = 'void_location_off' then
    result := 'absent';
  elsif s.started_at is null then
    result := case when s.status in ('absent') then 'absent' else 'pending' end;
  else
    sched_min := greatest(extract(epoch from (coalesce(s.scheduled_end, s.ended_at, now()) - coalesce(s.scheduled_start, s.started_at))) / 60, 1);
    ratio := s.worked_minutes / sched_min;
    result := case when ratio >= a.half_day_ratio then 'present' when s.worked_minutes > 0 then 'half_day' else 'absent' end;
  end if;

  update public.shifts set attendance = result where id = p_shift_id;
  return result;
end $$;

-- Away time (BRK-1): sum of intervals between consecutive pings where the earlier ping was outside the fence
create or replace function public.recompute_away_time(p_shift_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare total int;
begin
  select coalesce(sum(extract(epoch from (next_at - recorded_at)))::int, 0) into total
  from (
    select recorded_at, in_fence, lead(recorded_at) over (order by recorded_at) as next_at
    from public.location_pings where shift_id = p_shift_id
  ) t
  where t.in_fence = false and t.next_at is not null;
  update public.shifts set away_seconds = total where id = p_shift_id;
  return total;
end $$;

-- ---------------------------------------------------------------------------
-- Check-in / check-out RPCs (ATT-1..3). Called by the guard app (guard auth) or by
-- the dashboard test harness (service role) with an explicit guard id.
-- ---------------------------------------------------------------------------
create or replace function public.check_in(
  p_guard_id uuid,
  p_site_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m real,
  p_selfie_path text,
  p_captured_at timestamptz default now(),
  p_device jsonb default '{}'::jsonb,
  p_shift_id uuid default null
) returns public.shifts language plpgsql security definer set search_path = public as $$
declare
  g record;
  ag record;
  sh public.shifts;
  in_fence boolean;
  dist real;
  flags text[] := '{}';
  late int := 0;
  is_mock boolean := coalesce((p_device->>'is_mock')::boolean, false);
  battery int := (p_device->>'battery_pct')::int;
  st record;
  w record;
begin
  select * into g from public.guards where id = p_guard_id;
  if not found then raise exception 'GUARD_NOT_FOUND'; end if;
  if auth.uid() is not null and public.current_role() = 'guard' and g.profile_id <> auth.uid() then
    raise exception 'FORBIDDEN';
  end if;
  select * into ag from public.agencies where id = g.agency_id;

  if is_mock then
    perform public.emit_event(g.agency_id, p_site_id, p_guard_id, null, 'TAMPER_SUSPECTED', 'critical',
      g.full_name || ': mock location detected at check-in', jsonb_build_object('lat', p_lat, 'lng', p_lng));
    raise exception 'TAMPER_SUSPECTED: mock location provider detected' using errcode = 'P0002';
  end if;
  if p_selfie_path is null then raise exception 'SELFIE_REQUIRED' using errcode = 'P0003'; end if;

  -- find today's scheduled shift (or the one explicitly given), else create an ad-hoc one
  if p_shift_id is not null then
    select * into sh from public.shifts where id = p_shift_id and guard_id = p_guard_id;
  else
    select * into sh from public.shifts
    where guard_id = p_guard_id and site_id = p_site_id and status = 'scheduled'
      and scheduled_start between now() - interval '6 hours' and now() + interval '6 hours'
    order by abs(extract(epoch from (scheduled_start - now()))) limit 1;
  end if;
  if sh.id is null then
    insert into public.shifts (agency_id, site_id, guard_id, shift_date, scheduled_start, scheduled_end, status)
    values (g.agency_id, p_site_id, p_guard_id, (p_captured_at at time zone ag.timezone)::date, p_captured_at, p_captured_at + interval '8 hours', 'scheduled')
    returning * into sh;
  end if;
  if sh.status <> 'scheduled' then raise exception 'SHIFT_ALREADY_STARTED' using errcode = 'P0004'; end if;

  dist := public.site_distance_m(p_site_id, p_lat, p_lng);
  in_fence := public.is_in_fence(p_site_id, p_lat, p_lng);
  if not in_fence then flags := array_append(flags, 'OUTSIDE_FENCE'); end if;
  if p_accuracy_m is not null and p_accuracy_m > 50 then flags := array_append(flags, 'LOW_ACCURACY'); end if;
  if p_captured_at < now() - interval '5 minutes' then flags := array_append(flags, 'SYNCED_LATE'); end if;
  if sh.scheduled_start is not null then
    late := greatest(0, floor(extract(epoch from (p_captured_at - sh.scheduled_start)) / 60))::int;
    if late > ag.late_threshold_min then flags := array_append(flags, 'LATE_START'); end if;
  end if;

  update public.shifts set
    status = 'in_progress',
    started_at = now(),
    start_captured_at = p_captured_at,
    start_selfie_path = p_selfie_path,
    start_lat = p_lat, start_lng = p_lng, start_accuracy_m = p_accuracy_m,
    start_in_fence = in_fence, start_distance_m = dist,
    flags = flags, late_by_min = late,
    trust = public.compute_trust(flags, p_accuracy_m, battery, false),
    device = coalesce(p_device, '{}'::jsonb),
    location_enabled = true, location_off_since = null
  where id = sh.id returning * into sh;

  insert into public.guard_presence as gp (guard_id, agency_id, site_id, shift_id, lat, lng, accuracy_m, battery_pct, in_fence, last_seen_at)
  values (p_guard_id, g.agency_id, p_site_id, sh.id, p_lat, p_lng, p_accuracy_m, battery, in_fence, now())
  on conflict (guard_id) do update set site_id = excluded.site_id, shift_id = excluded.shift_id, lat = excluded.lat, lng = excluded.lng,
    accuracy_m = excluded.accuracy_m, battery_pct = excluded.battery_pct, in_fence = excluded.in_fence, location_enabled = true,
    last_seen_at = now(), updated_at = now();

  insert into public.location_pings (agency_id, guard_id, shift_id, recorded_at, lat, lng, accuracy_m, battery_pct, in_fence, distance_m)
  values (g.agency_id, p_guard_id, sh.id, p_captured_at, p_lat, p_lng, p_accuracy_m, battery, in_fence, dist);

  perform public.emit_event(g.agency_id, p_site_id, p_guard_id, sh.id, 'CHECK_IN', 'info',
    g.full_name || ' checked in', jsonb_build_object('in_fence', in_fence, 'distance_m', dist, 'late_by_min', late, 'flags', to_jsonb(flags)));
  if not in_fence then
    perform public.emit_event(g.agency_id, p_site_id, p_guard_id, sh.id, 'OUTSIDE_FENCE', 'warn',
      g.full_name || ' checked in outside the site fence', jsonb_build_object('distance_m', dist, 'body', round(dist) || ' m beyond the buffered fence'));
  end if;
  if late > ag.late_threshold_min then
    perform public.emit_event(g.agency_id, p_site_id, p_guard_id, sh.id, 'LATE_START', 'warn',
      g.full_name || ' started ' || late || ' min late', jsonb_build_object('late_by_min', late, 'body', 'Scheduled ' || to_char(sh.scheduled_start at time zone ag.timezone, 'HH24:MI')));
  end if;

  -- schedule patrols for this shift from active routes on the site
  for st in
    select * from public.patrol_routes pr
    where pr.site_id = p_site_id and pr.is_active and (pr.shift_type_id is null or pr.shift_type_id = sh.shift_type_id)
  loop
    insert into public.patrols (agency_id, site_id, route_id, guard_id, shift_id, expected_at, status)
    select g.agency_id, p_site_id, st.id, p_guard_id, sh.id, gs, 'scheduled'
    from generate_series(sh.started_at + make_interval(mins => st.frequency_min), coalesce(sh.scheduled_end, sh.started_at + interval '8 hours'), make_interval(mins => st.frequency_min)) gs;
  end loop;

  return sh;
end $$;

create or replace function public.check_out(
  p_shift_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m real,
  p_selfie_path text,
  p_captured_at timestamptz default now(),
  p_device jsonb default '{}'::jsonb
) returns public.shifts language plpgsql security definer set search_path = public as $$
declare
  sh public.shifts;
  g record;
  ag record;
  in_fence boolean;
  flags text[];
  worked int;
  early boolean := false;
  new_status public.shift_status;
begin
  select * into sh from public.shifts where id = p_shift_id;
  if not found then raise exception 'SHIFT_NOT_FOUND'; end if;
  select * into g from public.guards where id = sh.guard_id;
  if auth.uid() is not null and public.current_role() = 'guard' and g.profile_id <> auth.uid() then
    raise exception 'FORBIDDEN';
  end if;
  if sh.status <> 'in_progress' then raise exception 'SHIFT_NOT_IN_PROGRESS' using errcode = 'P0005'; end if;
  select * into ag from public.agencies where id = sh.agency_id;

  in_fence := public.is_in_fence(sh.site_id, p_lat, p_lng);
  flags := sh.flags;
  worked := greatest(0, floor(extract(epoch from (p_captured_at - coalesce(sh.start_captured_at, sh.started_at))) / 60))::int;
  if sh.scheduled_end is not null and p_captured_at < sh.scheduled_end - interval '15 minutes' then
    early := true; flags := array_append(flags, 'EARLY_CHECKOUT');
  end if;

  -- LOC-1: location still off at shift end -> void
  if sh.location_enabled = false and sh.exception_id is null then
    new_status := 'void_location_off';
    flags := array_append(flags, 'LOCATION_OFF');
  else
    new_status := 'completed';
  end if;

  insert into public.location_pings (agency_id, guard_id, shift_id, recorded_at, lat, lng, accuracy_m, battery_pct, in_fence)
  values (sh.agency_id, sh.guard_id, sh.id, p_captured_at, p_lat, p_lng, p_accuracy_m, (p_device->>'battery_pct')::int, in_fence);
  perform public.recompute_away_time(sh.id);

  update public.shifts set
    status = new_status, ended_at = now(), end_captured_at = p_captured_at, end_selfie_path = p_selfie_path,
    end_lat = p_lat, end_lng = p_lng, end_accuracy_m = p_accuracy_m, end_in_fence = in_fence,
    flags = flags, worked_minutes = worked,
    trust = public.compute_trust(flags, greatest(sh.start_accuracy_m, p_accuracy_m), (p_device->>'battery_pct')::int, false),
    device = sh.device || coalesce(p_device, '{}'::jsonb)
  where id = sh.id returning * into sh;

  perform public.compute_attendance(sh.id);
  select * into sh from public.shifts where id = sh.id;

  update public.guard_presence set shift_id = null, lat = p_lat, lng = p_lng, in_fence = in_fence, last_seen_at = now(), updated_at = now()
  where guard_id = sh.guard_id;

  -- mark patrols that never started as missed
  update public.patrols set status = 'missed' where shift_id = sh.id and status = 'scheduled';

  perform public.emit_event(sh.agency_id, sh.site_id, sh.guard_id, sh.id, 'CHECK_OUT', 'info',
    g.full_name || ' checked out', jsonb_build_object('worked_minutes', worked, 'away_seconds', sh.away_seconds, 'attendance', sh.attendance));
  if early then
    perform public.emit_event(sh.agency_id, sh.site_id, sh.guard_id, sh.id, 'EARLY_CHECKOUT', 'warn',
      g.full_name || ' checked out early', jsonb_build_object('body', 'Scheduled end ' || to_char(sh.scheduled_end at time zone ag.timezone, 'HH24:MI')));
  end if;
  if new_status = 'void_location_off' then
    perform public.emit_event(sh.agency_id, sh.site_id, sh.guard_id, sh.id, 'SHIFT_VOID', 'critical',
      g.full_name || ': shift void — location was off', jsonb_build_object('location_off_seconds', sh.location_off_seconds, 'body', 'Log an exception if this was a genuine device failure'));
  end if;
  return sh;
end $$;

-- ---------------------------------------------------------------------------
-- Location ping ingestion (TRACK-1, F5). Accepts a batch (offline sync friendly).
-- pings: [{recorded_at, lat, lng, accuracy_m, speed_mps, battery_pct, is_mock}]
-- ---------------------------------------------------------------------------
create or replace function public.ingest_pings(p_shift_id uuid, p_pings jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  sh public.shifts;
  g record;
  p jsonb;
  n int := 0;
  prev_in boolean;
  cur_in boolean;
  dist real;
  lat double precision; lng double precision;
  rec_at timestamptz;
begin
  select * into sh from public.shifts where id = p_shift_id;
  if not found then raise exception 'SHIFT_NOT_FOUND'; end if;
  select * into g from public.guards where id = sh.guard_id;
  if auth.uid() is not null and public.current_role() = 'guard' and g.profile_id <> auth.uid() then
    raise exception 'FORBIDDEN';
  end if;

  select in_fence into prev_in from public.location_pings where shift_id = p_shift_id order by recorded_at desc limit 1;

  for p in select * from jsonb_array_elements(p_pings) loop
    lat := (p->>'lat')::double precision; lng := (p->>'lng')::double precision;
    rec_at := coalesce((p->>'recorded_at')::timestamptz, now());
    dist := public.site_distance_m(sh.site_id, lat, lng);
    cur_in := dist <= (select leeway_m from public.sites where id = sh.site_id);
    insert into public.location_pings (agency_id, guard_id, shift_id, recorded_at, lat, lng, accuracy_m, speed_mps, battery_pct, is_mock, in_fence, distance_m)
    values (sh.agency_id, sh.guard_id, sh.id, rec_at, lat, lng, (p->>'accuracy_m')::real, (p->>'speed_mps')::real,
            (p->>'battery_pct')::int, coalesce((p->>'is_mock')::boolean, false), cur_in, dist);
    n := n + 1;

    if coalesce((p->>'is_mock')::boolean, false) and not ('TAMPER_SUSPECTED' = any(sh.flags)) then
      update public.shifts set flags = array_append(flags, 'TAMPER_SUSPECTED'), trust = 'suspicious' where id = sh.id returning * into sh;
      perform public.emit_event(sh.agency_id, sh.site_id, sh.guard_id, sh.id, 'TAMPER_SUSPECTED', 'critical',
        g.full_name || ': mock location during shift', jsonb_build_object('lat', lat, 'lng', lng));
    end if;

    if prev_in is distinct from cur_in and prev_in is not null then
      if cur_in then
        perform public.emit_event(sh.agency_id, sh.site_id, sh.guard_id, sh.id, 'FENCE_ENTER', 'info', g.full_name || ' re-entered the site', jsonb_build_object('at', rec_at));
      else
        perform public.emit_event(sh.agency_id, sh.site_id, sh.guard_id, sh.id, 'FENCE_EXIT', 'warn', g.full_name || ' left the site fence',
          jsonb_build_object('at', rec_at, 'distance_m', dist, 'body', round(dist) || ' m outside'));
      end if;
    end if;
    prev_in := cur_in;

    insert into public.guard_presence as gp (guard_id, agency_id, site_id, shift_id, lat, lng, accuracy_m, battery_pct, in_fence, is_mock, location_enabled, last_seen_at)
    values (sh.guard_id, sh.agency_id, sh.site_id, sh.id, lat, lng, (p->>'accuracy_m')::real, (p->>'battery_pct')::int, cur_in, coalesce((p->>'is_mock')::boolean, false), true, rec_at)
    on conflict (guard_id) do update set site_id = excluded.site_id, shift_id = excluded.shift_id, lat = excluded.lat, lng = excluded.lng,
      accuracy_m = excluded.accuracy_m, battery_pct = excluded.battery_pct, in_fence = excluded.in_fence, is_mock = excluded.is_mock,
      location_enabled = true, last_seen_at = greatest(gp.last_seen_at, excluded.last_seen_at), updated_at = now();
  end loop;

  -- location came back on
  if sh.location_enabled = false then
    update public.shifts set location_enabled = true,
      location_off_seconds = location_off_seconds + coalesce(extract(epoch from (now() - location_off_since))::int, 0),
      location_off_since = null where id = sh.id;
    perform public.emit_event(sh.agency_id, sh.site_id, sh.guard_id, sh.id, 'LOCATION_ON', 'info', g.full_name || ' turned location back on', '{}'::jsonb);
  end if;

  perform public.recompute_away_time(sh.id);
  return n;
end $$;

-- Guard app reports that location services were switched off (LOC-1)
create or replace function public.report_location_state(p_shift_id uuid, p_enabled boolean, p_at timestamptz default now())
returns void language plpgsql security definer set search_path = public as $$
declare sh public.shifts; g record;
begin
  select * into sh from public.shifts where id = p_shift_id;
  if not found then raise exception 'SHIFT_NOT_FOUND'; end if;
  select * into g from public.guards where id = sh.guard_id;
  if p_enabled = sh.location_enabled then return; end if;
  if p_enabled then
    update public.shifts set location_enabled = true,
      location_off_seconds = location_off_seconds + coalesce(extract(epoch from (p_at - location_off_since))::int, 0),
      location_off_since = null where id = sh.id;
    update public.guard_presence set location_enabled = true, updated_at = now() where guard_id = sh.guard_id;
    perform public.emit_event(sh.agency_id, sh.site_id, sh.guard_id, sh.id, 'LOCATION_ON', 'info', g.full_name || ' turned location back on', jsonb_build_object('at', p_at));
  else
    update public.shifts set location_enabled = false, location_off_since = p_at,
      flags = case when 'LOCATION_OFF' = any(flags) then flags else array_append(flags, 'LOCATION_OFF') end,
      trust = 'suspicious', last_warned_at = p_at where id = sh.id;
    update public.guard_presence set location_enabled = false, updated_at = now() where guard_id = sh.guard_id;
    perform public.emit_event(sh.agency_id, sh.site_id, sh.guard_id, sh.id, 'LOCATION_OFF', 'critical', g.full_name || ' turned location OFF',
      jsonb_build_object('at', p_at, 'body', 'Shift will be void unless location is re-enabled or an exception is logged'));
  end if;
end $$;

-- Manager exception (LOC-3): counts a void shift; audit-logged
create or replace function public.log_shift_exception(p_shift_id uuid, p_reason text, p_category text default 'device_failure')
returns public.shifts language plpgsql security definer set search_path = public as $$
declare sh public.shifts; ex_id uuid; g record;
begin
  select * into sh from public.shifts where id = p_shift_id;
  if not found then raise exception 'SHIFT_NOT_FOUND'; end if;
  if not public.is_manager() or not public.can_access_site(sh.site_id) then raise exception 'FORBIDDEN'; end if;
  insert into public.shift_exceptions (agency_id, shift_id, logged_by, reason, category)
  values (sh.agency_id, sh.id, auth.uid(), p_reason, p_category) returning id into ex_id;
  update public.shifts set exception_id = ex_id,
    status = case when status = 'void_location_off' then 'completed' else status end
  where id = sh.id returning * into sh;
  perform public.compute_attendance(sh.id);
  select * into sh from public.shifts where id = sh.id;
  insert into public.audit_logs (agency_id, actor_id, entity_type, entity_id, action, reason, after)
  values (sh.agency_id, auth.uid(), 'shift', sh.id, 'exception_logged', p_reason, jsonb_build_object('category', p_category, 'status', sh.status, 'attendance', sh.attendance));
  select * into g from public.guards where id = sh.guard_id;
  perform public.emit_event(sh.agency_id, sh.site_id, sh.guard_id, sh.id, 'EXCEPTION_LOGGED', 'info', 'Exception logged for ' || g.full_name, jsonb_build_object('reason', p_reason, 'category', p_category));
  return sh;
end $$;

-- Attendance override (AUD-1)
create or replace function public.override_attendance(p_shift_id uuid, p_attendance public.attendance_status, p_reason text)
returns public.shifts language plpgsql security definer set search_path = public as $$
declare sh public.shifts; before_j jsonb; g record;
begin
  select * into sh from public.shifts where id = p_shift_id;
  if not found then raise exception 'SHIFT_NOT_FOUND'; end if;
  if not public.is_manager() or not public.can_access_site(sh.site_id) then raise exception 'FORBIDDEN'; end if;
  if coalesce(length(p_reason), 0) < 5 then raise exception 'REASON_REQUIRED' using errcode = 'P0006'; end if;
  before_j := jsonb_build_object('attendance', sh.attendance, 'status', sh.status);
  update public.shifts set override_attendance = p_attendance, override_by = auth.uid(), override_reason = p_reason, override_at = now(),
    attendance = p_attendance,
    status = case when status in ('scheduled', 'absent') and p_attendance in ('present', 'half_day') then 'completed' else status end
  where id = sh.id returning * into sh;
  insert into public.audit_logs (agency_id, actor_id, entity_type, entity_id, action, reason, before, after)
  values (sh.agency_id, auth.uid(), 'shift', sh.id, 'attendance_override', p_reason, before_j, jsonb_build_object('attendance', p_attendance));
  select * into g from public.guards where id = sh.guard_id;
  perform public.emit_event(sh.agency_id, sh.site_id, sh.guard_id, sh.id, 'ATTENDANCE_OVERRIDE', 'info', 'Attendance corrected for ' || g.full_name,
    jsonb_build_object('from', before_j->>'attendance', 'to', p_attendance, 'reason', p_reason));
  return sh;
end $$;

-- ---------------------------------------------------------------------------
-- Patrols RPCs
-- ---------------------------------------------------------------------------
create or replace function public.start_patrol(p_patrol_id uuid, p_at timestamptz default now())
returns public.patrols language plpgsql security definer set search_path = public as $$
declare p public.patrols; r record; g record;
begin
  select * into p from public.patrols where id = p_patrol_id;
  if not found then raise exception 'PATROL_NOT_FOUND'; end if;
  select * into r from public.patrol_routes where id = p.route_id;
  update public.patrols set started_at = p_at,
    status = (case when p.expected_at is not null and p_at > p.expected_at + make_interval(mins => coalesce(r.grace_min, 15)) then 'late' else 'in_progress' end)::public.patrol_status
  where id = p.id returning * into p;
  select * into g from public.guards where id = p.guard_id;
  perform public.emit_event(p.agency_id, p.site_id, p.guard_id, p.shift_id, 'PATROL_STARTED', 'info', g.full_name || ' started patrol ' || coalesce(r.name, ''), jsonb_build_object('patrol_id', p.id));
  if p.status = 'late' then
    perform public.emit_event(p.agency_id, p.site_id, p.guard_id, p.shift_id, 'PATROL_LATE', 'warn', g.full_name || ': patrol started late', jsonb_build_object('patrol_id', p.id, 'expected_at', p.expected_at));
  end if;
  return p;
end $$;

create or replace function public.complete_patrol(p_patrol_id uuid, p_trail jsonb, p_photos jsonb default '[]'::jsonb, p_at timestamptz default now(), p_notes text default null)
returns public.patrols language plpgsql security definer set search_path = public as $$
declare p public.patrols; s record; r record; g record; ph jsonb; n_photos int; dist real;
begin
  select * into p from public.patrols where id = p_patrol_id;
  if not found then raise exception 'PATROL_NOT_FOUND'; end if;
  select * into s from public.sites where id = p.site_id;
  select * into r from public.patrol_routes where id = p.route_id;
  n_photos := coalesce(jsonb_array_length(p_photos), 0);
  if s.patrol_photo_required and n_photos < coalesce(r.min_photos, 1) then
    raise exception 'PATROL_PHOTO_REQUIRED: this site requires at least % photo(s)', coalesce(r.min_photos, 1) using errcode = 'P0007';
  end if;
  dist := null;
  if p_trail is not null and p_trail->>'type' = 'LineString' and jsonb_array_length(p_trail->'coordinates') > 1 then
    dist := extensions.ST_Length(extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(p_trail::text), 4326)::extensions.geography);
  end if;
  for ph in select * from jsonb_array_elements(p_photos) loop
    insert into public.patrol_photos (agency_id, patrol_id, file_path, lat, lng, taken_at, caption)
    values (p.agency_id, p.id, ph->>'file_path', (ph->>'lat')::double precision, (ph->>'lng')::double precision, coalesce((ph->>'taken_at')::timestamptz, p_at), ph->>'caption');
  end loop;
  update public.patrols set ended_at = p_at, trail = p_trail, distance_m = dist,
    duration_s = extract(epoch from (p_at - coalesce(started_at, p_at)))::int,
    status = (case when status = 'late' then 'late' else 'completed' end)::public.patrol_status, notes = p_notes
  where id = p.id returning * into p;
  select * into g from public.guards where id = p.guard_id;
  perform public.emit_event(p.agency_id, p.site_id, p.guard_id, p.shift_id, 'PATROL_COMPLETED', 'info', g.full_name || ' completed patrol ' || coalesce(r.name, ''),
    jsonb_build_object('patrol_id', p.id, 'distance_m', dist, 'photos', n_photos));
  return p;
end $$;

-- Sweep: mark overdue patrols missed, detect late starts for scheduled shifts, outages. Run by cron / on dashboard load.
create or replace function public.run_monitors(p_agency_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ag record; n_missed int := 0; n_late int := 0; n_outage int := 0; n_absent int := 0; r record;
begin
  select * into ag from public.agencies where id = p_agency_id;

  -- missed patrols (expected + frequency window elapsed, never started)
  for r in
    select p.*, g.full_name, pr.name as route_name, pr.grace_min
    from public.patrols p join public.guards g on g.id = p.guard_id left join public.patrol_routes pr on pr.id = p.route_id
    where p.agency_id = p_agency_id and p.status = 'scheduled' and p.expected_at + make_interval(mins => coalesce(pr.grace_min, 15) * 2) < now()
  loop
    update public.patrols set status = 'missed' where id = r.id;
    perform public.emit_event(p_agency_id, r.site_id, r.guard_id, r.shift_id, 'PATROL_MISSED', 'warn', r.full_name || ' missed patrol ' || coalesce(r.route_name, ''),
      jsonb_build_object('patrol_id', r.id, 'expected_at', r.expected_at, 'body', 'Expected ' || to_char(r.expected_at at time zone ag.timezone, 'HH24:MI')));
    n_missed := n_missed + 1;
  end loop;

  -- late starts: scheduled shift not started past threshold, alert once
  for r in
    select s.*, g.full_name from public.shifts s join public.guards g on g.id = s.guard_id
    where s.agency_id = p_agency_id and s.status = 'scheduled' and s.scheduled_start + make_interval(mins => ag.late_threshold_min) < now()
      and s.scheduled_end > now()
      and not exists (select 1 from public.events e where e.shift_id = s.id and e.type = 'LATE_START')
      and not exists (select 1 from public.leave_requests lr where lr.guard_id = s.guard_id and lr.status = 'approved' and s.shift_date between lr.start_date and lr.end_date)
  loop
    perform public.emit_event(p_agency_id, r.site_id, r.guard_id, r.id, 'LATE_START', 'warn', r.full_name || ' has not started the shift',
      jsonb_build_object('scheduled_start', r.scheduled_start, 'body', 'Scheduled ' || to_char(r.scheduled_start at time zone ag.timezone, 'HH24:MI')));
    n_late := n_late + 1;
  end loop;

  -- no-shows: scheduled end passed, never started -> absent (or on_leave)
  for r in
    select s.* from public.shifts s
    where s.agency_id = p_agency_id and s.status = 'scheduled' and s.scheduled_end < now()
  loop
    update public.shifts set status = 'absent' where id = r.id;
    perform public.compute_attendance(r.id);
    n_absent := n_absent + 1;
  end loop;

  -- outages: in-progress shift with no ping for > threshold, alert once per silence window
  for r in
    select s.*, g.full_name, gp.last_seen_at from public.shifts s
      join public.guards g on g.id = s.guard_id
      left join public.guard_presence gp on gp.guard_id = s.guard_id
    where s.agency_id = p_agency_id and s.status = 'in_progress' and s.location_enabled
      and coalesce(gp.last_seen_at, s.started_at) + make_interval(mins => ag.outage_threshold_min) < now()
      and not exists (select 1 from public.events e where e.shift_id = s.id and e.type = 'OUTAGE' and e.created_at > coalesce(gp.last_seen_at, s.started_at))
  loop
    perform public.emit_event(p_agency_id, r.site_id, r.guard_id, r.id, 'OUTAGE', 'warn', r.full_name || ': no location for ' || ag.outage_threshold_min || '+ min',
      jsonb_build_object('last_seen_at', r.last_seen_at, 'body', 'Last seen ' || to_char(coalesce(r.last_seen_at, r.started_at) at time zone ag.timezone, 'HH24:MI')));
    n_outage := n_outage + 1;
  end loop;

  -- overdue tasks
  update public.tasks set status = 'missed' where agency_id = p_agency_id and status in ('pending', 'in_progress') and due_at < now() - interval '30 minutes';
  update public.task_assignments ta set status = 'missed' from public.tasks t where t.id = ta.task_id and t.status = 'missed' and ta.status in ('pending', 'in_progress');

  return jsonb_build_object('missed_patrols', n_missed, 'late_starts', n_late, 'outages', n_outage, 'absent', n_absent);
end $$;

-- ---------------------------------------------------------------------------
-- Leave decisions (LEAVE-1)
-- ---------------------------------------------------------------------------
create or replace function public.decide_leave(p_leave_id uuid, p_approve boolean, p_note text default null)
returns public.leave_requests language plpgsql security definer set search_path = public as $$
declare lr public.leave_requests; g record; days int;
begin
  select * into lr from public.leave_requests where id = p_leave_id;
  if not found then raise exception 'LEAVE_NOT_FOUND'; end if;
  if not public.is_manager() then raise exception 'FORBIDDEN'; end if;
  if lr.status <> 'pending' then raise exception 'LEAVE_ALREADY_DECIDED' using errcode = 'P0008'; end if;
  update public.leave_requests set status = (case when p_approve then 'approved' else 'declined' end)::public.leave_status,
    decided_by = auth.uid(), decided_at = now(), decision_note = p_note where id = lr.id returning * into lr;
  if p_approve then
    days := lr.end_date - lr.start_date + 1;
    insert into public.leave_balances (guard_id, agency_id, year) values (lr.guard_id, lr.agency_id, extract(year from lr.start_date)::int)
    on conflict do nothing;
    update public.leave_balances set
      casual_used = casual_used + case when lr.type = 'casual' then days else 0 end,
      earned_used = earned_used + case when lr.type = 'earned' then days else 0 end,
      unpaid_used = unpaid_used + case when lr.type = 'unpaid' then days else 0 end
    where guard_id = lr.guard_id and year = extract(year from lr.start_date)::int;
    -- roster days become ON_LEAVE
    update public.shifts set attendance = 'on_leave', status = 'cancelled'
    where guard_id = lr.guard_id and shift_date between lr.start_date and lr.end_date and status = 'scheduled';
  end if;
  select * into g from public.guards where id = lr.guard_id;
  perform public.emit_event(lr.agency_id, lr.site_id, lr.guard_id, null, 'LEAVE_DECIDED', 'info',
    'Leave ' || lr.status || ' for ' || g.full_name, jsonb_build_object('leave_id', lr.id, 'type', lr.type, 'from', lr.start_date, 'to', lr.end_date));
  insert into public.notifications (agency_id, recipient_guard_id, channel, title, body, payload)
  values (lr.agency_id, lr.guard_id, 'push', 'Leave ' || lr.status, coalesce(p_note, ''), jsonb_build_object('leave_id', lr.id));
  return lr;
end $$;

-- ---------------------------------------------------------------------------
-- Dashboard aggregates (F9)
-- ---------------------------------------------------------------------------
create or replace function public.site_day_summary(p_agency_id uuid, p_date date)
returns table (
  site_id uuid, site_name text, guards_required int,
  scheduled int, present int, half_day int, absent int, on_leave int, flagged int, on_duty_now int, pending int
) language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.guards_required,
    count(sh.id)::int,
    count(sh.id) filter (where sh.attendance = 'present')::int,
    count(sh.id) filter (where sh.attendance = 'half_day')::int,
    count(sh.id) filter (where sh.attendance = 'absent')::int,
    count(sh.id) filter (where sh.attendance = 'on_leave')::int,
    count(sh.id) filter (where sh.trust in ('flagged', 'suspicious'))::int,
    count(sh.id) filter (where sh.status = 'in_progress')::int,
    count(sh.id) filter (where sh.attendance = 'pending')::int
  from public.sites s
  left join public.shifts sh on sh.site_id = s.id and sh.shift_date = p_date
  where s.agency_id = p_agency_id and s.is_active and s.id in (select public.accessible_site_ids())
  group by s.id, s.name, s.guards_required
  order by s.name
$$;

create or replace function public.attendance_trend(p_agency_id uuid, p_from date, p_to date, p_site_id uuid default null)
returns table (day date, present int, half_day int, absent int, on_leave int, flagged int, scheduled int)
language sql stable security definer set search_path = public as $$
  select d::date,
    count(sh.id) filter (where sh.attendance = 'present')::int,
    count(sh.id) filter (where sh.attendance = 'half_day')::int,
    count(sh.id) filter (where sh.attendance = 'absent')::int,
    count(sh.id) filter (where sh.attendance = 'on_leave')::int,
    count(sh.id) filter (where sh.trust in ('flagged', 'suspicious'))::int,
    count(sh.id)::int
  from generate_series(p_from, p_to, interval '1 day') d
  left join public.shifts sh on sh.shift_date = d::date and sh.agency_id = p_agency_id
    and (p_site_id is null or sh.site_id = p_site_id) and sh.site_id in (select public.accessible_site_ids())
  group by d order by d
$$;

create or replace function public.guard_scorecard(p_guard_id uuid, p_from date, p_to date)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'shifts', count(*),
    'present', count(*) filter (where attendance = 'present'),
    'half_day', count(*) filter (where attendance = 'half_day'),
    'absent', count(*) filter (where attendance = 'absent'),
    'on_leave', count(*) filter (where attendance = 'on_leave'),
    'punctuality_pct', case when count(*) filter (where started_at is not null) = 0 then null
      else round(100.0 * count(*) filter (where started_at is not null and not ('LATE_START' = any(flags))) / count(*) filter (where started_at is not null), 1) end,
    'avg_away_min', round(coalesce(avg(away_seconds) filter (where ended_at is not null), 0) / 60.0, 1),
    'flagged', count(*) filter (where trust in ('flagged', 'suspicious')),
    'void', count(*) filter (where status = 'void_location_off'),
    'missed_patrols', (select count(*) from public.patrols p where p.guard_id = p_guard_id and p.status = 'missed' and p.expected_at::date between p_from and p_to),
    'patrols', (select count(*) from public.patrols p where p.guard_id = p_guard_id and p.expected_at::date between p_from and p_to),
    'worked_hours', round(coalesce(sum(worked_minutes), 0) / 60.0, 1)
  )
  from public.shifts where guard_id = p_guard_id and shift_date between p_from and p_to
$$;

-- Public shareable profile (KYC-2): resolved by token, no auth. Increments view count.
create or replace function public.resolve_profile_share(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sh record; g record; a record; docs jsonb; score jsonb;
begin
  select * into sh from public.profile_shares where token = p_token;
  if not found then return jsonb_build_object('error', 'NOT_FOUND'); end if;
  if sh.revoked_at is not null then return jsonb_build_object('error', 'REVOKED'); end if;
  if sh.expires_at < now() then return jsonb_build_object('error', 'EXPIRED'); end if;
  update public.profile_shares set view_count = view_count + 1, last_viewed_at = now() where id = sh.id;
  select * into g from public.guards where id = sh.guard_id;
  select * into a from public.agencies where id = sh.agency_id;
  select coalesce(jsonb_agg(jsonb_build_object('type', d.type, 'status', d.status, 'number_masked', d.number_masked, 'verified_at', d.verified_at, 'issued_on', d.issued_on, 'file_path', case when sh.include_documents then d.file_path end) order by d.type), '[]'::jsonb)
    into docs from public.guard_documents d where d.guard_id = g.id;
  insert into public.document_access_logs (agency_id, document_id, share_id, purpose)
  select sh.agency_id, d.id, sh.id, 'share_link' from public.guard_documents d where d.guard_id = g.id and sh.include_documents;
  score := public.guard_scorecard(g.id, current_date - 90, current_date);
  return jsonb_build_object(
    'share', jsonb_build_object('id', sh.id, 'expires_at', sh.expires_at, 'label', sh.label, 'include_documents', sh.include_documents, 'created_at', sh.created_at),
    'agency', jsonb_build_object('name', a.name, 'city', a.city, 'logo_path', a.logo_path),
    'guard', jsonb_build_object('id', g.id, 'full_name', g.full_name, 'employee_code', g.employee_code, 'designation', g.designation, 'phone_masked', 'XXXXXX' || right(g.phone, 4),
      'joined_at', g.joined_at, 'status', g.status, 'registration_selfie_path', g.registration_selfie_path, 'phone_verified', g.phone_verified_at is not null,
      'kyc_complete', public.guard_kyc_complete(g.id), 'site', (select name from public.sites where id = g.site_id), 'languages', g.languages),
    'documents', docs,
    'scorecard', score
  );
end $$;

grant execute on function public.resolve_profile_share(text) to anon, authenticated;
