-- GuardForce core schema: tenancy, people, sites, KYC
-- All tenant tables carry agency_id and are row-scoped via RLS (see 0004_rls.sql).

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('owner', 'admin', 'supervisor', 'guard');
create type public.guard_status as enum ('invited', 'active', 'inactive');
create type public.fence_type as enum ('radius', 'polygon');
create type public.document_type as enum (
  'aadhaar', 'pan', 'police_verification', 'marksheet', 'guard_kyc', 'other'
);
create type public.document_status as enum ('pending', 'verified', 'rejected');
create type public.shift_status as enum (
  'scheduled', 'in_progress', 'completed', 'void_location_off', 'absent', 'cancelled'
);
create type public.attendance_status as enum ('present', 'half_day', 'absent', 'on_leave', 'pending');
create type public.trust_level as enum ('clean', 'flagged', 'suspicious');
create type public.event_type as enum (
  'CHECK_IN', 'CHECK_OUT', 'OUTSIDE_FENCE', 'FENCE_EXIT', 'FENCE_ENTER', 'LATE_START',
  'EARLY_CHECKOUT', 'LOCATION_OFF', 'LOCATION_ON', 'OUTAGE', 'TAMPER_SUSPECTED',
  'SHIFT_VOID', 'EXCEPTION_LOGGED', 'PATROL_STARTED', 'PATROL_COMPLETED', 'PATROL_LATE',
  'PATROL_MISSED', 'TASK_DONE', 'TASK_MISSED', 'LEAVE_REQUESTED', 'LEAVE_DECIDED',
  'ATTENDANCE_OVERRIDE', 'STAFFING_GAP', 'SYNCED_LATE'
);
create type public.event_severity as enum ('info', 'warn', 'critical');
create type public.patrol_status as enum ('scheduled', 'in_progress', 'completed', 'late', 'missed');
create type public.task_status as enum ('pending', 'in_progress', 'done', 'missed');
create type public.leave_type as enum ('casual', 'earned', 'unpaid');
create type public.leave_status as enum ('pending', 'approved', 'declined', 'cancelled');
create type public.notification_channel as enum ('push', 'whatsapp', 'sms', 'email', 'in_app');
create type public.notification_status as enum ('queued', 'sent', 'failed', 'read');

-- ---------------------------------------------------------------------------
-- Agencies & profiles
-- ---------------------------------------------------------------------------
create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  city text,
  logo_path text,
  -- operational settings (defaults per PRD)
  late_threshold_min int not null default 15,
  default_radius_m int not null default 150,
  default_leeway_m int not null default 50,
  half_day_ratio numeric(3,2) not null default 0.50,
  selfie_retention_days int not null default 90,
  location_off_warn_min int not null default 30,
  outage_threshold_min int not null default 10,
  staleness_min int not null default 15,
  digest_time time not null default '09:00',
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  role public.user_role not null default 'supervisor',
  full_name text not null,
  email text,
  phone text,
  avatar_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_agency_idx on public.profiles(agency_id);

-- ---------------------------------------------------------------------------
-- Sites & geofences
-- ---------------------------------------------------------------------------
create table public.sites (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  client_name text,
  address text,
  city text,
  lat double precision not null,
  lng double precision not null,
  fence_type public.fence_type not null default 'radius',
  radius_m int not null default 150,
  polygon jsonb, -- GeoJSON Polygon geometry when fence_type = polygon
  leeway_m int not null default 50,
  guards_required int not null default 1,
  patrol_photo_required boolean not null default true,
  is_active boolean not null default true,
  notes text,
  -- derived geography for fast fence queries (maintained by trigger)
  geom extensions.geography(geometry, 4326),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sites_agency_idx on public.sites(agency_id);
create index sites_geom_idx on public.sites using gist(geom);

create or replace function public.sites_sync_geom()
returns trigger language plpgsql as $$
begin
  if new.fence_type = 'polygon' and new.polygon is not null then
    new.geom := extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(new.polygon::text), 4326)::extensions.geography;
  else
    new.geom := extensions.ST_SetSRID(extensions.ST_MakePoint(new.lng, new.lat), 4326)::extensions.geography;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger sites_sync_geom before insert or update on public.sites
  for each row execute function public.sites_sync_geom();

-- Supervisor <-> site scoping (ROLE-1)
create table public.supervisor_sites (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  primary key (profile_id, site_id)
);
create index supervisor_sites_site_idx on public.supervisor_sites(site_id);

-- Shift types per site (morning / evening / night / custom)
create table public.shift_types (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null,
  start_time time not null,
  end_time time not null,
  guards_required int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index shift_types_site_idx on public.shift_types(site_id);

-- ---------------------------------------------------------------------------
-- Guards & KYC
-- ---------------------------------------------------------------------------
create table public.guards (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  profile_id uuid unique references public.profiles(id) on delete set null,
  employee_code text,
  full_name text not null,
  phone text not null,
  phone_verified_at timestamptz,
  pin_hash text,
  designation text, -- post at site
  site_id uuid references public.sites(id) on delete set null,
  supervisor_id uuid references public.profiles(id) on delete set null,
  status public.guard_status not null default 'invited',
  registration_selfie_path text,
  date_of_birth date,
  address text,
  emergency_contact text,
  languages text[] not null default '{}',
  joined_at timestamptz,
  invited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, phone)
);
create index guards_agency_idx on public.guards(agency_id);
create index guards_site_idx on public.guards(site_id);

create table public.guard_documents (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  guard_id uuid not null references public.guards(id) on delete cascade,
  type public.document_type not null,
  file_path text, -- storage object path in bucket `kyc-docs`
  mime_type text,
  number_masked text, -- e.g. Aadhaar "XXXX XXXX 1234"
  issued_on date,
  expires_on date,
  status public.document_status not null default 'pending',
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  rejection_reason text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guard_documents_guard_idx on public.guard_documents(guard_id);
-- one live doc per (guard, type) for mandatory slots
create unique index guard_documents_slot_idx on public.guard_documents(guard_id, type) where type <> 'other';

-- KYC docs are access-logged (NFR security)
create table public.document_access_logs (
  id bigserial primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  document_id uuid not null references public.guard_documents(id) on delete cascade,
  accessed_by uuid references public.profiles(id),
  share_id uuid, -- set when accessed via a public share link
  purpose text,
  ip text,
  created_at timestamptz not null default now()
);
create index document_access_logs_doc_idx on public.document_access_logs(document_id);

-- Shareable profile links (KYC-2: 30-day expiry)
create table public.profile_shares (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  guard_id uuid not null references public.guards(id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  created_by uuid references public.profiles(id),
  label text,
  include_documents boolean not null default true,
  expires_at timestamptz not null default now() + interval '30 days',
  revoked_at timestamptz,
  view_count int not null default 0,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index profile_shares_guard_idx on public.profile_shares(guard_id);

-- Guard invites (SMS/WhatsApp deep link)
create table public.guard_invites (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  guard_id uuid not null references public.guards(id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  channel public.notification_channel not null default 'sms',
  sent_at timestamptz,
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Device registrations (FCM tokens, app/OTA version telemetry)
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  guard_id uuid references public.guards(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  fcm_token text,
  platform text not null default 'android',
  device_model text,
  os_version text,
  app_version text,
  bundle_version text, -- OTA bundle version
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index devices_fcm_idx on public.devices(fcm_token) where fcm_token is not null;

-- Remote config / OTA channel config per agency (consumed by the guard app)
create table public.app_config (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  min_app_version text not null default '1.0.0',
  ota_channel text not null default 'production',
  ping_interval_moving_s int not null default 120,
  ping_interval_stationary_s int not null default 900,
  selfie_max_kb int not null default 120,
  photo_max_kb int not null default 250,
  features jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Audit log (AUD-1) — immutable
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigserial primary key,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  reason text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index audit_logs_agency_idx on public.audit_logs(agency_id, created_at desc);

create or replace function public.audit_logs_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_logs is append-only';
end $$;
create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

-- generic updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger agencies_touch before update on public.agencies for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger guards_touch before update on public.guards for each row execute function public.touch_updated_at();
create trigger guard_documents_touch before update on public.guard_documents for each row execute function public.touch_updated_at();
