-- ---------------------------------------------------------------------------
-- 0012 — stop the missed-patrol monitor announcing the same patrol twice
--
-- `run_monitors` runs on every overview page load. Its LATE_START and OUTAGE branches guard
-- themselves with `not exists`, but the missed-patrol branch relied on the patrol's status
-- flipping to 'missed'. Under READ COMMITTED that is not enough: two concurrent page loads both
-- take their cursor snapshot while the patrol is still 'scheduled', and the inner
-- `update patrols set status = 'missed' where id = r.id` re-checks only the id after the row
-- lock is released — so it writes 'missed' a second time and emits a second PATROL_MISSED.
-- Two operators on the dashboard (or one refresh racing a realtime re-render) is enough.
--
-- Fixes, in order of strength:
--   1. the UPDATE now carries `and status = 'scheduled'`, so the row lock serialises the pair and
--      the loser skips the emit instead of duplicating it;
--   2. the cursor also skips patrols that already have a PATROL_MISSED event, covering a patrol
--      that was reset to 'scheduled' after being announced;
--   3. a partial unique index makes a duplicate impossible at the storage layer. With (1) and (2)
--      in place no normal path can reach it.
--
-- It also writes route_id / route_name into the payload so the dashboard can group missed rounds
-- by guard + route without parsing the event title.
-- ---------------------------------------------------------------------------

-- Lookup index for the `not exists` guard, and the uniqueness guarantee. Events written before
-- this migration (and the e2e probes) have no patrol_id, so the predicate leaves them alone.
create index if not exists events_patrol_missed_patrol_idx
  on public.events ((payload ->> 'patrol_id'))
  where type = 'PATROL_MISSED';

create unique index if not exists events_patrol_missed_once_idx
  on public.events (agency_id, (payload ->> 'patrol_id'))
  where type = 'PATROL_MISSED' and (payload ->> 'patrol_id') is not null;

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
      and not exists (
        select 1 from public.events e
        where e.type = 'PATROL_MISSED' and e.payload ->> 'patrol_id' = p.id::text
      )
  loop
    -- Re-check the status under the row lock: a concurrent sweep may have claimed this patrol
    -- between our snapshot and here, and `found` is false when it did.
    update public.patrols set status = 'missed' where id = r.id and status = 'scheduled';
    if not found then continue; end if;
    perform public.emit_event(p_agency_id, r.site_id, r.guard_id, r.shift_id, 'PATROL_MISSED', 'warn', r.full_name || ' missed patrol ' || coalesce(r.route_name, ''),
      jsonb_build_object('patrol_id', r.id, 'route_id', r.route_id, 'route_name', r.route_name, 'expected_at', r.expected_at,
                         'body', 'Expected ' || to_char(r.expected_at at time zone ag.timezone, 'HH24:MI')));
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
    update public.shifts set status = 'absent' where id = r.id and status = 'scheduled';
    if not found then continue; end if;
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

grant execute on function public.run_monitors(uuid) to authenticated;
