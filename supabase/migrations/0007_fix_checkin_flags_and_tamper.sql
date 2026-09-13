-- check_in/check_out declared a local `flags` variable while also assigning the
-- shifts.flags column, which Postgres rejects as an ambiguous reference (42702) the
-- moment either function runs. Renamed to v_flags.
--
-- The mock-GPS branch of check_in also emitted a TAMPER_SUSPECTED event and then raised,
-- which rolled the event back with the rest of the transaction, so blocked attempts left
-- no trace. Reporting now lives in its own committed call, public.report_tamper().

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
  v_in_fence boolean;
  v_dist real;
  v_flags text[] := '{}';
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
    -- The raise below rolls back this transaction, so the event cannot be written here.
    -- The app calls public.report_tamper() straight after the failure; see that function.
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

  v_dist := public.site_distance_m(p_site_id, p_lat, p_lng);
  v_in_fence := public.is_in_fence(p_site_id, p_lat, p_lng);
  if not v_in_fence then v_flags := array_append(v_flags, 'OUTSIDE_FENCE'); end if;
  if p_accuracy_m is not null and p_accuracy_m > 50 then v_flags := array_append(v_flags, 'LOW_ACCURACY'); end if;
  if p_captured_at < now() - interval '5 minutes' then v_flags := array_append(v_flags, 'SYNCED_LATE'); end if;
  if sh.scheduled_start is not null then
    late := greatest(0, floor(extract(epoch from (p_captured_at - sh.scheduled_start)) / 60))::int;
    if late > ag.late_threshold_min then v_flags := array_append(v_flags, 'LATE_START'); end if;
  end if;

  update public.shifts set
    status = 'in_progress',
    started_at = now(),
    start_captured_at = p_captured_at,
    start_selfie_path = p_selfie_path,
    start_lat = p_lat, start_lng = p_lng, start_accuracy_m = p_accuracy_m,
    start_in_fence = v_in_fence, start_distance_m = v_dist,
    flags = v_flags, late_by_min = late,
    trust = public.compute_trust(v_flags, p_accuracy_m, battery, false),
    device = coalesce(p_device, '{}'::jsonb),
    location_enabled = true, location_off_since = null
  where id = sh.id returning * into sh;

  insert into public.guard_presence as gp (guard_id, agency_id, site_id, shift_id, lat, lng, accuracy_m, battery_pct, in_fence, last_seen_at)
  values (p_guard_id, g.agency_id, p_site_id, sh.id, p_lat, p_lng, p_accuracy_m, battery, v_in_fence, now())
  on conflict (guard_id) do update set site_id = excluded.site_id, shift_id = excluded.shift_id, lat = excluded.lat, lng = excluded.lng,
    accuracy_m = excluded.accuracy_m, battery_pct = excluded.battery_pct, in_fence = excluded.in_fence, location_enabled = true,
    last_seen_at = now(), updated_at = now();

  insert into public.location_pings (agency_id, guard_id, shift_id, recorded_at, lat, lng, accuracy_m, battery_pct, in_fence, distance_m)
  values (g.agency_id, p_guard_id, sh.id, p_captured_at, p_lat, p_lng, p_accuracy_m, battery, v_in_fence, v_dist);

  perform public.emit_event(g.agency_id, p_site_id, p_guard_id, sh.id, 'CHECK_IN', 'info',
    g.full_name || ' checked in', jsonb_build_object('in_fence', v_in_fence, 'distance_m', v_dist, 'late_by_min', late, 'flags', to_jsonb(v_flags)));
  if not v_in_fence then
    perform public.emit_event(g.agency_id, p_site_id, p_guard_id, sh.id, 'OUTSIDE_FENCE', 'warn',
      g.full_name || ' checked in outside the site fence', jsonb_build_object('distance_m', v_dist, 'body', round(v_dist) || ' m beyond the buffered fence'));
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
  v_in_fence boolean;
  v_flags text[];
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

  v_in_fence := public.is_in_fence(sh.site_id, p_lat, p_lng);
  v_flags := sh.flags;
  worked := greatest(0, floor(extract(epoch from (p_captured_at - coalesce(sh.start_captured_at, sh.started_at))) / 60))::int;
  if sh.scheduled_end is not null and p_captured_at < sh.scheduled_end - interval '15 minutes' then
    early := true; v_flags := array_append(v_flags, 'EARLY_CHECKOUT');
  end if;

  -- LOC-1: location still off at shift end -> void
  if sh.location_enabled = false and sh.exception_id is null then
    new_status := 'void_location_off';
    if not ('LOCATION_OFF' = any(v_flags)) then v_flags := array_append(v_flags, 'LOCATION_OFF'); end if;
  else
    new_status := 'completed';
  end if;

  insert into public.location_pings (agency_id, guard_id, shift_id, recorded_at, lat, lng, accuracy_m, battery_pct, in_fence)
  values (sh.agency_id, sh.guard_id, sh.id, p_captured_at, p_lat, p_lng, p_accuracy_m, (p_device->>'battery_pct')::int, v_in_fence);
  perform public.recompute_away_time(sh.id);

  update public.shifts set
    status = new_status, ended_at = now(), end_captured_at = p_captured_at, end_selfie_path = p_selfie_path,
    end_lat = p_lat, end_lng = p_lng, end_accuracy_m = p_accuracy_m, end_in_fence = v_in_fence,
    flags = v_flags, worked_minutes = worked,
    trust = public.compute_trust(v_flags, greatest(sh.start_accuracy_m, p_accuracy_m), (p_device->>'battery_pct')::int, false),
    device = sh.device || coalesce(p_device, '{}'::jsonb)
  where id = sh.id returning * into sh;

  perform public.compute_attendance(sh.id);
  select * into sh from public.shifts where id = sh.id;

  update public.guard_presence set shift_id = null, lat = p_lat, lng = p_lng, in_fence = v_in_fence, last_seen_at = now(), updated_at = now()
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

-- ATT-3: records a blocked check-in attempt. Called by the guard app right after
-- check_in fails with TAMPER_SUSPECTED, and usable on its own for any tamper signal.
create or replace function public.report_tamper(
  p_guard_id uuid,
  p_site_id uuid,
  p_lat double precision default null,
  p_lng double precision default null,
  p_detail text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  g record;
begin
  select * into g from public.guards where id = p_guard_id;
  if not found then raise exception 'GUARD_NOT_FOUND'; end if;
  if auth.uid() is not null and public.current_role() = 'guard' and g.profile_id <> auth.uid() then
    raise exception 'FORBIDDEN';
  end if;
  return public.emit_event(
    g.agency_id, p_site_id, p_guard_id, null, 'TAMPER_SUSPECTED', 'critical',
    g.full_name || ': mock location detected at check-in',
    jsonb_build_object('lat', p_lat, 'lng', p_lng, 'detail', p_detail, 'body', 'Check-in was blocked')
  );
end $$;

grant execute on function public.report_tamper(uuid, uuid, double precision, double precision, text) to authenticated;
