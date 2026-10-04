-- Supervisor mode for the guard app.
--
-- The same Android binary serves guards and the people who run them. A supervisor signs in
-- with email + password (a normal dashboard profile), so every RLS policy already knows who
-- they are; what they lacked was a *contract*: bundled reads that fit one round trip on a
-- budget phone, and writes that are RPCs so the permission check lives in SQL rather than in
-- a screen. That contract is guard-app/src/api/staffTypes.ts and this file implements it.
--
-- Shape rules, same as 0011_guard_app.sql:
--   * every function is `security definer set search_path = public` and granted to authenticated;
--   * reads return jsonb bundles, writes return the id they created;
--   * denial is a plain `raise exception 'FORBIDDEN'` (the app shows the generic screen);
--     everything the app must branch on gets an errcode token (P0021 NOT_STAFF,
--     P0022 GUARD_PHONE_EXISTS, and P0017 BAD_PATH reused from the guard side);
--   * scope is decided by accessible_site_ids() / sees_all_sites(), never by a role name.

-- ---------------------------------------------------------------------------
-- 0. Shared scope helper: may the caller open this guard's record?
--    Managers see guards at their sites; a guard with no site yet (just added, not posted)
--    is visible to any manager so the person who invited them can finish the KYC.
-- ---------------------------------------------------------------------------
create or replace function public.staff_can_access_guard(p_guard_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_manager() and exists (
    select 1 from public.guards g
    where g.id = p_guard_id
      and g.agency_id = public.current_agency_id()
      and (public.sees_all_sites() or g.site_id is null or g.site_id in (select public.accessible_site_ids()))
  )
$$;

-- ---------------------------------------------------------------------------
-- 1. staff_me(): who am I, what may I do, which sites are mine
--    A suspended tenant makes current_agency_id() null, so the profile and agency are read
--    directly: the app needs the agency *status* to show the blocked screen.
-- ---------------------------------------------------------------------------
create or replace function public.staff_me()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  p public.profiles;
  ag public.agencies;
  v_role_name text;
  v_sites jsonb;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found or p.role = 'guard' then raise exception 'NOT_STAFF' using errcode = 'P0021'; end if;
  select * into ag from public.agencies where id = p.agency_id;
  select r.name into v_role_name from public.roles r where r.id = p.role_id;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.name), '[]'::jsonb) into v_sites
  from (
    select s.id, s.name, s.client_name, s.address, s.lat, s.lng, s.guards_required, s.patrol_photo_required
    from public.sites s where s.id in (select public.accessible_site_ids())
  ) x;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id, 'full_name', p.full_name, 'email', p.email, 'phone', p.phone,
      'role', p.role, 'role_name', case when p.role = 'owner' then null else v_role_name end,
      'all_sites', p.all_sites),
    'agency', jsonb_build_object(
      'id', ag.id, 'name', ag.name, 'status', ag.status, 'timezone', ag.timezone,
      'late_threshold_min', ag.late_threshold_min),
    'permissions', to_jsonb(coalesce(public.current_permissions(), '{}'::text[])),
    'sites', v_sites,
    'server_time', now()
  );
end $$;

-- ---------------------------------------------------------------------------
-- 2. supervisor_home(): the whole first screen in one call
-- ---------------------------------------------------------------------------
create or replace function public.supervisor_home(p_date date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_agency uuid := public.current_agency_id();
  ag public.agencies;
  v_date date;
  v_sites jsonb;
  v_on_duty jsonb;
  v_alerts jsonb;
  v_pending_leave int;
  v_missed int;
begin
  if not public.is_manager() or v_agency is null then raise exception 'FORBIDDEN'; end if;
  select * into ag from public.agencies where id = v_agency;
  v_date := coalesce(p_date, (now() at time zone ag.timezone)::date);

  -- site_day_summary already restricts itself to accessible_site_ids(); `late` is the one
  -- counter it does not carry, so it is joined on rather than recomputed.
  select coalesce(jsonb_agg(to_jsonb(x) order by x.name), '[]'::jsonb) into v_sites
  from (
    select d.site_id as id, d.site_name as name, d.guards_required, d.scheduled, d.present, d.half_day,
           d.absent, d.on_leave, d.on_duty_now,
           coalesce((select count(*)::int from public.shifts sh
                     where sh.site_id = d.site_id and sh.shift_date = v_date
                       and sh.late_by_min > ag.late_threshold_min), 0) as late,
           d.flagged, d.pending
    from public.site_day_summary(v_agency, v_date) d
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.started_at desc nulls last), '[]'::jsonb) into v_on_duty
  from (
    select sh.guard_id, g.full_name as guard_name, g.phone as guard_phone, sh.site_id, sh.id as shift_id,
           gp.lat, gp.lng, gp.in_fence, gp.battery_pct,
           coalesce(gp.location_enabled, sh.location_enabled) as location_enabled,
           gp.last_seen_at, sh.started_at, sh.flags
    from public.shifts sh
    join public.guards g on g.id = sh.guard_id
    left join public.guard_presence gp on gp.guard_id = sh.guard_id
    where sh.agency_id = v_agency and sh.status = 'in_progress'
      and sh.site_id in (select public.accessible_site_ids())
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) into v_alerts
  from (
    select e.id, e.type, e.severity, e.title, e.site_id, s.name as site_name, e.guard_id,
           g.full_name as guard_name, g.phone as guard_phone, e.shift_id, sh.shift_date, e.payload, e.created_at
    from public.events e
    left join public.sites s on s.id = e.site_id
    left join public.guards g on g.id = e.guard_id
    left join public.shifts sh on sh.id = e.shift_id
    where e.agency_id = v_agency and e.severity <> 'info' and e.acknowledged_at is null
      and e.created_at > now() - interval '48 hours'
      and (e.site_id is null or e.site_id in (select public.accessible_site_ids()))
    order by e.created_at desc
    limit 50
  ) x;

  select count(*)::int into v_pending_leave from public.leave_requests lr
  where lr.agency_id = v_agency and lr.status = 'pending'
    and (lr.site_id in (select public.accessible_site_ids()) or (lr.site_id is null and public.sees_all_sites()));

  select count(*)::int into v_missed from public.patrols pt
  where pt.agency_id = v_agency and pt.status = 'missed'
    and (pt.expected_at at time zone ag.timezone)::date = v_date
    and pt.site_id in (select public.accessible_site_ids());

  return jsonb_build_object(
    'date', v_date, 'server_time', now(), 'sites', v_sites, 'on_duty', v_on_duty, 'alerts', v_alerts,
    'pending_leave', v_pending_leave, 'missed_patrols_today', v_missed
  );
end $$;

-- ---------------------------------------------------------------------------
-- 3. site_shifts(): the day's attendance for one site
-- ---------------------------------------------------------------------------
create or replace function public.site_shifts(p_site_id uuid, p_date date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_out jsonb;
begin
  if not public.is_manager() or p_site_id not in (select public.accessible_site_ids()) then
    raise exception 'FORBIDDEN';
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.scheduled_start nulls last, x.guard_name), '[]'::jsonb) into v_out
  from (
    select sh.id, sh.guard_id, g.full_name as guard_name, g.phone as guard_phone, g.employee_code,
           st.name as shift_type, sh.scheduled_start, sh.scheduled_end, sh.started_at, sh.start_captured_at,
           sh.ended_at, sh.status, sh.attendance, sh.trust, sh.flags, sh.late_by_min, sh.worked_minutes,
           sh.away_seconds, sh.location_enabled, sh.location_off_seconds, sh.start_in_fence, sh.start_distance_m,
           sh.end_in_fence, sh.start_selfie_path, sh.end_selfie_path,
           ex.reason as exception_reason, sh.override_reason,
           case when sh.status = 'in_progress' then gp.in_fence end as in_fence_now,
           case when sh.status = 'in_progress' then gp.last_seen_at end as last_seen_at,
           case when sh.status = 'in_progress' then gp.battery_pct end as battery_pct
    from public.shifts sh
    join public.guards g on g.id = sh.guard_id
    left join public.shift_types st on st.id = sh.shift_type_id
    left join public.shift_exceptions ex on ex.id = sh.exception_id
    left join public.guard_presence gp on gp.guard_id = sh.guard_id and gp.shift_id = sh.id
    where sh.site_id = p_site_id and sh.shift_date = p_date
  ) x;
  return v_out;
end $$;

-- ---------------------------------------------------------------------------
-- 4. guard_record(): one guard's file — KYC, documents, recent attendance
-- ---------------------------------------------------------------------------
create or replace function public.guard_record(p_guard_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  g public.guards;
  s public.sites;
  sup public.profiles;
  v_docs jsonb;
  v_shifts jsonb;
begin
  if not public.staff_can_access_guard(p_guard_id) then raise exception 'FORBIDDEN'; end if;
  select * into g from public.guards where id = p_guard_id;
  select * into s from public.sites where id = g.site_id;
  select * into sup from public.profiles where id = g.supervisor_id;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.type), '[]'::jsonb) into v_docs
  from (
    select d.id, d.type, d.status, d.file_path, d.number_masked, d.rejection_reason
    from public.guard_documents d where d.guard_id = g.id
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.shift_date desc), '[]'::jsonb) into v_shifts
  from (
    select sh.id, sh.shift_date, si.name as site_name, sh.status, sh.attendance, sh.started_at, sh.ended_at,
           sh.flags, sh.worked_minutes, sh.away_seconds, sh.late_by_min
    from public.shifts sh
    left join public.sites si on si.id = sh.site_id
    where sh.guard_id = g.id
    order by sh.shift_date desc, sh.scheduled_start desc nulls last
    limit 14
  ) x;

  return jsonb_build_object(
    'guard', jsonb_build_object(
      'id', g.id, 'full_name', g.full_name, 'phone', g.phone, 'employee_code', g.employee_code,
      'designation', g.designation, 'site_id', g.site_id, 'site_name', s.name, 'status', g.status,
      'registration_selfie_path', g.registration_selfie_path, 'joined_at', g.joined_at,
      'phone_verified_at', g.phone_verified_at, 'profile_id', g.profile_id),
    'kyc_missing', to_jsonb(public.guard_kyc_missing(g.id)),
    'documents', v_docs,
    'shifts', v_shifts,
    'supervisor', case when sup.id is null then null else jsonb_build_object('name', sup.full_name, 'phone', sup.phone) end
  );
end $$;

-- ---------------------------------------------------------------------------
-- 5. staff_guards(): the roster of people, optionally narrowed to one site
-- ---------------------------------------------------------------------------
create or replace function public.staff_guards(p_site_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_out jsonb;
begin
  if not public.is_manager() or public.current_agency_id() is null then raise exception 'FORBIDDEN'; end if;
  if p_site_id is not null and p_site_id not in (select public.accessible_site_ids()) then raise exception 'FORBIDDEN'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.full_name), '[]'::jsonb) into v_out
  from (
    select g.id, g.full_name, g.phone, g.employee_code, g.designation, g.site_id, s.name as site_name, g.status,
           public.guard_kyc_complete(g.id) as kyc_complete,
           exists (select 1 from public.shifts sh where sh.guard_id = g.id and sh.status = 'in_progress') as on_duty
    from public.guards g
    left join public.sites s on s.id = g.site_id
    where g.agency_id = public.current_agency_id()
      and (p_site_id is null or g.site_id = p_site_id)
      and (public.sees_all_sites() or g.site_id is null or g.site_id in (select public.accessible_site_ids()))
  ) x;
  return v_out;
end $$;

-- ---------------------------------------------------------------------------
-- 6. leave_inbox(): what is waiting on a decision, oldest first
-- ---------------------------------------------------------------------------
create or replace function public.leave_inbox()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_out jsonb;
begin
  if not public.is_manager() or public.current_agency_id() is null then raise exception 'FORBIDDEN'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb) into v_out
  from (
    select lr.id, lr.guard_id, g.full_name as guard_name, lr.site_id, s.name as site_name, lr.type,
           lr.start_date, lr.end_date, lr.reason, lr.status, lr.created_at,
           (lb.casual_total - lb.casual_used) as casual_left,
           (lb.earned_total - lb.earned_used) as earned_left
    from public.leave_requests lr
    join public.guards g on g.id = lr.guard_id
    left join public.sites s on s.id = lr.site_id
    left join public.leave_balances lb on lb.guard_id = lr.guard_id and lb.year = extract(year from lr.start_date)::int
    where lr.agency_id = public.current_agency_id() and lr.status = 'pending'
      and (lr.site_id in (select public.accessible_site_ids()) or (lr.site_id is null and public.sees_all_sites()))
  ) x;
  return v_out;
end $$;

-- ---------------------------------------------------------------------------
-- 7. roster_day(): who is assigned where, with the shift the trigger created
-- ---------------------------------------------------------------------------
create or replace function public.roster_day(p_date date, p_site_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_out jsonb;
begin
  if not public.is_manager() or public.current_agency_id() is null then raise exception 'FORBIDDEN'; end if;
  if p_site_id is not null and p_site_id not in (select public.accessible_site_ids()) then raise exception 'FORBIDDEN'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.scheduled_start, x.guard_name), '[]'::jsonb) into v_out
  from (
    select sa.id, sa.site_id, s.name as site_name, sa.guard_id, g.full_name as guard_name,
           sa.shift_type_id, st.name as shift_type, sa.shift_date, sa.scheduled_start, sa.scheduled_end,
           sh.status as shift_status, sh.attendance
    from public.shift_assignments sa
    join public.guards g on g.id = sa.guard_id
    join public.sites s on s.id = sa.site_id
    left join public.shift_types st on st.id = sa.shift_type_id
    left join public.shifts sh on sh.assignment_id = sa.id
    where sa.shift_date = p_date
      and (p_site_id is null or sa.site_id = p_site_id)
      and sa.site_id in (select public.accessible_site_ids())
  ) x;
  return v_out;
end $$;

-- ---------------------------------------------------------------------------
-- 8. acknowledge_event(): idempotent, first acknowledger wins
-- ---------------------------------------------------------------------------
create or replace function public.acknowledge_event(p_event_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() or public.current_agency_id() is null then raise exception 'FORBIDDEN'; end if;
  update public.events set acknowledged_by = auth.uid(), acknowledged_at = now()
  where id = p_event_id and agency_id = public.current_agency_id() and acknowledged_at is null
    and (site_id is null or site_id in (select public.accessible_site_ids()));
end $$;

-- ---------------------------------------------------------------------------
-- 9. assign_shift(): ad-hoc roster from the phone. The shift row itself is the
--    shift_assignments_create_shift trigger's job; the KYC trigger's exception is deliberately
--    left to propagate so the app can name the missing document.
-- ---------------------------------------------------------------------------
create or replace function public.assign_shift(p_guard_id uuid, p_site_id uuid, p_shift_type_id uuid, p_date date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_agency uuid := public.current_agency_id();
  st public.shift_types;
  v_tz text;
  w record;
  v_id uuid;
begin
  if not public.has_permission('roster:write') or p_site_id not in (select public.accessible_site_ids()) then
    raise exception 'FORBIDDEN';
  end if;
  if not exists (select 1 from public.guards where id = p_guard_id and agency_id = v_agency) then
    raise exception 'GUARD_NOT_FOUND';
  end if;
  select * into st from public.shift_types where id = p_shift_type_id and site_id = p_site_id;
  if not found then raise exception 'SHIFT_TYPE_NOT_FOUND'; end if;

  select id into v_id from public.shift_assignments
  where guard_id = p_guard_id and shift_date = p_date and shift_type_id = p_shift_type_id;
  if v_id is not null then return v_id; end if;   -- an offline retry must not raise

  select timezone into v_tz from public.agencies where id = v_agency;
  select * into w from public.shift_window(p_date, st.start_time, st.end_time, v_tz);
  insert into public.shift_assignments (agency_id, site_id, guard_id, shift_type_id, shift_date, scheduled_start, scheduled_end, created_by)
  values (v_agency, p_site_id, p_guard_id, p_shift_type_id, p_date, w.starts_at, w.ends_at, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 10. create_task(): a job for one or more guards at a site. No event: the guard's
--     completion is the interesting moment, not the ask.
-- ---------------------------------------------------------------------------
create or replace function public.create_task(
  p_site_id uuid,
  p_title text,
  p_description text default null,
  p_due_at timestamptz default null,
  p_photo_required boolean default true,
  p_guard_ids uuid[] default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_agency uuid := public.current_agency_id(); v_id uuid;
begin
  if not public.has_permission('tasks:write') or p_site_id not in (select public.accessible_site_ids()) then
    raise exception 'FORBIDDEN';
  end if;
  if coalesce(length(trim(p_title)), 0) = 0 then raise exception 'TITLE_REQUIRED' using errcode = 'P0023'; end if;

  insert into public.tasks (agency_id, site_id, title, description, due_at, photo_required, created_by)
  values (v_agency, p_site_id, trim(p_title), p_description, p_due_at, coalesce(p_photo_required, true), auth.uid())
  returning id into v_id;

  insert into public.task_assignments (task_id, guard_id, agency_id)
  select v_id, g.id, v_agency
  from public.guards g
  where g.id = any (coalesce(p_guard_ids, '{}'::uuid[])) and g.agency_id = v_agency
  on conflict do nothing;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 11. add_guard(): onboarding from the field. The phone is the identity, so it is
--     normalised to ten digits and must be free inside the tenant.
-- ---------------------------------------------------------------------------
create or replace function public.add_guard(
  p_full_name text,
  p_phone text,
  p_designation text default null,
  p_site_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_agency uuid := public.current_agency_id();
  v_phone text := public.normalize_phone(p_phone);
  v_id uuid;
begin
  if not public.has_permission('guards:write') then raise exception 'FORBIDDEN'; end if;
  if p_site_id is not null and p_site_id not in (select public.accessible_site_ids()) then raise exception 'FORBIDDEN'; end if;
  if coalesce(length(trim(p_full_name)), 0) < 2 then raise exception 'NAME_REQUIRED' using errcode = 'P0023'; end if;
  if v_phone is null or v_phone !~ '^[6-9]\d{9}$' then raise exception 'PHONE_INVALID' using errcode = 'P0011'; end if;
  if exists (select 1 from public.guards where agency_id = v_agency and public.normalize_phone(phone) = v_phone) then
    raise exception 'GUARD_PHONE_EXISTS' using errcode = 'P0022';
  end if;

  insert into public.guards (agency_id, full_name, phone, designation, site_id, supervisor_id, status, invited_at)
  values (v_agency, trim(p_full_name), v_phone, nullif(trim(coalesce(p_designation, '')), ''), p_site_id,
          case when public.is_owner() then null else auth.uid() end, 'invited', now())
  returning id into v_id;

  insert into public.guard_invites (agency_id, guard_id, channel, created_by)
  values (v_agency, v_id, 'whatsapp', auth.uid());

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 12. record_document(): a KYC upload. Mandatory slots are one-per-guard, so a re-upload
--     replaces the slot and resets it to pending rather than piling up rejected rows.
-- ---------------------------------------------------------------------------
create or replace function public.record_document(
  p_guard_id uuid,
  p_type public.document_type,
  p_file_path text,
  p_mime_type text default 'image/jpeg',
  p_number_masked text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_agency uuid := public.current_agency_id(); v_id uuid;
begin
  if not public.has_permission('guards:kyc') or not public.staff_can_access_guard(p_guard_id) then
    raise exception 'FORBIDDEN';
  end if;
  if public.storage_agency_prefix(p_file_path) is distinct from v_agency then
    raise exception 'BAD_PATH' using errcode = 'P0017';
  end if;

  if p_type = 'other' then
    insert into public.guard_documents (agency_id, guard_id, type, file_path, mime_type, number_masked, status, uploaded_by)
    values (v_agency, p_guard_id, p_type, p_file_path, p_mime_type, p_number_masked, 'pending', auth.uid())
    returning id into v_id;
  else
    insert into public.guard_documents as d (agency_id, guard_id, type, file_path, mime_type, number_masked, status, uploaded_by)
    values (v_agency, p_guard_id, p_type, p_file_path, p_mime_type, p_number_masked, 'pending', auth.uid())
    on conflict (guard_id, type) where type <> 'other' do update set
      file_path = excluded.file_path,
      mime_type = excluded.mime_type,
      number_masked = coalesce(excluded.number_masked, d.number_masked),
      status = 'pending', verified_by = null, verified_at = null, rejection_reason = null,
      uploaded_by = excluded.uploaded_by
    returning d.id into v_id;
  end if;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 13. set_guard_registration_selfie(): the supervisor takes it during onboarding,
--     the guard takes their own through set_registration_selfie() in 0011.
-- ---------------------------------------------------------------------------
create or replace function public.set_guard_registration_selfie(p_guard_id uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('guards:write') or not public.staff_can_access_guard(p_guard_id) then
    raise exception 'FORBIDDEN';
  end if;
  if public.storage_agency_prefix(p_path) is distinct from public.current_agency_id() then
    raise exception 'BAD_PATH' using errcode = 'P0017';
  end if;
  update public.guards set registration_selfie_path = p_path where id = p_guard_id;
end $$;

-- ---------------------------------------------------------------------------
-- 14. log_document_access(): opening a KYC document is auditable (NFR security).
-- ---------------------------------------------------------------------------
create or replace function public.log_document_access(p_document_id uuid, p_purpose text default null)
returns void language plpgsql security definer set search_path = public as $$
declare d public.guard_documents;
begin
  select * into d from public.guard_documents where id = p_document_id;
  if not found then raise exception 'DOCUMENT_NOT_FOUND'; end if;
  if not public.staff_can_access_guard(d.guard_id) then raise exception 'FORBIDDEN'; end if;
  insert into public.document_access_logs (agency_id, document_id, accessed_by, purpose)
  values (d.agency_id, d.id, auth.uid(), p_purpose);
end $$;

-- ---------------------------------------------------------------------------
-- 15. Grants
-- ---------------------------------------------------------------------------
grant execute on function public.staff_can_access_guard(uuid) to authenticated;
grant execute on function public.staff_me() to authenticated;
grant execute on function public.supervisor_home(date) to authenticated;
grant execute on function public.site_shifts(uuid, date) to authenticated;
grant execute on function public.guard_record(uuid) to authenticated;
grant execute on function public.staff_guards(uuid) to authenticated;
grant execute on function public.leave_inbox() to authenticated;
grant execute on function public.roster_day(date, uuid) to authenticated;
grant execute on function public.acknowledge_event(uuid) to authenticated;
grant execute on function public.assign_shift(uuid, uuid, uuid, date) to authenticated;
grant execute on function public.create_task(uuid, text, text, timestamptz, boolean, uuid[]) to authenticated;
grant execute on function public.add_guard(text, text, text, uuid) to authenticated;
grant execute on function public.record_document(uuid, public.document_type, text, text, text) to authenticated;
grant execute on function public.set_guard_registration_selfie(uuid, text) to authenticated;
grant execute on function public.log_document_access(uuid, text) to authenticated;
