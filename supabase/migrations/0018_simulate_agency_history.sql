-- Demo history generator, extracted from `seed.sql` so more than one tenant can use it.
--
-- It walks a tenant's already-materialised shifts and invents the past: check-ins with
-- their lateness and trust flags, location breadcrumbs, fence exits, outages, patrol
-- rounds with photos, and the events feed that all of it would have raised. Shifts that
-- straddle `now()` are left in progress so the live map has something on it.
--
-- This replaces an inline `do $$` block that began `select * into ag from public.agencies
-- limit 1`, which silently generated every tenant's history against the first agency in
-- the table. Taking the id as an argument fixes that and lets the Eagle demo script
-- (`supabase/demo/eagle.sql`) reuse it instead of carrying a copy.
--
-- Seeding only. Nothing in the app calls this, and it is not granted to any app role.
create or replace function public.simulate_agency_history(p_agency_id uuid)
returns void language plpgsql
set search_path = public, extensions as $fn$
declare
  s record;
  ag record;
  outcome numeric;
  st timestamptz; en timestamptz;
  late int; worked int;
  fl text[];
  tr public.trust_level;
  site record;
  ping_t timestamptz;
  jitter_lat double precision; jitter_lng double precision;
  inside boolean;
  d real;
  away int;
  route record;
  p_expected timestamptz;
  n_ping int;
  pid uuid;
  rt record;
  batt int;
  live_idx int := 0;
begin
  select * into ag from public.agencies where id = p_agency_id;
  if ag.id is null then raise exception 'NO_SUCH_AGENCY: %', p_agency_id; end if;

  for s in
    select sh.*, g.full_name from public.shifts sh join public.guards g on g.id = sh.guard_id
    where sh.agency_id = p_agency_id and sh.status = 'scheduled' and sh.scheduled_start < now()
    order by sh.scheduled_start
  loop
    select * into site from public.sites where id = s.site_id;
    outcome := random();
    batt := 20 + (random() * 75)::int;

    -- ---------------- currently running shifts (started, not yet due to end)
    if s.scheduled_end > now() then
      -- Scenarios are assigned by ordinal among live shifts so the demo is time-of-day independent:
      -- 1 = late / no-show (left scheduled), 2 = checked in outside fence, 3 = wandered out mid-shift,
      -- 4 = location switched off, 5 = outage (stale), rest = normal.
      live_idx := live_idx + 1;
      if live_idx = 1 then
        continue;
      end if;
      late := case when random() < 0.25 then 5 + (random() * 30)::int else (random() * 8)::int end;
      st := s.scheduled_start + make_interval(mins => late);
      if st > now() then st := now() - interval '3 minutes'; end if;
      fl := '{}';
      if late > ag.late_threshold_min then fl := array_append(fl, 'LATE_START'); end if;
      inside := true;
      -- Prakash (009) checks in outside the fence; Gopal (012) turned location off mid-shift
      if live_idx = 2 then inside := false; fl := array_append(fl, 'OUTSIDE_FENCE'); end if;
      tr := public.compute_trust(fl, 12, batt, false);
      update public.shifts set status = 'in_progress', started_at = st, start_captured_at = st,
        start_selfie_path = ag.id || '/selfies/' || s.id || '/start.jpg',
        start_lat = site.lat + (case when inside then 0.0002 else 0.0045 end), start_lng = site.lng + 0.0001, start_accuracy_m = 8 + random() * 20,
        start_in_fence = inside, start_distance_m = case when inside then 0 else 420 end,
        flags = fl, late_by_min = late, trust = tr,
        device = jsonb_build_object('battery_pct', batt, 'model', (array['Redmi 9A','Samsung M12','Realme C11','Vivo Y20'])[1 + (random() * 3)::int], 'app_version', '1.0.0', 'is_mock', false)
      where id = s.id;
      insert into public.events (agency_id, site_id, guard_id, shift_id, type, severity, title, payload, created_at)
      values (ag.id, s.site_id, s.guard_id, s.id, 'CHECK_IN', 'info', s.full_name || ' checked in', jsonb_build_object('in_fence', inside, 'late_by_min', late), st);
      if not inside then
        insert into public.events (agency_id, site_id, guard_id, shift_id, type, severity, title, payload, created_at)
        values (ag.id, s.site_id, s.guard_id, s.id, 'OUTSIDE_FENCE', 'warn', s.full_name || ' checked in outside the site fence', jsonb_build_object('distance_m', 420, 'body', '420 m beyond the buffered fence'), st);
      end if;
      if late > ag.late_threshold_min then
        insert into public.events (agency_id, site_id, guard_id, shift_id, type, severity, title, payload, created_at)
        values (ag.id, s.site_id, s.guard_id, s.id, 'LATE_START', 'warn', s.full_name || ' started ' || late || ' min late', jsonb_build_object('late_by_min', late), st);
      end if;

      -- breadcrumb pings every ~5 minutes until now; one guard wanders out for 25 min
      ping_t := st; n_ping := 0; away := 0;
      while ping_t < now() loop
        n_ping := n_ping + 1;
        inside := true;
        if live_idx = 3 and n_ping between 8 and 12 then inside := false; end if;
        if live_idx = 2 and n_ping < 3 then inside := false; end if;
        jitter_lat := site.lat + (random() - 0.5) * 0.0012 + case when inside then 0 else 0.004 end;
        jitter_lng := site.lng + (random() - 0.5) * 0.0012;
        d := public.site_distance_m(site.id, jitter_lat, jitter_lng);
        insert into public.location_pings (agency_id, guard_id, shift_id, recorded_at, lat, lng, accuracy_m, speed_mps, battery_pct, in_fence, distance_m)
        values (ag.id, s.guard_id, s.id, ping_t, jitter_lat, jitter_lng, 6 + random() * 25, random() * 1.5, greatest(5, batt - n_ping / 3), d <= site.leeway_m, d);
        ping_t := ping_t + make_interval(mins => 4 + (random() * 3)::int);
      end loop;
      perform public.recompute_away_time(s.id);

      -- fence exit / enter events for the wanderer
      if live_idx = 3 then
        insert into public.events (agency_id, site_id, guard_id, shift_id, type, severity, title, payload, created_at)
        select ag.id, s.site_id, s.guard_id, s.id, 'FENCE_EXIT', 'warn', s.full_name || ' left the site fence', jsonb_build_object('distance_m', 380, 'body', '380 m outside'), min(recorded_at)
        from public.location_pings where shift_id = s.id and in_fence = false having count(*) > 0;
        insert into public.events (agency_id, site_id, guard_id, shift_id, type, severity, title, payload, created_at)
        select ag.id, s.site_id, s.guard_id, s.id, 'FENCE_ENTER', 'info', s.full_name || ' re-entered the site', '{}'::jsonb, max(recorded_at) + interval '4 minutes'
        from public.location_pings where shift_id = s.id and in_fence = false having count(*) > 0;
      end if;

      -- presence row
      insert into public.guard_presence (guard_id, agency_id, site_id, shift_id, lat, lng, accuracy_m, battery_pct, in_fence, location_enabled, last_seen_at)
      select s.guard_id, ag.id, s.site_id, s.id, lat, lng, accuracy_m, battery_pct, in_fence, true, recorded_at
      from public.location_pings where shift_id = s.id order by recorded_at desc limit 1;

      -- location off for the last 40 minutes
      if live_idx = 4 then
        update public.shifts set location_enabled = false, location_off_since = now() - interval '40 minutes', trust = 'suspicious',
          flags = array_append(flags, 'LOCATION_OFF'), last_warned_at = now() - interval '10 minutes' where id = s.id;
        update public.guard_presence set location_enabled = false, last_seen_at = now() - interval '40 minutes' where guard_id = s.guard_id;
        delete from public.location_pings where shift_id = s.id and recorded_at > now() - interval '40 minutes';
        insert into public.events (agency_id, site_id, guard_id, shift_id, type, severity, title, payload, created_at)
        values (ag.id, s.site_id, s.guard_id, s.id, 'LOCATION_OFF', 'critical', s.full_name || ' turned location OFF', jsonb_build_object('body', 'Shift will be void unless location is re-enabled or an exception is logged'), now() - interval '40 minutes');
      end if;
      -- stale (no pings for 22 min) -> outage
      if live_idx = 5 then
        delete from public.location_pings where shift_id = s.id and recorded_at > now() - interval '22 minutes';
        update public.guard_presence set last_seen_at = now() - interval '22 minutes' where guard_id = s.guard_id;
        insert into public.events (agency_id, site_id, guard_id, shift_id, type, severity, title, payload, created_at)
        values (ag.id, s.site_id, s.guard_id, s.id, 'OUTAGE', 'warn', s.full_name || ': no location for 10+ min', jsonb_build_object('body', 'Last seen ' || to_char((now() - interval '22 minutes') at time zone ag.timezone, 'HH24:MI')), now() - interval '12 minutes');
      end if;

      -- patrols for this live shift
      for route in select * from public.patrol_routes pr where pr.site_id = s.site_id and pr.is_active loop
        p_expected := st + make_interval(mins => route.frequency_min);
        while p_expected < s.scheduled_end loop
          insert into public.patrols (agency_id, site_id, route_id, guard_id, shift_id, expected_at, status)
          values (ag.id, s.site_id, route.id, s.guard_id, s.id, p_expected, 'scheduled') returning id into pid;
          if p_expected + make_interval(mins => route.grace_min * 2) < now() then
            -- past due: completed (most), late, or missed
            if random() < 0.15 then
              update public.patrols set status = 'missed' where id = pid;
              insert into public.events (agency_id, site_id, guard_id, shift_id, type, severity, title, payload, created_at)
              values (ag.id, s.site_id, s.guard_id, s.id, 'PATROL_MISSED', 'warn', s.full_name || ' missed patrol ' || route.name, jsonb_build_object('patrol_id', pid), p_expected + make_interval(mins => route.grace_min * 2));
            else
              update public.patrols set started_at = p_expected + make_interval(mins => (random() * 25)::int) where id = pid;
              update public.patrols set ended_at = started_at + make_interval(mins => 12 + (random() * 15)::int),
                status = (case when started_at > expected_at + make_interval(mins => route.grace_min) then 'late' else 'completed' end)::public.patrol_status,
                distance_m = 300 + random() * 500, duration_s = 720 + (random() * 900)::int,
                trail = jsonb_build_object('type', 'LineString', 'coordinates', jsonb_build_array(
                  jsonb_build_array(site.lng, site.lat), jsonb_build_array(site.lng + 0.0008, site.lat + 0.0004),
                  jsonb_build_array(site.lng + 0.0009, site.lat - 0.0005), jsonb_build_array(site.lng - 0.0004, site.lat - 0.0006), jsonb_build_array(site.lng, site.lat)))
              where id = pid;
              insert into public.patrol_photos (agency_id, patrol_id, file_path, lat, lng, taken_at)
              select ag.id, pid, ag.id || '/patrols/' || pid || '/' || i || '.jpg', site.lat + 0.0003 * i, site.lng + 0.0002 * i, p.started_at + make_interval(mins => 4 * i)
              from public.patrols p, generate_series(1, route.min_photos) i where p.id = pid;
              insert into public.events (agency_id, site_id, guard_id, shift_id, type, severity, title, payload, created_at)
              select ag.id, s.site_id, s.guard_id, s.id, 'PATROL_COMPLETED', 'info', s.full_name || ' completed patrol ' || route.name, jsonb_build_object('patrol_id', pid, 'photos', route.min_photos), coalesce(ended_at, now()) from public.patrols where id = pid;
            end if;
          elsif p_expected < now() - interval '3 minutes' and random() < 0.5 then
            update public.patrols set status = 'in_progress', started_at = now() - interval '6 minutes' where id = pid;
          end if;
          p_expected := p_expected + make_interval(mins => route.frequency_min);
        end loop;
      end loop;
      continue;
    end if;

    -- ---------------- completed history
    if outcome < 0.06 then
      update public.shifts set status = 'absent', attendance = 'absent' where id = s.id;
      continue;
    end if;
    late := case when random() < 0.2 then 16 + (random() * 40)::int else (random() * 12)::int end;
    st := s.scheduled_start + make_interval(mins => late);
    fl := '{}';
    if late > ag.late_threshold_min then fl := array_append(fl, 'LATE_START'); end if;
    if outcome < 0.14 then
      -- half day
      en := st + make_interval(mins => 150 + (random() * 60)::int);
      fl := array_append(fl, 'EARLY_CHECKOUT');
    elsif outcome < 0.19 then
      en := s.scheduled_end - make_interval(mins => 30 + (random() * 40)::int);
      fl := array_append(fl, 'EARLY_CHECKOUT');
    else
      en := s.scheduled_end + make_interval(mins => (random() * 10)::int - 3);
    end if;
    inside := random() > 0.08;
    if not inside then fl := array_append(fl, 'OUTSIDE_FENCE'); end if;
    if random() < 0.04 then fl := array_append(fl, 'SYNCED_LATE'); end if;
    worked := greatest(0, extract(epoch from (en - st)) / 60)::int;
    away := case when random() < 0.35 then (random() * 2400)::int else (random() * 300)::int end;
    tr := public.compute_trust(fl, 10, batt, false);

    update public.shifts set status = 'completed', started_at = st, start_captured_at = st, ended_at = en, end_captured_at = en,
      start_selfie_path = ag.id || '/selfies/' || s.id || '/start.jpg', end_selfie_path = ag.id || '/selfies/' || s.id || '/end.jpg',
      start_lat = site.lat + 0.0002, start_lng = site.lng - 0.0001, start_accuracy_m = 7 + random() * 20, start_in_fence = inside, start_distance_m = case when inside then 0 else 300 end,
      end_lat = site.lat - 0.0001, end_lng = site.lng + 0.0002, end_accuracy_m = 9 + random() * 20, end_in_fence = true,
      flags = fl, late_by_min = late, worked_minutes = worked, away_seconds = away, trust = tr,
      device = jsonb_build_object('battery_pct', batt, 'model', (array['Redmi 9A','Samsung M12','Realme C11','Vivo Y20'])[1 + (random() * 3)::int], 'app_version', '1.0.0')
    where id = s.id;
    perform public.compute_attendance(s.id);

    -- a sparse trail (every ~30 min) so day views have data without millions of rows
    ping_t := st;
    while ping_t < en loop
      insert into public.location_pings (agency_id, guard_id, shift_id, recorded_at, lat, lng, accuracy_m, battery_pct, in_fence, distance_m)
      values (ag.id, s.guard_id, s.id, ping_t, site.lat + (random() - 0.5) * 0.001, site.lng + (random() - 0.5) * 0.001, 8 + random() * 20, batt, true, 0);
      ping_t := ping_t + interval '30 minutes';
    end loop;

    insert into public.events (agency_id, site_id, guard_id, shift_id, type, severity, title, payload, created_at) values
      (ag.id, s.site_id, s.guard_id, s.id, 'CHECK_IN', 'info', s.full_name || ' checked in', jsonb_build_object('in_fence', inside, 'late_by_min', late), st),
      (ag.id, s.site_id, s.guard_id, s.id, 'CHECK_OUT', 'info', s.full_name || ' checked out', jsonb_build_object('worked_minutes', worked), en);
    if late > ag.late_threshold_min then
      insert into public.events (agency_id, site_id, guard_id, shift_id, type, severity, title, payload, created_at)
      values (ag.id, s.site_id, s.guard_id, s.id, 'LATE_START', 'warn', s.full_name || ' started ' || late || ' min late', jsonb_build_object('late_by_min', late), st);
    end if;
    if not inside then
      insert into public.events (agency_id, site_id, guard_id, shift_id, type, severity, title, payload, created_at)
      values (ag.id, s.site_id, s.guard_id, s.id, 'OUTSIDE_FENCE', 'warn', s.full_name || ' checked in outside the site fence', jsonb_build_object('distance_m', 300), st);
    end if;

    -- patrol history
    for route in select * from public.patrol_routes pr where pr.site_id = s.site_id and pr.is_active loop
      p_expected := st + make_interval(mins => route.frequency_min);
      while p_expected < en loop
        insert into public.patrols (agency_id, site_id, route_id, guard_id, shift_id, expected_at, status)
        values (ag.id, s.site_id, route.id, s.guard_id, s.id, p_expected, 'scheduled') returning id into pid;
        if random() < 0.12 then
          update public.patrols set status = 'missed' where id = pid;
        else
          update public.patrols set started_at = p_expected + make_interval(mins => (random() * 28)::int) where id = pid;
          update public.patrols set ended_at = started_at + make_interval(mins => 10 + (random() * 15)::int),
            status = (case when started_at > expected_at + make_interval(mins => route.grace_min) then 'late' else 'completed' end)::public.patrol_status,
            distance_m = 300 + random() * 500, duration_s = 600 + (random() * 900)::int where id = pid;
          insert into public.patrol_photos (agency_id, patrol_id, file_path, lat, lng, taken_at)
          select ag.id, pid, ag.id || '/patrols/' || pid || '/' || i || '.jpg', site.lat, site.lng, p.started_at + make_interval(mins => 3 * i)
          from public.patrols p, generate_series(1, route.min_photos) i where p.id = pid;
        end if;
        p_expected := p_expected + make_interval(mins => route.frequency_min);
      end loop;
    end loop;
  end loop;

  -- one void shift 3 days ago (Anil, night) with an exception logged the next morning on a different one
  update public.shifts set status = 'void_location_off', attendance = 'absent', trust = 'suspicious',
    flags = array_append(flags, 'LOCATION_OFF'), location_off_seconds = 5400
  where guard_id = 'e0000000-0000-4000-8000-000000000005' and shift_date = current_date - 3;
  insert into public.events (agency_id, site_id, guard_id, shift_id, type, severity, title, payload, created_at)
  select agency_id, site_id, guard_id, id, 'SHIFT_VOID', 'critical', 'Anil Kumar Sahu: shift void — location was off', jsonb_build_object('location_off_seconds', 5400), coalesce(ended_at, scheduled_end)
  from public.shifts where guard_id = 'e0000000-0000-4000-8000-000000000005' and shift_date = current_date - 3;

  -- a supervisor override with audit trail (Lakshmi, 8 days ago, wrongly absent)
  update public.shifts set override_attendance = 'present', attendance = 'present', status = 'completed', override_by = 'b0000000-0000-4000-8000-000000000002',
    override_reason = 'Guard was present; phone battery died before check-in. Verified with client security desk.', override_at = now() - interval '7 days'
  where guard_id = 'e0000000-0000-4000-8000-000000000007' and shift_date = current_date - 8;
  insert into public.audit_logs (agency_id, actor_id, entity_type, entity_id, action, reason, before, after, created_at)
  select agency_id, 'b0000000-0000-4000-8000-000000000002', 'shift', id, 'attendance_override', override_reason, '{"attendance":"absent"}'::jsonb, '{"attendance":"present"}'::jsonb, now() - interval '7 days'
  from public.shifts where guard_id = 'e0000000-0000-4000-8000-000000000007' and shift_date = current_date - 8;

  -- tamper event 2 days ago for Imran
  insert into public.events (agency_id, site_id, guard_id, shift_id, type, severity, title, payload, created_at)
  select agency_id, site_id, guard_id, id, 'TAMPER_SUSPECTED', 'critical', 'Imran Pasha: mock location during shift', '{"lat":13.03,"lng":77.54}'::jsonb, started_at + interval '90 minutes'
  from public.shifts where guard_id = 'e0000000-0000-4000-8000-000000000011' and shift_date = current_date - 2 and started_at is not null;
  update public.shifts set flags = array_append(flags, 'TAMPER_SUSPECTED'), trust = 'suspicious'
  where guard_id = 'e0000000-0000-4000-8000-000000000011' and shift_date = current_date - 2 and started_at is not null;

  -- leave events
  insert into public.events (agency_id, site_id, guard_id, type, severity, title, payload, created_at)
  select agency_id, site_id, guard_id, 'LEAVE_REQUESTED', 'info', (select full_name from public.guards g where g.id = lr.guard_id) || ' requested ' || type || ' leave', jsonb_build_object('leave_id', id, 'from', start_date, 'to', end_date), created_at
  from public.leave_requests lr where status = 'pending';
end
$fn$;

revoke all on function public.simulate_agency_history(uuid) from public, anon, authenticated;
