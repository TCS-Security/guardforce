-- Multi-tenancy, properly:
--   1. Platform side — we are the SaaS provider. Tenants (agencies) have a lifecycle and are
--      managed by platform admins who are not members of any tenant.
--   2. Tenant side — role-based access. Every agency has an immutable Owner role plus
--      editable roles made of permissions from a fixed catalogue; users are assigned a role
--      (what they may do) and a site scope (which sites they may see).
--
-- The old fixed enum (owner/admin/supervisor) becomes a *kind*: owner | staff | guard.
-- Owners always hold every permission. Everyone else is what their role says.

-- ---------------------------------------------------------------------------
-- 1. Tenant lifecycle
-- ---------------------------------------------------------------------------
create type public.agency_status as enum ('trial', 'active', 'suspended', 'churned');

alter table public.agencies
  add column status public.agency_status not null default 'active',
  add column plan text not null default 'pilot',
  add column suspended_at timestamptz,
  add column suspended_reason text,
  add column notes text,
  add column max_guards int;

-- ---------------------------------------------------------------------------
-- 2. Platform admins (our staff). Never members of a tenant; rows are only written by the
--    service role. A user can read their own row so the app can route them to /platform.
-- ---------------------------------------------------------------------------
create type public.platform_role as enum ('platform_owner', 'platform_support');

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role public.platform_role not null default 'platform_support',
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
create policy platform_admins_self on public.platform_admins for select using (user_id = auth.uid());

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

-- Platform actions are audited against the tenant they touched; the actor is a platform admin,
-- not a profile, so the existing actor_id column cannot hold them.
alter table public.audit_logs add column platform_actor_id uuid references public.platform_admins(user_id);

-- ---------------------------------------------------------------------------
-- 3. Permission catalogue + roles
-- ---------------------------------------------------------------------------
create table public.permission_catalogue (
  key text primary key,
  resource text not null,
  action text not null,
  label text not null,
  description text not null,
  sort int not null
);

insert into public.permission_catalogue (key, resource, action, label, description, sort) values
  ('sites:read',          'sites',      'read',        'View sites',            'Site list, fences, shift types, staffing', 10),
  ('sites:write',         'sites',      'write',       'Manage sites',          'Create and edit sites, fences and shift types', 11),
  ('guards:read',         'guards',     'read',        'View guards',           'Guard roster, profiles and KYC status', 20),
  ('guards:write',        'guards',     'write',       'Manage guards',         'Add, edit, invite and deactivate guards', 21),
  ('guards:kyc',          'guards',     'kyc',         'Open KYC documents',    'View, upload, verify and reject identity documents', 22),
  ('guards:share',        'guards',     'share',       'Share profiles',        'Create and revoke shareable guard profile links', 23),
  ('roster:read',         'roster',     'read',        'View roster',           'Weekly roster and patterns', 30),
  ('roster:write',        'roster',     'write',       'Manage roster',         'Assign and remove guards, create weekly patterns', 31),
  ('attendance:read',     'attendance', 'read',        'View attendance',       'Day view, shift replay, trails and selfies', 40),
  ('attendance:correct',  'attendance', 'correct',     'Correct attendance',    'Override attendance and log location exceptions (audited)', 41),
  ('live:read',           'live',       'read',        'Live map',              'See guards on duty in real time', 50),
  ('events:read',         'events',     'read',        'View events',           'The event feed', 60),
  ('events:acknowledge',  'events',     'acknowledge', 'Acknowledge alerts',    'Mark alerts as seen', 61),
  ('patrols:read',        'patrols',    'read',        'View patrols',          'Compliance board and round detail', 70),
  ('patrols:write',       'patrols',    'write',       'Manage patrols',        'Define routes and annotate rounds', 71),
  ('tasks:read',          'tasks',      'read',        'View tasks',            'Task list, detail and day report', 80),
  ('tasks:write',         'tasks',      'write',       'Manage tasks',          'Create, assign, close and delete tasks', 81),
  ('leave:read',          'leave',      'read',        'View leave',            'Inbox, calendar and balances', 90),
  ('leave:decide',        'leave',      'decide',      'Decide leave',          'Approve, decline and log leave; edit balances', 91),
  ('reports:read',        'reports',    'read',        'View reports',          'Analytics and scorecards', 100),
  ('reports:export',      'reports',    'export',      'Export CSV',            'Download muster rolls and other exports', 101),
  ('settings:read',       'settings',   'read',        'View settings',         'Agency defaults, app config, notification outbox', 110),
  ('settings:write',      'settings',   'write',       'Change settings',       'Edit agency defaults and the guard-app config', 111),
  ('team:read',           'team',       'read',        'View team',             'Who has dashboard access', 120),
  ('team:manage',         'team',       'manage',      'Manage team & roles',   'Invite users, assign roles and site scope, edit roles', 121),
  ('audit:read',          'audit',      'read',        'View audit log',        'Every override, exception and settings change', 130);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  description text,
  -- System roles are seeded per tenant. Owner is immutable; the others can be edited but not deleted.
  is_system boolean not null default false,
  system_key text check (system_key in ('owner', 'manager', 'supervisor', 'viewer')),
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, name),
  unique (agency_id, system_key)
);
create index roles_agency_idx on public.roles(agency_id);
create trigger roles_touch before update on public.roles for each row execute function public.touch_updated_at();

-- Permissions must come from the catalogue.
create or replace function public.roles_validate_permissions()
returns trigger language plpgsql as $$
declare bad text[];
begin
  select array_agg(p) into bad
  from unnest(new.permissions) p
  where not exists (select 1 from public.permission_catalogue c where c.key = p);
  if bad is not null then
    raise exception 'UNKNOWN_PERMISSION: %', array_to_string(bad, ', ') using errcode = 'P0010';
  end if;
  new.permissions := (select coalesce(array_agg(distinct p order by p), '{}') from unnest(new.permissions) p);
  return new;
end $$;
create trigger roles_validate before insert or update on public.roles
  for each row execute function public.roles_validate_permissions();

-- The Owner role cannot be changed or removed.
create or replace function public.roles_protect_owner()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system and old.system_key = 'owner' then
      raise exception 'OWNER_ROLE_IMMUTABLE' using errcode = 'P0011';
    end if;
    return old;
  end if;
  if old.system_key = 'owner' and (new.permissions <> old.permissions or new.system_key is distinct from 'owner') then
    raise exception 'OWNER_ROLE_IMMUTABLE' using errcode = 'P0011';
  end if;
  if old.is_system and new.system_key is distinct from old.system_key then
    raise exception 'SYSTEM_ROLE_KEY_FIXED' using errcode = 'P0011';
  end if;
  return new;
end $$;
create trigger roles_protect before update or delete on public.roles
  for each row execute function public.roles_protect_owner();

-- Seeds the four system roles for a tenant. Idempotent.
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
    (p_agency_id, 'Supervisor', 'Runs the day at their sites: roster, attendance, patrols, tasks and leave. No KYC documents or exports.', true, 'supervisor',
      array['sites:read','guards:read','guards:write','roster:read','roster:write','attendance:read','attendance:correct','live:read',
            'events:read','events:acknowledge','patrols:read','patrols:write','tasks:read','tasks:write','leave:read','leave:decide','reports:read']),
    (p_agency_id, 'Viewer', 'Read-only access to everything; for client-facing or finance staff.', true, 'viewer', reads)
  on conflict (agency_id, system_key) do nothing;
end $$;

-- Every new tenant gets its roles and app config the moment it is created.
create or replace function public.agencies_bootstrap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_system_roles(new.id);
  insert into public.app_config (agency_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger agencies_bootstrap after insert on public.agencies
  for each row execute function public.agencies_bootstrap();

-- ---------------------------------------------------------------------------
-- 4. Profiles: kind + role + site scope
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column role_id uuid references public.roles(id) on delete set null,
  -- Site scope. True = every site in the agency; false = only the sites in supervisor_sites.
  add column all_sites boolean not null default false;
create index profiles_role_idx on public.profiles(role_id);

-- ---------------------------------------------------------------------------
-- 5. Access helpers
-- ---------------------------------------------------------------------------

-- A suspended tenant's members see nothing: this is the single choke point every policy uses.
create or replace function public.current_agency_id()
returns uuid language sql stable security definer set search_path = public as $$
  select p.agency_id
  from public.profiles p
  join public.agencies a on a.id = p.agency_id
  where p.id = auth.uid() and p.is_active and a.status in ('trial', 'active')
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() = 'owner'
$$;

-- Any dashboard user (not a guard). Kept for the read side of policies.
create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() in ('owner', 'staff', 'admin', 'supervisor')
$$;

create or replace function public.current_permissions()
returns text[] language sql stable security definer set search_path = public as $$
  select case
    when p.role = 'owner' then (select array_agg(key) from public.permission_catalogue)
    when p.role = 'guard' then '{}'::text[]
    else coalesce(r.permissions, '{}'::text[])
  end
  from public.profiles p
  left join public.roles r on r.id = p.role_id
  where p.id = auth.uid()
$$;

create or replace function public.has_permission(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_agency_id() is not null and p_key = any (coalesce(public.current_permissions(), '{}'::text[]))
$$;

-- Site scope now comes from profiles.all_sites rather than the role kind.
create or replace function public.accessible_site_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select s.id from public.sites s
  where s.agency_id = public.current_agency_id()
    and (
      exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role = 'owner' or p.all_sites))
      or exists (select 1 from public.supervisor_sites ss where ss.site_id = s.id and ss.profile_id = auth.uid())
      or exists (select 1 from public.guards g where g.profile_id = auth.uid() and g.site_id = s.id)
    )
$$;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.current_permissions() to authenticated;
grant execute on function public.has_permission(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Rewrite the write side of every tenant policy around permissions.
--    Reads stay as they were: tenant membership + site scope.
-- ---------------------------------------------------------------------------

-- agencies
drop policy agencies_update on public.agencies;
create policy agencies_update on public.agencies for update
  using (id = public.current_agency_id() and public.has_permission('settings:write'));

-- profiles
drop policy profiles_update_self on public.profiles;
drop policy profiles_insert_admin on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or (agency_id = public.current_agency_id() and public.has_permission('team:manage')));
create policy profiles_insert on public.profiles for insert
  with check (agency_id = public.current_agency_id() and public.has_permission('team:manage'));

-- roles
alter table public.roles enable row level security;
create policy roles_select on public.roles for select using (agency_id = public.current_agency_id());
create policy roles_manage on public.roles for all
  using (agency_id = public.current_agency_id() and public.has_permission('team:manage'))
  with check (agency_id = public.current_agency_id() and public.has_permission('team:manage'));
alter table public.permission_catalogue enable row level security;
create policy permission_catalogue_read on public.permission_catalogue for select to authenticated using (true);

-- sites
drop policy sites_insert on public.sites;
drop policy sites_update on public.sites;
drop policy sites_delete on public.sites;
create policy sites_insert on public.sites for insert
  with check (agency_id = public.current_agency_id() and public.has_permission('sites:write'));
create policy sites_update on public.sites for update
  using (agency_id = public.current_agency_id() and public.has_permission('sites:write') and id in (select public.accessible_site_ids()));
create policy sites_delete on public.sites for delete
  using (agency_id = public.current_agency_id() and public.has_permission('sites:write'));

drop policy supervisor_sites_manage on public.supervisor_sites;
create policy supervisor_sites_manage on public.supervisor_sites for all
  using (agency_id = public.current_agency_id() and public.has_permission('team:manage'))
  with check (agency_id = public.current_agency_id() and public.has_permission('team:manage'));

drop policy shift_types_manage on public.shift_types;
create policy shift_types_manage on public.shift_types for all
  using (agency_id = public.current_agency_id() and public.has_permission('sites:write') and site_id in (select public.accessible_site_ids()))
  with check (agency_id = public.current_agency_id() and public.has_permission('sites:write') and site_id in (select public.accessible_site_ids()));

-- guards
drop policy guards_select on public.guards;
create policy guards_select on public.guards for select using (
  agency_id = public.current_agency_id() and (
    profile_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role = 'owner' or p.all_sites))
    or site_id in (select public.accessible_site_ids())
    or (site_id is null and public.is_manager())
  )
);
drop policy guards_insert on public.guards;
drop policy guards_update on public.guards;
drop policy guards_delete on public.guards;
create policy guards_insert on public.guards for insert
  with check (agency_id = public.current_agency_id() and public.has_permission('guards:write'));
create policy guards_update on public.guards for update
  using (agency_id = public.current_agency_id() and (public.has_permission('guards:write') or profile_id = auth.uid()));
create policy guards_delete on public.guards for delete
  using (agency_id = public.current_agency_id() and public.has_permission('guards:write'));

drop policy guard_documents_manage on public.guard_documents;
create policy guard_documents_manage on public.guard_documents for all
  using (agency_id = public.current_agency_id() and (public.has_permission('guards:kyc') or guard_id = public.current_guard_id()))
  with check (agency_id = public.current_agency_id() and (public.has_permission('guards:kyc') or guard_id = public.current_guard_id()));

drop policy document_access_logs_select on public.document_access_logs;
create policy document_access_logs_select on public.document_access_logs for select
  using (agency_id = public.current_agency_id() and (public.has_permission('guards:kyc') or public.has_permission('audit:read')));

drop policy profile_shares_manage on public.profile_shares;
create policy profile_shares_manage on public.profile_shares for all
  using (agency_id = public.current_agency_id() and public.has_permission('guards:share'))
  with check (agency_id = public.current_agency_id() and public.has_permission('guards:share'));

drop policy guard_invites_manage on public.guard_invites;
create policy guard_invites_manage on public.guard_invites for all
  using (agency_id = public.current_agency_id() and public.has_permission('guards:write'))
  with check (agency_id = public.current_agency_id() and public.has_permission('guards:write'));

drop policy devices_manage on public.devices;
create policy devices_manage on public.devices for all
  using (agency_id = public.current_agency_id() and (public.has_permission('settings:write') or guard_id = public.current_guard_id()))
  with check (agency_id = public.current_agency_id());

drop policy app_config_manage on public.app_config;
create policy app_config_manage on public.app_config for all
  using (agency_id = public.current_agency_id() and public.has_permission('settings:write'))
  with check (agency_id = public.current_agency_id() and public.has_permission('settings:write'));

drop policy audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select
  using (agency_id = public.current_agency_id() and public.has_permission('audit:read'));

-- roster
drop policy roster_patterns_manage on public.roster_patterns;
create policy roster_patterns_manage on public.roster_patterns for all
  using (agency_id = public.current_agency_id() and public.has_permission('roster:write') and site_id in (select public.accessible_site_ids()))
  with check (agency_id = public.current_agency_id() and public.has_permission('roster:write') and site_id in (select public.accessible_site_ids()));
drop policy shift_assignments_manage on public.shift_assignments;
create policy shift_assignments_manage on public.shift_assignments for all
  using (agency_id = public.current_agency_id() and public.has_permission('roster:write') and site_id in (select public.accessible_site_ids()))
  with check (agency_id = public.current_agency_id() and public.has_permission('roster:write') and site_id in (select public.accessible_site_ids()));

-- shifts: rostering removes scheduled rows; corrections go through audited RPCs
drop policy shifts_manage on public.shifts;
create policy shifts_manage on public.shifts for all
  using (agency_id = public.current_agency_id()
         and (public.has_permission('roster:write') or public.has_permission('attendance:correct'))
         and site_id in (select public.accessible_site_ids()))
  with check (agency_id = public.current_agency_id()
         and (public.has_permission('roster:write') or public.has_permission('attendance:correct'))
         and site_id in (select public.accessible_site_ids()));

-- events
drop policy events_update on public.events;
create policy events_update on public.events for update
  using (agency_id = public.current_agency_id() and public.has_permission('events:acknowledge'));

-- patrols
drop policy patrol_routes_manage on public.patrol_routes;
create policy patrol_routes_manage on public.patrol_routes for all
  using (agency_id = public.current_agency_id() and public.has_permission('patrols:write') and site_id in (select public.accessible_site_ids()))
  with check (agency_id = public.current_agency_id() and public.has_permission('patrols:write') and site_id in (select public.accessible_site_ids()));
drop policy patrols_manage on public.patrols;
create policy patrols_manage on public.patrols for all
  using (agency_id = public.current_agency_id() and public.has_permission('patrols:write') and site_id in (select public.accessible_site_ids()))
  with check (agency_id = public.current_agency_id() and public.has_permission('patrols:write') and site_id in (select public.accessible_site_ids()));

-- tasks
drop policy task_templates_manage on public.task_templates;
create policy task_templates_manage on public.task_templates for all
  using (agency_id = public.current_agency_id() and public.has_permission('tasks:write'))
  with check (agency_id = public.current_agency_id() and public.has_permission('tasks:write'));
drop policy tasks_manage on public.tasks;
create policy tasks_manage on public.tasks for all
  using (agency_id = public.current_agency_id() and public.has_permission('tasks:write') and site_id in (select public.accessible_site_ids()))
  with check (agency_id = public.current_agency_id() and public.has_permission('tasks:write') and site_id in (select public.accessible_site_ids()));
drop policy task_assignments_manage on public.task_assignments;
create policy task_assignments_manage on public.task_assignments for all
  using (agency_id = public.current_agency_id() and public.has_permission('tasks:write'))
  with check (agency_id = public.current_agency_id() and public.has_permission('tasks:write'));

-- leave
drop policy leave_requests_insert on public.leave_requests;
drop policy leave_requests_update on public.leave_requests;
create policy leave_requests_insert on public.leave_requests for insert
  with check (agency_id = public.current_agency_id() and (guard_id = public.current_guard_id() or public.has_permission('leave:decide')));
create policy leave_requests_update on public.leave_requests for update
  using (agency_id = public.current_agency_id() and (public.has_permission('leave:decide') or (guard_id = public.current_guard_id() and status = 'pending')));
drop policy leave_balances_manage on public.leave_balances;
create policy leave_balances_manage on public.leave_balances for all
  using (agency_id = public.current_agency_id() and public.has_permission('leave:decide'))
  with check (agency_id = public.current_agency_id() and public.has_permission('leave:decide'));

-- notification outbox (agency-wide view)
drop policy if exists notifications_select_owner on public.notifications;
drop policy if exists notifications_update_owner on public.notifications;
create policy notifications_select_agency on public.notifications for select
  using (agency_id = public.current_agency_id() and public.has_permission('settings:read'));
create policy notifications_update_agency on public.notifications for update
  using (agency_id = public.current_agency_id() and public.has_permission('settings:write'));

-- ---------------------------------------------------------------------------
-- 7. RPCs that used to check "is a manager" now check the specific permission
-- ---------------------------------------------------------------------------
create or replace function public.log_shift_exception(p_shift_id uuid, p_reason text, p_category text default 'device_failure')
returns public.shifts language plpgsql security definer set search_path = public as $$
declare sh public.shifts; ex_id uuid; g record;
begin
  select * into sh from public.shifts where id = p_shift_id;
  if not found then raise exception 'SHIFT_NOT_FOUND'; end if;
  if not public.has_permission('attendance:correct') or not public.can_access_site(sh.site_id) then raise exception 'FORBIDDEN'; end if;
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

create or replace function public.override_attendance(p_shift_id uuid, p_attendance public.attendance_status, p_reason text)
returns public.shifts language plpgsql security definer set search_path = public as $$
declare sh public.shifts; before_j jsonb; g record;
begin
  select * into sh from public.shifts where id = p_shift_id;
  if not found then raise exception 'SHIFT_NOT_FOUND'; end if;
  if not public.has_permission('attendance:correct') or not public.can_access_site(sh.site_id) then raise exception 'FORBIDDEN'; end if;
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

create or replace function public.decide_leave(p_leave_id uuid, p_approve boolean, p_note text default null)
returns public.leave_requests language plpgsql security definer set search_path = public as $$
declare lr public.leave_requests; g record; days int;
begin
  select * into lr from public.leave_requests where id = p_leave_id;
  if not found then raise exception 'LEAVE_NOT_FOUND'; end if;
  if not public.has_permission('leave:decide') then raise exception 'FORBIDDEN'; end if;
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

-- Alert fan-out follows site scope, not the old role names.
create or replace function public.emit_event(
  p_agency_id uuid, p_site_id uuid, p_guard_id uuid, p_shift_id uuid,
  p_type public.event_type, p_severity public.event_severity, p_title text, p_payload jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare eid uuid;
begin
  insert into public.events (agency_id, site_id, guard_id, shift_id, type, severity, title, payload)
  values (p_agency_id, p_site_id, p_guard_id, p_shift_id, p_type, p_severity, p_title, coalesce(p_payload, '{}'::jsonb))
  returning id into eid;
  if p_severity <> 'info' then
    insert into public.notifications (agency_id, recipient_profile_id, channel, title, body, payload, event_id)
    select p_agency_id, p.id, 'in_app', p_title, coalesce(p_payload->>'body', ''), p_payload, eid
    from public.profiles p
    where p.agency_id = p_agency_id and p.is_active and p.role <> 'guard'
      and (p.role = 'owner' or p.all_sites
           or exists (select 1 from public.supervisor_sites ss where ss.profile_id = p.id and ss.site_id = p_site_id));
  end if;
  return eid;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Backfill existing tenants: seed roles, map the old kinds onto them
-- ---------------------------------------------------------------------------
do $$
declare a record;
begin
  for a in select id from public.agencies loop
    perform public.seed_system_roles(a.id);
    insert into public.app_config (agency_id) values (a.id) on conflict do nothing;
  end loop;
end $$;

update public.profiles p set
  role_id = r.id,
  all_sites = p.role in ('owner', 'admin')
from public.roles r
where r.agency_id = p.agency_id
  and r.system_key = case p.role when 'owner' then 'owner' when 'admin' then 'manager' when 'supervisor' then 'supervisor' end;

-- admin / supervisor collapse into the staff kind; their access now lives in role_id + all_sites.
update public.profiles set role = 'staff' where role in ('admin', 'supervisor');

-- ---------------------------------------------------------------------------
-- 9. Read policies that still keyed on the old owner/admin names. A staff member with
--    every-site scope (the Manager role) could otherwise see no sites at all.
-- ---------------------------------------------------------------------------
create or replace function public.sees_all_sites()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role = 'owner' or p.all_sites))
$$;
grant execute on function public.sees_all_sites() to authenticated;

drop policy sites_select on public.sites;
create policy sites_select on public.sites for select using (
  agency_id = public.current_agency_id()
  and (
    public.sees_all_sites()
    or exists (select 1 from public.supervisor_sites ss where ss.site_id = sites.id and ss.profile_id = auth.uid())
    or exists (select 1 from public.guards g where g.profile_id = auth.uid() and g.site_id = sites.id)
  )
);

drop policy leave_requests_select on public.leave_requests;
create policy leave_requests_select on public.leave_requests for select using (
  agency_id = public.current_agency_id()
  and (guard_id = public.current_guard_id() or public.sees_all_sites() or site_id in (select public.accessible_site_ids()))
);

drop policy guard_presence_select on public.guard_presence;
create policy guard_presence_select on public.guard_presence for select using (
  agency_id = public.current_agency_id()
  and (guard_id = public.current_guard_id() or public.sees_all_sites() or site_id in (select public.accessible_site_ids()))
);
