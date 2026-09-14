-- Guard app contract.
--
-- Guards authenticate with phone + OTP through GoTrue (SMS signups on), which yields an
-- auth.users row with a phone but no tenant membership. claim_guard_account() links that
-- user to the guards row carrying the same phone: it creates the guard-kind profile that
-- every RLS policy keys on (current_agency_id / current_guard_id) and marks the invite
-- accepted. From then on the app unlocks with a PIN (set_guard_pin / verify_guard_pin) and
-- the existing shift RPCs (check_in, ingest_pings, ...) work under the guard's own JWT.
--
-- Everything the app needs at launch comes from two calls, guard_me() and guard_home(),
-- so a budget phone on 2G makes one round trip per screen rather than six.

-- ---------------------------------------------------------------------------
-- 1. Devices: one row per install, not per FCM token
-- ---------------------------------------------------------------------------
alter table public.devices add column if not exists install_id text;
create unique index if not exists devices_guard_install_idx on public.devices(guard_id, install_id) where install_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Phone normalisation: the last ten digits, whatever the country-code formatting
-- ---------------------------------------------------------------------------
create or replace function public.normalize_phone(p_phone text)
returns text language sql immutable as $$
  select right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10)
$$;

-- ---------------------------------------------------------------------------
-- 3. Bootstrap payloads
-- ---------------------------------------------------------------------------
create or replace function public.guard_me()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  g public.guards;
  s public.sites;
  ag public.agencies;
  cfg public.app_config;
  sup public.profiles;
  v_docs jsonb;
begin
  select * into g from public.guards where profile_id = auth.uid();
  if not found then raise exception 'NO_GUARD_FOR_PHONE' using errcode = 'P0013'; end if;
  select * into ag from public.agencies where id = g.agency_id;
  select * into s from public.sites where id = g.site_id;
  select * into cfg from public.app_config where agency_id = g.agency_id;
  select * into sup from public.profiles where id = g.supervisor_id;
  select coalesce(jsonb_agg(jsonb_build_object('type', d.type, 'status', d.status, 'has_file', d.file_path is not null) order by d.type), '[]'::jsonb)
    into v_docs from public.guard_documents d where d.guard_id = g.id;

  return jsonb_build_object(
    'guard', jsonb_build_object(
      'id', g.id, 'agency_id', g.agency_id, 'employee_code', g.employee_code, 'full_name', g.full_name,
      'phone', g.phone, 'designation', g.designation, 'site_id', g.site_id, 'status', g.status,
      'registration_selfie_path', g.registration_selfie_path, 'has_pin', g.pin_hash is not null,
      'languages', to_jsonb(g.languages), 'joined_at', g.joined_at, 'phone_verified_at', g.phone_verified_at),
    'kyc_missing', to_jsonb(public.guard_kyc_missing(g.id)),
    'documents', v_docs,
    'supervisor', case when sup.id is null then null else jsonb_build_object('name', sup.full_name, 'phone', sup.phone) end,
    'site', case when s.id is null then null else jsonb_build_object(
      'id', s.id, 'name', s.name, 'client_name', s.client_name, 'address', s.address, 'lat', s.lat, 'lng', s.lng,
      'fence_type', s.fence_type, 'radius_m', s.radius_m, 'polygon', s.polygon, 'leeway_m', s.leeway_m,
      'patrol_photo_required', s.patrol_photo_required) end,
    'agency', jsonb_build_object(
      'id', ag.id, 'name', ag.name, 'status', ag.status, 'timezone', ag.timezone,
      'late_threshold_min', ag.late_threshold_min, 'location_off_warn_min', ag.location_off_warn_min,
      'outage_threshold_min', ag.outage_threshold_min),
    'config', case when cfg.agency_id is null then null else jsonb_build_object(
      'min_app_version', cfg.min_app_version, 'ota_channel', cfg.ota_channel,
      'ping_interval_moving_s', cfg.ping_interval_moving_s, 'ping_interval_stationary_s', cfg.ping_interval_stationary_s,
      'selfie_max_kb', cfg.selfie_max_kb, 'photo_max_kb', cfg.photo_max_kb, 'features', cfg.features) end,
    'server_time', now()
  );
end $$;

-- Today's work for the home screen: nearby shifts, the shift on duty, its patrols, open tasks.
create or replace function public.guard_home()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  g public.guards;
  ag public.agencies;
  v_today date;
  v_active public.shifts;
  v_shifts jsonb;
  v_patrols jsonb;
  v_tasks jsonb;
  v_unread int;
begin
  select * into g from public.guards where profile_id = auth.uid();
  if not found then raise exception 'NO_GUARD_FOR_PHONE' using errcode = 'P0013'; end if;
  select * into ag from public.agencies where id = g.agency_id;
  v_today := (now() at time zone ag.timezone)::date;

  select * into v_active from public.shifts where guard_id = g.id and status = 'in_progress' order by started_at desc limit 1;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.scheduled_start), '[]'::jsonb) into v_shifts
  from (
    select sh.id, sh.site_id, s.name as site_name, sh.shift_date, sh.scheduled_start, sh.scheduled_end, sh.status, sh.attendance,
           sh.started_at, sh.start_captured_at, sh.ended_at, sh.flags, sh.trust, sh.late_by_min, sh.worked_minutes, sh.away_seconds,
           sh.location_enabled, sh.location_off_seconds, sh.exception_id is not null as has_exception, st.name as shift_type
    from public.shifts sh
    join public.sites s on s.id = sh.site_id
    left join public.shift_types st on st.id = sh.shift_type_id
    where sh.guard_id = g.id and (sh.shift_date between v_today - 1 and v_today + 1 or sh.id = v_active.id)
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.expected_at), '[]'::jsonb) into v_patrols
  from (
    select p.id, p.route_id, r.name as route_name, r.min_photos, r.frequency_min, r.grace_min, p.expected_at, p.started_at, p.ended_at, p.status, p.distance_m, p.duration_s
    from public.patrols p left join public.patrol_routes r on r.id = p.route_id
    where p.guard_id = g.id and (p.shift_id = v_active.id or (v_active.id is null and p.expected_at::date = v_today))
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.due_at nulls last), '[]'::jsonb) into v_tasks
  from (
    select t.id, t.title, t.description, t.due_at, t.photo_required, t.site_id, s.name as site_name, ta.status, ta.started_at, ta.completed_at, ta.photo_path
    from public.task_assignments ta
    join public.tasks t on t.id = ta.task_id
    join public.sites s on s.id = t.site_id
    where ta.guard_id = g.id and ta.status in ('pending', 'in_progress')
      and (t.due_at is null or t.due_at > now() - interval '2 days')
  ) x;

  select count(*)::int into v_unread from public.notifications where recipient_guard_id = g.id and read_at is null;

  return jsonb_build_object(
    'today', v_today,
    'server_time', now(),
    'active_shift_id', v_active.id,
    'shifts', v_shifts,
    'patrols', v_patrols,
    'tasks', v_tasks,
    'unread_notifications', v_unread
  );
end $$;

-- ---------------------------------------------------------------------------
-- 4. Account claim after phone OTP
-- ---------------------------------------------------------------------------
create or replace function public.claim_guard_account()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  g public.guards;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = 'P0010'; end if;
  select public.normalize_phone(phone) into v_phone from auth.users where id = v_uid;
  if v_phone is null or length(v_phone) < 10 then raise exception 'PHONE_REQUIRED' using errcode = 'P0011'; end if;

  select * into g from public.guards where profile_id = v_uid;
  if not found then
    select * into g from public.guards
    where public.normalize_phone(phone) = v_phone and profile_id is null
    order by created_at desc limit 1;
    if not found then
      if exists (select 1 from public.guards where public.normalize_phone(phone) = v_phone) then
        raise exception 'PHONE_ALREADY_LINKED' using errcode = 'P0012';
      end if;
      raise exception 'NO_GUARD_FOR_PHONE' using errcode = 'P0013';
    end if;

    insert into public.profiles (id, agency_id, role, full_name, phone, all_sites)
    values (v_uid, g.agency_id, 'guard', g.full_name, g.phone, false)
    on conflict (id) do update set agency_id = excluded.agency_id, role = 'guard', full_name = excluded.full_name, phone = excluded.phone;

    update public.guards set
      profile_id = v_uid,
      phone_verified_at = coalesce(phone_verified_at, now()),
      status = case when status = 'invited' then 'active' else status end,
      joined_at = coalesce(joined_at, now())
    where id = g.id returning * into g;

    update public.guard_invites set accepted_at = now() where guard_id = g.id and accepted_at is null;
  end if;

  return public.guard_me();
end $$;

-- ---------------------------------------------------------------------------
-- 5. PIN, registration selfie, device
-- ---------------------------------------------------------------------------
create or replace function public.set_guard_pin(p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_pin !~ '^\d{4,6}$' then raise exception 'PIN_INVALID' using errcode = 'P0014'; end if;
  update public.guards set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')) where profile_id = auth.uid();
  if not found then raise exception 'NO_GUARD_FOR_PHONE' using errcode = 'P0013'; end if;
end $$;

create or replace function public.verify_guard_pin(p_pin text)
returns boolean language plpgsql stable security definer set search_path = public, extensions as $$
declare v_hash text;
begin
  select pin_hash into v_hash from public.guards where profile_id = auth.uid();
  return v_hash is not null and v_hash = extensions.crypt(coalesce(p_pin, ''), v_hash);
end $$;

create or replace function public.set_registration_selfie(p_path text)
returns void language plpgsql security definer set search_path = public as $$
declare g public.guards;
begin
  select * into g from public.guards where profile_id = auth.uid();
  if not found then raise exception 'NO_GUARD_FOR_PHONE' using errcode = 'P0013'; end if;
  if public.storage_agency_prefix(p_path) is distinct from g.agency_id then raise exception 'BAD_PATH' using errcode = 'P0017'; end if;
  update public.guards set registration_selfie_path = p_path where id = g.id;
end $$;

create or replace function public.register_device(
  p_install_id text,
  p_fcm_token text default null,
  p_model text default null,
  p_os_version text default null,
  p_app_version text default null,
  p_bundle_version text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare g public.guards; v_id uuid;
begin
  select * into g from public.guards where profile_id = auth.uid();
  if not found then raise exception 'NO_GUARD_FOR_PHONE' using errcode = 'P0013'; end if;
  if p_install_id is null or length(p_install_id) < 8 then raise exception 'INSTALL_ID_REQUIRED' using errcode = 'P0018'; end if;
  -- an FCM token belongs to exactly one install; the phone that has it now wins
  if p_fcm_token is not null then
    update public.devices set fcm_token = null where fcm_token = p_fcm_token and (guard_id is distinct from g.id or install_id is distinct from p_install_id);
  end if;
  insert into public.devices as d (agency_id, guard_id, profile_id, fcm_token, platform, device_model, os_version, app_version, bundle_version, install_id, last_seen_at)
  values (g.agency_id, g.id, g.profile_id, p_fcm_token, 'android', p_model, p_os_version, p_app_version, p_bundle_version, p_install_id, now())
  on conflict (guard_id, install_id) where install_id is not null do update set
    fcm_token = coalesce(excluded.fcm_token, d.fcm_token), device_model = coalesce(excluded.device_model, d.device_model),
    os_version = coalesce(excluded.os_version, d.os_version), app_version = coalesce(excluded.app_version, d.app_version),
    bundle_version = coalesce(excluded.bundle_version, d.bundle_version), last_seen_at = now()
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Guard-side writes: tasks and leave
-- ---------------------------------------------------------------------------
create or replace function public.start_task(p_task_id uuid, p_at timestamptz default now())
returns public.task_assignments language plpgsql security definer set search_path = public as $$
declare v_gid uuid := public.current_guard_id(); ta public.task_assignments;
begin
  if v_gid is null then raise exception 'FORBIDDEN'; end if;
  update public.task_assignments set status = 'in_progress', started_at = coalesce(started_at, p_at)
  where task_id = p_task_id and guard_id = v_gid and status = 'pending' returning * into ta;
  if not found then
    select * into ta from public.task_assignments where task_id = p_task_id and guard_id = v_gid;
    if not found then raise exception 'TASK_NOT_FOUND'; end if;
  end if;
  update public.tasks set status = 'in_progress' where id = p_task_id and status = 'pending';
  return ta;
end $$;

create or replace function public.complete_task(
  p_task_id uuid,
  p_photo_path text default null,
  p_note text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_at timestamptz default now()
) returns public.task_assignments language plpgsql security definer set search_path = public as $$
declare v_gid uuid := public.current_guard_id(); t public.tasks; ta public.task_assignments; g public.guards;
begin
  if v_gid is null then raise exception 'FORBIDDEN'; end if;
  select * into t from public.tasks where id = p_task_id;
  if not found then raise exception 'TASK_NOT_FOUND'; end if;
  select * into ta from public.task_assignments where task_id = p_task_id and guard_id = v_gid;
  if not found then raise exception 'FORBIDDEN'; end if;
  if ta.status = 'done' then return ta; end if; -- offline retries are idempotent
  if t.photo_required and p_photo_path is null then raise exception 'TASK_PHOTO_REQUIRED' using errcode = 'P0015'; end if;

  update public.task_assignments set status = 'done', started_at = coalesce(started_at, p_at), completed_at = p_at,
    photo_path = p_photo_path, note = p_note, lat = p_lat, lng = p_lng
  where task_id = p_task_id and guard_id = v_gid returning * into ta;
  if not exists (select 1 from public.task_assignments where task_id = p_task_id and status <> 'done') then
    update public.tasks set status = 'done' where id = p_task_id;
  end if;
  select * into g from public.guards where id = v_gid;
  perform public.emit_event(t.agency_id, t.site_id, v_gid, null, 'TASK_DONE', 'info', g.full_name || ' completed task: ' || t.title,
    jsonb_build_object('task_id', t.id, 'photo', p_photo_path is not null, 'note', p_note));
  return ta;
end $$;

create or replace function public.apply_leave(p_type public.leave_type, p_start date, p_end date, p_reason text default null)
returns public.leave_requests language plpgsql security definer set search_path = public as $$
declare g public.guards; lr public.leave_requests;
begin
  select * into g from public.guards where profile_id = auth.uid();
  if not found then raise exception 'NO_GUARD_FOR_PHONE' using errcode = 'P0013'; end if;
  if p_end < p_start then raise exception 'LEAVE_DATES_INVALID' using errcode = 'P0016'; end if;
  if exists (select 1 from public.leave_requests where guard_id = g.id and status in ('pending', 'approved') and start_date <= p_end and end_date >= p_start) then
    raise exception 'LEAVE_OVERLAP' using errcode = 'P0019';
  end if;
  insert into public.leave_balances (guard_id, agency_id, year) values (g.id, g.agency_id, extract(year from p_start)::int) on conflict do nothing;
  insert into public.leave_requests (agency_id, guard_id, site_id, type, start_date, end_date, reason)
  values (g.agency_id, g.id, g.site_id, p_type, p_start, p_end, p_reason) returning * into lr;
  perform public.emit_event(g.agency_id, g.site_id, g.id, null, 'LEAVE_REQUESTED', 'info',
    g.full_name || ' applied for ' || p_type || ' leave', jsonb_build_object('leave_id', lr.id, 'from', p_start, 'to', p_end, 'reason', p_reason));
  -- the people who decide leave get an in-app notification (severity stays info so it is not an alert)
  insert into public.notifications (agency_id, recipient_profile_id, channel, title, body, payload)
  select g.agency_id, p.id, 'in_app', 'Leave request from ' || g.full_name,
    p_type || ' leave ' || to_char(p_start, 'DD Mon') || case when p_end <> p_start then ' to ' || to_char(p_end, 'DD Mon') else '' end,
    jsonb_build_object('leave_id', lr.id)
  from public.profiles p
  where p.agency_id = g.agency_id and p.is_active and p.role <> 'guard'
    and (p.role = 'owner' or p.all_sites or exists (select 1 from public.supervisor_sites ss where ss.profile_id = p.id and ss.site_id = g.site_id));
  return lr;
end $$;

create or replace function public.cancel_leave(p_leave_id uuid)
returns public.leave_requests language plpgsql security definer set search_path = public as $$
declare v_gid uuid := public.current_guard_id(); lr public.leave_requests;
begin
  update public.leave_requests set status = 'cancelled' where id = p_leave_id and guard_id = v_gid and status = 'pending' returning * into lr;
  if not found then raise exception 'LEAVE_NOT_CANCELLABLE' using errcode = 'P0020'; end if;
  return lr;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------------------
grant execute on function public.normalize_phone(text) to authenticated;
grant execute on function public.guard_me() to authenticated;
grant execute on function public.guard_home() to authenticated;
grant execute on function public.claim_guard_account() to authenticated;
grant execute on function public.set_guard_pin(text) to authenticated;
grant execute on function public.verify_guard_pin(text) to authenticated;
grant execute on function public.set_registration_selfie(text) to authenticated;
grant execute on function public.register_device(text, text, text, text, text, text) to authenticated;
grant execute on function public.start_task(uuid, timestamptz) to authenticated;
grant execute on function public.complete_task(uuid, text, text, double precision, double precision, timestamptz) to authenticated;
grant execute on function public.apply_leave(public.leave_type, date, date, text) to authenticated;
grant execute on function public.cancel_leave(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. ROLE-1: guards see only their own data.
--    The site-scope branch of every read policy was written for staff, but a guard's home
--    site is also in accessible_site_ids(), so a guard signed in from the app could list
--    every colleague at the site (with phone, address, date of birth), their shifts, pings
--    and leave. Site scope now applies to dashboard members only; guards keep the own-row
--    branch. Policies the guard needs for reference data (sites, shift_types, patrol_routes,
--    task_templates) are unchanged.
-- ---------------------------------------------------------------------------
drop policy guards_select on public.guards;
create policy guards_select on public.guards for select using (
  agency_id = public.current_agency_id() and (
    profile_id = auth.uid()
    or (public.is_manager() and (public.sees_all_sites() or site_id in (select public.accessible_site_ids()) or site_id is null))
  )
);

drop policy roster_patterns_select on public.roster_patterns;
create policy roster_patterns_select on public.roster_patterns for select using (
  guard_id = public.current_guard_id() or (public.is_manager() and site_id in (select public.accessible_site_ids()))
);

drop policy shift_assignments_select on public.shift_assignments;
create policy shift_assignments_select on public.shift_assignments for select using (
  guard_id = public.current_guard_id() or (public.is_manager() and site_id in (select public.accessible_site_ids()))
);

drop policy shifts_select on public.shifts;
create policy shifts_select on public.shifts for select using (
  guard_id = public.current_guard_id() or (public.is_manager() and site_id in (select public.accessible_site_ids()))
);

drop policy location_pings_select on public.location_pings;
create policy location_pings_select on public.location_pings for select using (
  agency_id = public.current_agency_id() and (
    guard_id = public.current_guard_id()
    or (public.is_manager() and exists (select 1 from public.shifts s where s.id = shift_id and s.site_id in (select public.accessible_site_ids())))
  )
);

drop policy guard_presence_select on public.guard_presence;
create policy guard_presence_select on public.guard_presence for select using (
  agency_id = public.current_agency_id() and (
    guard_id = public.current_guard_id()
    or (public.is_manager() and (public.sees_all_sites() or site_id in (select public.accessible_site_ids())))
  )
);

drop policy events_select on public.events;
create policy events_select on public.events for select using (
  agency_id = public.current_agency_id() and (
    guard_id = public.current_guard_id()
    or (public.is_manager() and (site_id in (select public.accessible_site_ids()) or site_id is null))
  )
);

drop policy patrols_select on public.patrols;
create policy patrols_select on public.patrols for select using (
  guard_id = public.current_guard_id() or (public.is_manager() and site_id in (select public.accessible_site_ids()))
);

drop policy patrol_photos_select on public.patrol_photos;
create policy patrol_photos_select on public.patrol_photos for select using (
  agency_id = public.current_agency_id() and exists (
    select 1 from public.patrols p where p.id = patrol_id
      and (p.guard_id = public.current_guard_id() or (public.is_manager() and p.site_id in (select public.accessible_site_ids())))
  )
);

drop policy tasks_select on public.tasks;
create policy tasks_select on public.tasks for select using (
  public.guard_is_assigned_to_task(id) or (public.is_manager() and site_id in (select public.accessible_site_ids()))
);

drop policy task_assignments_select on public.task_assignments;
create policy task_assignments_select on public.task_assignments for select using (
  agency_id = public.current_agency_id() and (
    guard_id = public.current_guard_id()
    or (public.is_manager() and public.task_site_id(task_id) in (select public.accessible_site_ids()))
  )
);

drop policy leave_requests_select on public.leave_requests;
create policy leave_requests_select on public.leave_requests for select using (
  agency_id = public.current_agency_id() and (
    guard_id = public.current_guard_id()
    or (public.is_manager() and (public.sees_all_sites() or site_id in (select public.accessible_site_ids())))
  )
);

-- ---------------------------------------------------------------------------
-- 9. Storage: an uploader may overwrite their own object. The outbox retries an upload
--    after a partial failure with x-upsert, which is an UPDATE on storage.objects, and
--    that was manager-only.
-- ---------------------------------------------------------------------------
create policy "uploaders overwrite their own objects" on storage.objects for update to authenticated
  using (public.storage_agency_prefix(name) = public.current_agency_id() and (owner = auth.uid() or owner_id = auth.uid()::text))
  with check (public.storage_agency_prefix(name) = public.current_agency_id());
