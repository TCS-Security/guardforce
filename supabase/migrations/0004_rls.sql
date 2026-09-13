-- Row-level security: agency scoping + role scoping (ROLE-1)

alter table public.agencies enable row level security;
alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.supervisor_sites enable row level security;
alter table public.shift_types enable row level security;
alter table public.guards enable row level security;
alter table public.guard_documents enable row level security;
alter table public.document_access_logs enable row level security;
alter table public.profile_shares enable row level security;
alter table public.guard_invites enable row level security;
alter table public.devices enable row level security;
alter table public.app_config enable row level security;
alter table public.audit_logs enable row level security;
alter table public.roster_patterns enable row level security;
alter table public.shift_assignments enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_exceptions enable row level security;
alter table public.location_pings enable row level security;
alter table public.guard_presence enable row level security;
alter table public.events enable row level security;
alter table public.patrol_routes enable row level security;
alter table public.patrols enable row level security;
alter table public.patrol_photos enable row level security;
alter table public.task_templates enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignments enable row level security;
alter table public.leave_requests enable row level security;
alter table public.leave_balances enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;

-- agencies: members read; owners update
create policy agencies_select on public.agencies for select using (id = public.current_agency_id());
create policy agencies_update on public.agencies for update using (id = public.current_agency_id() and public.current_role() in ('owner', 'admin'));

-- profiles
create policy profiles_select on public.profiles for select using (agency_id = public.current_agency_id());
create policy profiles_update_self on public.profiles for update using (id = auth.uid() or (agency_id = public.current_agency_id() and public.current_role() in ('owner', 'admin')));
create policy profiles_insert_admin on public.profiles for insert with check (agency_id = public.current_agency_id() and public.current_role() in ('owner', 'admin'));

-- sites: visible by scope; managed by owner/admin (supervisors may edit their own sites' settings)
create policy sites_select on public.sites for select using (id in (select public.accessible_site_ids()));
create policy sites_insert on public.sites for insert with check (agency_id = public.current_agency_id() and public.current_role() in ('owner', 'admin'));
create policy sites_update on public.sites for update using (agency_id = public.current_agency_id() and public.is_manager() and id in (select public.accessible_site_ids()));
create policy sites_delete on public.sites for delete using (agency_id = public.current_agency_id() and public.current_role() in ('owner', 'admin'));

create policy supervisor_sites_select on public.supervisor_sites for select using (agency_id = public.current_agency_id());
create policy supervisor_sites_manage on public.supervisor_sites for all using (agency_id = public.current_agency_id() and public.current_role() in ('owner', 'admin'))
  with check (agency_id = public.current_agency_id() and public.current_role() in ('owner', 'admin'));

create policy shift_types_select on public.shift_types for select using (site_id in (select public.accessible_site_ids()));
create policy shift_types_manage on public.shift_types for all using (agency_id = public.current_agency_id() and public.is_manager() and site_id in (select public.accessible_site_ids()))
  with check (agency_id = public.current_agency_id() and public.is_manager() and site_id in (select public.accessible_site_ids()));

-- guards: managers see agency guards in their sites (owners all); guards see self
create policy guards_select on public.guards for select using (
  agency_id = public.current_agency_id() and (
    public.current_role() in ('owner', 'admin')
    or profile_id = auth.uid()
    or site_id in (select public.accessible_site_ids())
    or site_id is null and public.is_manager()
  )
);
create policy guards_insert on public.guards for insert with check (agency_id = public.current_agency_id() and public.is_manager());
create policy guards_update on public.guards for update using (agency_id = public.current_agency_id() and (public.is_manager() or profile_id = auth.uid()));
create policy guards_delete on public.guards for delete using (agency_id = public.current_agency_id() and public.current_role() in ('owner', 'admin'));

create policy guard_documents_select on public.guard_documents for select using (
  agency_id = public.current_agency_id() and (public.is_manager() or guard_id = public.current_guard_id())
);
create policy guard_documents_manage on public.guard_documents for all using (agency_id = public.current_agency_id() and (public.is_manager() or guard_id = public.current_guard_id()))
  with check (agency_id = public.current_agency_id() and (public.is_manager() or guard_id = public.current_guard_id()));

create policy document_access_logs_select on public.document_access_logs for select using (agency_id = public.current_agency_id() and public.is_manager());
create policy document_access_logs_insert on public.document_access_logs for insert with check (agency_id = public.current_agency_id());

create policy profile_shares_select on public.profile_shares for select using (agency_id = public.current_agency_id() and public.is_manager());
create policy profile_shares_manage on public.profile_shares for all using (agency_id = public.current_agency_id() and public.is_manager())
  with check (agency_id = public.current_agency_id() and public.is_manager());

create policy guard_invites_manage on public.guard_invites for all using (agency_id = public.current_agency_id() and public.is_manager())
  with check (agency_id = public.current_agency_id() and public.is_manager());

create policy devices_select on public.devices for select using (agency_id = public.current_agency_id() and (public.is_manager() or guard_id = public.current_guard_id()));
create policy devices_manage on public.devices for all using (agency_id = public.current_agency_id() and (public.is_manager() or guard_id = public.current_guard_id()))
  with check (agency_id = public.current_agency_id());

create policy app_config_select on public.app_config for select using (agency_id = public.current_agency_id());
create policy app_config_manage on public.app_config for all using (agency_id = public.current_agency_id() and public.current_role() in ('owner', 'admin'))
  with check (agency_id = public.current_agency_id() and public.current_role() in ('owner', 'admin'));

create policy audit_logs_select on public.audit_logs for select using (agency_id = public.current_agency_id() and public.is_manager());
create policy audit_logs_insert on public.audit_logs for insert with check (agency_id = public.current_agency_id());

-- roster
create policy roster_patterns_select on public.roster_patterns for select using (site_id in (select public.accessible_site_ids()) or guard_id = public.current_guard_id());
create policy roster_patterns_manage on public.roster_patterns for all using (agency_id = public.current_agency_id() and public.is_manager() and site_id in (select public.accessible_site_ids()))
  with check (agency_id = public.current_agency_id() and public.is_manager() and site_id in (select public.accessible_site_ids()));
create policy shift_assignments_select on public.shift_assignments for select using (site_id in (select public.accessible_site_ids()) or guard_id = public.current_guard_id());
create policy shift_assignments_manage on public.shift_assignments for all using (agency_id = public.current_agency_id() and public.is_manager() and site_id in (select public.accessible_site_ids()))
  with check (agency_id = public.current_agency_id() and public.is_manager() and site_id in (select public.accessible_site_ids()));

-- shifts: managers by site scope; guards own
create policy shifts_select on public.shifts for select using (site_id in (select public.accessible_site_ids()) or guard_id = public.current_guard_id());
create policy shifts_manage on public.shifts for all using (agency_id = public.current_agency_id() and public.is_manager() and site_id in (select public.accessible_site_ids()))
  with check (agency_id = public.current_agency_id() and public.is_manager() and site_id in (select public.accessible_site_ids()));

create policy shift_exceptions_select on public.shift_exceptions for select using (agency_id = public.current_agency_id());

create policy location_pings_select on public.location_pings for select using (
  agency_id = public.current_agency_id() and (guard_id = public.current_guard_id() or exists (select 1 from public.shifts s where s.id = shift_id and s.site_id in (select public.accessible_site_ids())))
);
create policy guard_presence_select on public.guard_presence for select using (
  agency_id = public.current_agency_id() and (guard_id = public.current_guard_id() or site_id in (select public.accessible_site_ids()) or public.current_role() in ('owner', 'admin'))
);

create policy events_select on public.events for select using (
  agency_id = public.current_agency_id() and (guard_id = public.current_guard_id() or site_id in (select public.accessible_site_ids()) or (site_id is null and public.is_manager()))
);
create policy events_update on public.events for update using (agency_id = public.current_agency_id() and public.is_manager());
create policy events_insert on public.events for insert with check (agency_id = public.current_agency_id() and public.is_manager());

-- patrols
create policy patrol_routes_select on public.patrol_routes for select using (site_id in (select public.accessible_site_ids()));
create policy patrol_routes_manage on public.patrol_routes for all using (agency_id = public.current_agency_id() and public.is_manager() and site_id in (select public.accessible_site_ids()))
  with check (agency_id = public.current_agency_id() and public.is_manager() and site_id in (select public.accessible_site_ids()));
create policy patrols_select on public.patrols for select using (site_id in (select public.accessible_site_ids()) or guard_id = public.current_guard_id());
create policy patrols_manage on public.patrols for all using (agency_id = public.current_agency_id() and public.is_manager() and site_id in (select public.accessible_site_ids()))
  with check (agency_id = public.current_agency_id() and public.is_manager() and site_id in (select public.accessible_site_ids()));
create policy patrol_photos_select on public.patrol_photos for select using (
  agency_id = public.current_agency_id() and exists (select 1 from public.patrols p where p.id = patrol_id and (p.site_id in (select public.accessible_site_ids()) or p.guard_id = public.current_guard_id()))
);

-- tasks
create policy task_templates_select on public.task_templates for select using (agency_id is null or agency_id = public.current_agency_id());
create policy task_templates_manage on public.task_templates for all using (agency_id = public.current_agency_id() and public.is_manager())
  with check (agency_id = public.current_agency_id() and public.is_manager());
create policy tasks_select on public.tasks for select using (
  site_id in (select public.accessible_site_ids()) or exists (select 1 from public.task_assignments ta where ta.task_id = id and ta.guard_id = public.current_guard_id())
);
create policy tasks_manage on public.tasks for all using (agency_id = public.current_agency_id() and public.is_manager() and site_id in (select public.accessible_site_ids()))
  with check (agency_id = public.current_agency_id() and public.is_manager() and site_id in (select public.accessible_site_ids()));
create policy task_assignments_select on public.task_assignments for select using (
  agency_id = public.current_agency_id() and (guard_id = public.current_guard_id() or exists (select 1 from public.tasks t where t.id = task_id and t.site_id in (select public.accessible_site_ids())))
);
create policy task_assignments_manage on public.task_assignments for all using (agency_id = public.current_agency_id() and public.is_manager())
  with check (agency_id = public.current_agency_id() and public.is_manager());
create policy task_assignments_guard_update on public.task_assignments for update using (guard_id = public.current_guard_id());

-- leave
create policy leave_requests_select on public.leave_requests for select using (
  agency_id = public.current_agency_id() and (guard_id = public.current_guard_id() or public.current_role() in ('owner', 'admin') or site_id in (select public.accessible_site_ids()))
);
create policy leave_requests_insert on public.leave_requests for insert with check (agency_id = public.current_agency_id() and (guard_id = public.current_guard_id() or public.is_manager()));
create policy leave_requests_update on public.leave_requests for update using (agency_id = public.current_agency_id() and (public.is_manager() or (guard_id = public.current_guard_id() and status = 'pending')));
create policy leave_balances_select on public.leave_balances for select using (agency_id = public.current_agency_id() and (public.is_manager() or guard_id = public.current_guard_id()));
create policy leave_balances_manage on public.leave_balances for all using (agency_id = public.current_agency_id() and public.is_manager())
  with check (agency_id = public.current_agency_id() and public.is_manager());

-- notifications
create policy notifications_select on public.notifications for select using (recipient_profile_id = auth.uid() or recipient_guard_id = public.current_guard_id());
create policy notifications_update on public.notifications for update using (recipient_profile_id = auth.uid() or recipient_guard_id = public.current_guard_id());
create policy notification_preferences_manage on public.notification_preferences for all using (profile_id = auth.uid()) with check (profile_id = auth.uid() and agency_id = public.current_agency_id());

-- RPC grants
grant execute on function public.check_in(uuid, uuid, double precision, double precision, real, text, timestamptz, jsonb, uuid) to authenticated;
grant execute on function public.check_out(uuid, double precision, double precision, real, text, timestamptz, jsonb) to authenticated;
grant execute on function public.ingest_pings(uuid, jsonb) to authenticated;
grant execute on function public.report_location_state(uuid, boolean, timestamptz) to authenticated;
grant execute on function public.log_shift_exception(uuid, text, text) to authenticated;
grant execute on function public.override_attendance(uuid, public.attendance_status, text) to authenticated;
grant execute on function public.start_patrol(uuid, timestamptz) to authenticated;
grant execute on function public.complete_patrol(uuid, jsonb, jsonb, timestamptz, text) to authenticated;
grant execute on function public.run_monitors(uuid) to authenticated;
grant execute on function public.decide_leave(uuid, boolean, text) to authenticated;
grant execute on function public.materialize_roster(uuid, date, date) to authenticated;
grant execute on function public.site_day_summary(uuid, date) to authenticated;
grant execute on function public.attendance_trend(uuid, date, date, uuid) to authenticated;
grant execute on function public.guard_scorecard(uuid, date, date) to authenticated;
grant execute on function public.guard_kyc_missing(uuid) to authenticated;
grant execute on function public.guard_kyc_complete(uuid) to authenticated;
grant execute on function public.is_in_fence(uuid, double precision, double precision) to authenticated;
grant execute on function public.site_distance_m(uuid, double precision, double precision) to authenticated;
