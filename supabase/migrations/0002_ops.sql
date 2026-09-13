-- GuardForce operations schema: roster, shifts, tracking, patrols, tasks, leave, notifications

-- ---------------------------------------------------------------------------
-- Roster
-- ---------------------------------------------------------------------------
-- Weekly repeating pattern: guard works shift_type on given weekdays (0=Sun..6=Sat)
create table public.roster_patterns (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  guard_id uuid not null references public.guards(id) on delete cascade,
  shift_type_id uuid not null references public.shift_types(id) on delete cascade,
  weekdays int[] not null default '{0,1,2,3,4,5,6}',
  starts_on date not null default current_date,
  ends_on date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index roster_patterns_guard_idx on public.roster_patterns(guard_id);
create index roster_patterns_site_idx on public.roster_patterns(site_id);

-- Concrete assignment per date. Materialized from patterns or created ad hoc.
create table public.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  guard_id uuid not null references public.guards(id) on delete cascade,
  shift_type_id uuid not null references public.shift_types(id) on delete cascade,
  pattern_id uuid references public.roster_patterns(id) on delete set null,
  shift_date date not null,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (guard_id, shift_date, shift_type_id)
);
create index shift_assignments_site_date_idx on public.shift_assignments(site_id, shift_date);
create index shift_assignments_guard_date_idx on public.shift_assignments(guard_id, shift_date);

-- ---------------------------------------------------------------------------
-- Shifts (actual attendance records) — the money path
-- ---------------------------------------------------------------------------
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  guard_id uuid not null references public.guards(id) on delete cascade,
  shift_type_id uuid references public.shift_types(id) on delete set null,
  assignment_id uuid unique references public.shift_assignments(id) on delete set null,
  shift_date date not null,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  -- start
  started_at timestamptz,          -- server timestamp
  start_captured_at timestamptz,   -- device timestamp (offline capture)
  start_selfie_path text,
  start_lat double precision,
  start_lng double precision,
  start_accuracy_m real,
  start_in_fence boolean,
  start_distance_m real,
  -- end
  ended_at timestamptz,
  end_captured_at timestamptz,
  end_selfie_path text,
  end_lat double precision,
  end_lng double precision,
  end_accuracy_m real,
  end_in_fence boolean,
  -- computed
  status public.shift_status not null default 'scheduled',
  attendance public.attendance_status not null default 'pending',
  trust public.trust_level,
  flags text[] not null default '{}',
  late_by_min int not null default 0,
  worked_minutes int not null default 0,
  away_seconds int not null default 0,
  location_off_seconds int not null default 0,
  location_enabled boolean not null default true,
  location_off_since timestamptz,
  last_warned_at timestamptz,
  device jsonb not null default '{}'::jsonb, -- battery, mock, model, app_version
  exception_id uuid,
  override_attendance public.attendance_status,
  override_by uuid references public.profiles(id),
  override_reason text,
  override_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shifts_site_date_idx on public.shifts(site_id, shift_date);
create index shifts_guard_date_idx on public.shifts(guard_id, shift_date desc);
create index shifts_agency_status_idx on public.shifts(agency_id, status);
create trigger shifts_touch before update on public.shifts for each row execute function public.touch_updated_at();

-- Manager exception (LOC-3)
create table public.shift_exceptions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  logged_by uuid not null references public.profiles(id),
  reason text not null check (length(reason) >= 10),
  category text not null default 'device_failure', -- device_failure | gps_failure | network | other
  created_at timestamptz not null default now()
);
create index shift_exceptions_shift_idx on public.shift_exceptions(shift_id);
alter table public.shifts add constraint shifts_exception_fk
  foreign key (exception_id) references public.shift_exceptions(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Location tracking
-- ---------------------------------------------------------------------------
create table public.location_pings (
  id bigserial primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  guard_id uuid not null references public.guards(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete cascade,
  recorded_at timestamptz not null,
  received_at timestamptz not null default now(),
  lat double precision not null,
  lng double precision not null,
  accuracy_m real,
  speed_mps real,
  battery_pct smallint,
  is_mock boolean not null default false,
  in_fence boolean,
  distance_m real
);
create index location_pings_shift_time_idx on public.location_pings(shift_id, recorded_at);
create index location_pings_guard_time_idx on public.location_pings(guard_id, recorded_at desc);

-- Live presence: one row per guard, drives the live map (realtime)
create table public.guard_presence (
  guard_id uuid primary key references public.guards(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  shift_id uuid references public.shifts(id) on delete set null,
  lat double precision,
  lng double precision,
  accuracy_m real,
  battery_pct smallint,
  in_fence boolean,
  is_mock boolean not null default false,
  location_enabled boolean not null default true,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now()
);
create index guard_presence_agency_idx on public.guard_presence(agency_id);

-- ---------------------------------------------------------------------------
-- Events feed
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  site_id uuid references public.sites(id) on delete cascade,
  guard_id uuid references public.guards(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete cascade,
  type public.event_type not null,
  severity public.event_severity not null default 'info',
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  acknowledged_by uuid references public.profiles(id),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);
create index events_agency_time_idx on public.events(agency_id, created_at desc);
create index events_site_time_idx on public.events(site_id, created_at desc);
create index events_guard_time_idx on public.events(guard_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Patrols (F6)
-- ---------------------------------------------------------------------------
create table public.patrol_routes (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null,
  description text,
  frequency_min int not null default 120, -- expected every N minutes
  grace_min int not null default 15,       -- late if started > grace after expected
  shift_type_id uuid references public.shift_types(id) on delete set null, -- null = all shifts
  min_photos int not null default 1,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index patrol_routes_site_idx on public.patrol_routes(site_id);

create table public.patrols (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  route_id uuid references public.patrol_routes(id) on delete set null,
  guard_id uuid not null references public.guards(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete cascade,
  expected_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  status public.patrol_status not null default 'scheduled',
  trail jsonb, -- GeoJSON LineString of breadcrumbs
  distance_m real,
  duration_s int,
  notes text,
  created_at timestamptz not null default now()
);
create index patrols_site_time_idx on public.patrols(site_id, expected_at desc);
create index patrols_shift_idx on public.patrols(shift_id);

create table public.patrol_photos (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  patrol_id uuid not null references public.patrols(id) on delete cascade,
  file_path text not null,
  lat double precision,
  lng double precision,
  taken_at timestamptz not null default now(),
  caption text
);
create index patrol_photos_patrol_idx on public.patrol_photos(patrol_id);

-- ---------------------------------------------------------------------------
-- Tasks (F7)
-- ---------------------------------------------------------------------------
create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade, -- null = global seed
  key text,
  title text not null,
  description text,
  photo_required boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  template_id uuid references public.task_templates(id) on delete set null,
  title text not null,
  description text,
  due_at timestamptz,
  photo_required boolean not null default true,
  status public.task_status not null default 'pending',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_site_due_idx on public.tasks(site_id, due_at);
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();

create table public.task_assignments (
  task_id uuid not null references public.tasks(id) on delete cascade,
  guard_id uuid not null references public.guards(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  status public.task_status not null default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  photo_path text,
  note text,
  lat double precision,
  lng double precision,
  primary key (task_id, guard_id)
);
create index task_assignments_guard_idx on public.task_assignments(guard_id);

-- ---------------------------------------------------------------------------
-- Leave (F8)
-- ---------------------------------------------------------------------------
create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  guard_id uuid not null references public.guards(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  type public.leave_type not null default 'casual',
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  reason text,
  status public.leave_status not null default 'pending',
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
create index leave_requests_guard_idx on public.leave_requests(guard_id, start_date desc);
create index leave_requests_site_idx on public.leave_requests(site_id, start_date);

create table public.leave_balances (
  guard_id uuid not null references public.guards(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  year int not null,
  casual_total int not null default 12,
  earned_total int not null default 15,
  casual_used int not null default 0,
  earned_used int not null default 0,
  unpaid_used int not null default 0,
  primary key (guard_id, year)
);

-- ---------------------------------------------------------------------------
-- Notifications outbox (F10)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  recipient_profile_id uuid references public.profiles(id) on delete cascade,
  recipient_guard_id uuid references public.guards(id) on delete cascade,
  channel public.notification_channel not null default 'in_app',
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  status public.notification_status not null default 'queued',
  event_id uuid references public.events(id) on delete set null,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications(recipient_profile_id, created_at desc);
create index notifications_status_idx on public.notifications(status) where status = 'queued';

create table public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  late_start boolean not null default true,
  fence_exit boolean not null default true,
  location_off boolean not null default true,
  outage boolean not null default true,
  patrol_missed boolean not null default true,
  leave_requests boolean not null default true,
  daily_digest boolean not null default true,
  whatsapp_number text,
  updated_at timestamptz not null default now()
);

-- Realtime publication for live surfaces
alter publication supabase_realtime add table public.guard_presence, public.events, public.shifts, public.patrols;
