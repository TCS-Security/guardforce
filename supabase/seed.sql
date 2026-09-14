-- GuardForce demo seed. Everything is relative to now() so the dashboard always looks live.
-- Logins (password for all: "guardforce"):
--   platform@guardforce.test  (platform admin — the SaaS provider, not a tenant member)
--   owner@sentinel.test       (Sentinel owner)
--   priya@sentinel.test       (Sentinel supervisor: Prestige Tech Park, Brigade Meadows)
--   arun@sentinel.test        (Sentinel supervisor: Metro Cash & Carry)
--   owner@falcon.test         (second tenant, on trial, empty)
-- Guard app PIN for every seeded guard: 1234

select setseed(0.42);

-- ---------------------------------------------------------------------------
-- Agency
-- ---------------------------------------------------------------------------
insert into public.agencies (id, name, slug, city)
values ('a0000000-0000-4000-8000-000000000001', 'Sentinel Security Services', 'sentinel', 'Bengaluru');


-- ---------------------------------------------------------------------------
-- Auth users + profiles
-- ---------------------------------------------------------------------------
create or replace function pg_temp.seed_user(p_id uuid, p_email text, p_password text, p_phone text default null)
returns void language plpgsql as $$
begin
  insert into auth.users (instance_id, id, aud, role, email, phone, encrypted_password, email_confirmed_at, phone_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email, p_phone,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(), case when p_phone is not null then now() end,
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text, jsonb_build_object('sub', p_id::text, 'email', p_email), 'email', now(), now(), now());
end $$;

select pg_temp.seed_user('b0000000-0000-4000-8000-000000000001', 'owner@sentinel.test', 'guardforce');
select pg_temp.seed_user('b0000000-0000-4000-8000-000000000002', 'priya@sentinel.test', 'guardforce');
select pg_temp.seed_user('b0000000-0000-4000-8000-000000000003', 'arun@sentinel.test', 'guardforce');

-- Roles were seeded by the agencies_bootstrap trigger; pick them up by system key.
create or replace function pg_temp.role_of(p_agency uuid, p_key text) returns uuid language sql as $$
  select id from public.roles where agency_id = p_agency and system_key = p_key
$$;

insert into public.profiles (id, agency_id, role, role_id, all_sites, full_name, email, phone) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'owner', pg_temp.role_of('a0000000-0000-4000-8000-000000000001', 'owner'), true, 'Rajesh Menon', 'owner@sentinel.test', '9845012345'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'staff', pg_temp.role_of('a0000000-0000-4000-8000-000000000001', 'supervisor'), false, 'Priya Nair', 'priya@sentinel.test', '9845023456'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'staff', pg_temp.role_of('a0000000-0000-4000-8000-000000000001', 'supervisor'), false, 'Arun Kumar', 'arun@sentinel.test', '9845034567');

-- ---------------------------------------------------------------------------
-- Platform admin (us) and a second, empty tenant on trial
-- ---------------------------------------------------------------------------
select pg_temp.seed_user('b0000000-0000-4000-8000-000000000099', 'platform@guardforce.test', 'guardforce');
insert into public.platform_admins (user_id, email, full_name, role)
values ('b0000000-0000-4000-8000-000000000099', 'platform@guardforce.test', 'GuardForce Ops', 'platform_owner');

insert into public.agencies (id, name, slug, city, status, plan)
values ('a0000000-0000-4000-8000-000000000002', 'Falcon Facility Services', 'falcon', 'Pune', 'trial', 'pilot');
select pg_temp.seed_user('b0000000-0000-4000-8000-000000000011', 'owner@falcon.test', 'guardforce');
insert into public.profiles (id, agency_id, role, role_id, all_sites, full_name, email)
values ('b0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000002', 'owner', pg_temp.role_of('a0000000-0000-4000-8000-000000000002', 'owner'), true, 'Neha Kulkarni', 'owner@falcon.test');

insert into public.notification_preferences (profile_id, agency_id, whatsapp_number) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '919845012345');

-- ---------------------------------------------------------------------------
-- Sites
-- ---------------------------------------------------------------------------
insert into public.sites (id, agency_id, name, client_name, address, city, lat, lng, fence_type, radius_m, polygon, leeway_m, guards_required, patrol_photo_required) values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Prestige Tech Park — Gate 3', 'Prestige Group', 'Marathahalli–Sarjapur Outer Ring Rd, Kadubeesanahalli', 'Bengaluru', 12.93540, 77.69250, 'radius', 180, null, 50, 6, true),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Brigade Meadows', 'Brigade Meadows RWA', 'Kanakapura Main Rd, Udayapura', 'Bengaluru', 12.84590, 77.51150, 'polygon', 150,
    '{"type":"Polygon","coordinates":[[[77.5100,12.8450],[77.5132,12.8452],[77.5134,12.8470],[77.5104,12.8468],[77.5100,12.8450]]]}'::jsonb, 50, 4, false),
  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Metro Cash & Carry, Yeshwanthpur', 'Metro Wholesale', 'Tumkur Rd, Yeshwanthpur Industrial Suburb', 'Bengaluru', 13.02810, 77.54220, 'radius', 220, null, 60, 4, true),
  ('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Sobha Dream Acres', 'Sobha Ltd', 'Panathur Main Rd, Balagere', 'Bengaluru', 12.93420, 77.72780, 'radius', 250, null, 50, 3, true);

insert into public.supervisor_sites (profile_id, site_id, agency_id) values
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001');

-- Shift types: Day 06–14, Evening 14–22, Night 22–06 for every site
insert into public.shift_types (id, agency_id, site_id, name, start_time, end_time, guards_required)
select
  ('d0000000-0000-4000-8000-0000000000' || lpad((row_number() over ())::text, 2, '0'))::uuid,
  s.agency_id, s.id, t.name, t.start_time, t.end_time, t.req
from public.sites s
cross join (values ('Day', '06:00'::time, '14:00'::time, 2), ('Evening', '14:00'::time, '22:00'::time, 2), ('Night', '22:00'::time, '06:00'::time, 2)) as t(name, start_time, end_time, req)
order by s.name, t.start_time;

-- ---------------------------------------------------------------------------
-- Guards (PIN 1234 for all)
-- ---------------------------------------------------------------------------
insert into public.guards (id, agency_id, employee_code, full_name, phone, phone_verified_at, pin_hash, designation, site_id, supervisor_id, status, registration_selfie_path, joined_at, languages, date_of_birth) values
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'SSS-001', 'Ramesh Yadav', '9900000001', now() - interval '120 days', extensions.crypt('1234', extensions.gen_salt('bf')), 'Gate Guard', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'active', 'a0000000-0000-4000-8000-000000000001/selfies/reg/SSS-001.jpg', now() - interval '120 days', '{hi,kn}', '1989-03-12'),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'SSS-002', 'Suresh Gowda', '9900000002', now() - interval '110 days', extensions.crypt('1234', extensions.gen_salt('bf')), 'Head Guard', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'active', 'a0000000-0000-4000-8000-000000000001/selfies/reg/SSS-002.jpg', now() - interval '110 days', '{kn,en}', '1984-07-30'),
  ('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'SSS-003', 'Mohan Lal', '9900000003', now() - interval '100 days', extensions.crypt('1234', extensions.gen_salt('bf')), 'Patrol Guard', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'active', 'a0000000-0000-4000-8000-000000000001/selfies/reg/SSS-003.jpg', now() - interval '100 days', '{hi}', '1992-11-02'),
  ('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'SSS-004', 'Bhupendra Singh', '9900000004', now() - interval '95 days', extensions.crypt('1234', extensions.gen_salt('bf')), 'Gate Guard', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'active', 'a0000000-0000-4000-8000-000000000001/selfies/reg/SSS-004.jpg', now() - interval '95 days', '{hi,en}', '1990-01-19'),
  ('e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'SSS-005', 'Anil Kumar Sahu', '9900000005', now() - interval '90 days', extensions.crypt('1234', extensions.gen_salt('bf')), 'Night Guard', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'active', 'a0000000-0000-4000-8000-000000000001/selfies/reg/SSS-005.jpg', now() - interval '90 days', '{hi,or}', '1987-05-25'),
  ('e0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'SSS-006', 'Venkatesh Reddy', '9900000006', now() - interval '85 days', extensions.crypt('1234', extensions.gen_salt('bf')), 'Night Guard', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'active', 'a0000000-0000-4000-8000-000000000001/selfies/reg/SSS-006.jpg', now() - interval '85 days', '{te,kn}', '1993-09-08'),
  ('e0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'SSS-007', 'Lakshmi Devi', '9900000007', now() - interval '80 days', extensions.crypt('1234', extensions.gen_salt('bf')), 'Lady Guard', 'c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'active', 'a0000000-0000-4000-8000-000000000001/selfies/reg/SSS-007.jpg', now() - interval '80 days', '{kn,ta}', '1991-02-14'),
  ('e0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 'SSS-008', 'Dinesh Thapa', '9900000008', now() - interval '75 days', extensions.crypt('1234', extensions.gen_salt('bf')), 'Gate Guard', 'c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'active', 'a0000000-0000-4000-8000-000000000001/selfies/reg/SSS-008.jpg', now() - interval '75 days', '{ne,hi}', '1995-06-21'),
  ('e0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 'SSS-009', 'Prakash Jha', '9900000009', now() - interval '70 days', extensions.crypt('1234', extensions.gen_salt('bf')), 'Patrol Guard', 'c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'active', 'a0000000-0000-4000-8000-000000000001/selfies/reg/SSS-009.jpg', now() - interval '70 days', '{hi,mai}', '1988-12-03'),
  ('e0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000001', 'SSS-010', 'Shivakumar M', '9900000010', now() - interval '65 days', extensions.crypt('1234', extensions.gen_salt('bf')), 'Head Guard', 'c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'active', 'a0000000-0000-4000-8000-000000000001/selfies/reg/SSS-010.jpg', now() - interval '65 days', '{kn}', '1982-04-17'),
  ('e0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000001', 'SSS-011', 'Imran Pasha', '9900000011', now() - interval '60 days', extensions.crypt('1234', extensions.gen_salt('bf')), 'Gate Guard', 'c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'active', 'a0000000-0000-4000-8000-000000000001/selfies/reg/SSS-011.jpg', now() - interval '60 days', '{ur,kn}', '1994-08-09'),
  ('e0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000001', 'SSS-012', 'Gopal Naik', '9900000012', now() - interval '55 days', extensions.crypt('1234', extensions.gen_salt('bf')), 'Night Guard', 'c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'active', 'a0000000-0000-4000-8000-000000000001/selfies/reg/SSS-012.jpg', now() - interval '55 days', '{kn,tu}', '1990-10-27'),
  ('e0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000001', 'SSS-013', 'Harish Chandra', '9900000013', now() - interval '50 days', extensions.crypt('1234', extensions.gen_salt('bf')), 'Gate Guard', 'c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'active', 'a0000000-0000-4000-8000-000000000001/selfies/reg/SSS-013.jpg', now() - interval '50 days', '{hi}', '1986-01-05'),
  -- incomplete KYC / invited guards
  ('e0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000001', 'SSS-014', 'Santosh Kumar', '9900000014', now() - interval '6 days', extensions.crypt('1234', extensions.gen_salt('bf')), 'Gate Guard', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'active', 'a0000000-0000-4000-8000-000000000001/selfies/reg/SSS-014.jpg', now() - interval '6 days', '{hi}', '1997-03-15'),
  ('e0000000-0000-4000-8000-000000000015', 'a0000000-0000-4000-8000-000000000001', 'SSS-015', 'Manjunath B', '9900000015', null, null, null, 'c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'invited', null, null, '{kn}', null),
  ('e0000000-0000-4000-8000-000000000016', 'a0000000-0000-4000-8000-000000000001', 'SSS-016', 'Rajni Kant', '9900000016', now() - interval '2 days', extensions.crypt('1234', extensions.gen_salt('bf')), null, 'c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'active', 'a0000000-0000-4000-8000-000000000001/selfies/reg/SSS-016.jpg', now() - interval '2 days', '{hi,bho}', '1996-07-07');

update public.guards set invited_at = now() - interval '3 days' where status = 'invited';
insert into public.guard_invites (agency_id, guard_id, channel, sent_at, created_by)
values ('a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000015', 'whatsapp', now() - interval '3 days', 'b0000000-0000-4000-8000-000000000003');

-- Full KYC for guards 1..13
insert into public.guard_documents (agency_id, guard_id, type, file_path, mime_type, number_masked, status, verified_by, verified_at, uploaded_by, issued_on)
select 'a0000000-0000-4000-8000-000000000001', g.id, t.type,
  'a0000000-0000-4000-8000-000000000001/kyc/' || g.employee_code || '/' || t.type || '.jpg', 'image/jpeg',
  case t.type when 'aadhaar' then 'XXXX XXXX ' || lpad((1000 + (random() * 8999)::int)::text, 4, '0')
              when 'pan' then 'XXXXX' || lpad((1000 + (random() * 8999)::int)::text, 4, '0') || 'X' else null end,
  (case when g.employee_code in ('SSS-011', 'SSS-012') and t.type = 'police_verification' then 'pending' else 'verified' end)::public.document_status,
  'b0000000-0000-4000-8000-000000000001', g.joined_at + interval '2 days', 'b0000000-0000-4000-8000-000000000001', (g.joined_at - interval '400 days')::date
from public.guards g
cross join (values ('aadhaar'::public.document_type), ('pan'), ('police_verification'), ('guard_kyc')) as t(type)
where g.employee_code between 'SSS-001' and 'SSS-013';

-- marksheet for a few
insert into public.guard_documents (agency_id, guard_id, type, file_path, mime_type, status, uploaded_by)
select 'a0000000-0000-4000-8000-000000000001', id, 'marksheet', 'a0000000-0000-4000-8000-000000000001/kyc/' || employee_code || '/marksheet.pdf', 'application/pdf', 'verified', 'b0000000-0000-4000-8000-000000000001'
from public.guards where employee_code in ('SSS-002', 'SSS-004', 'SSS-010');

-- Santosh (014): aadhaar + pan only, police verification missing -> cannot be rostered
insert into public.guard_documents (agency_id, guard_id, type, file_path, mime_type, number_masked, status, uploaded_by)
values
  ('a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000014', 'aadhaar', 'a0000000-0000-4000-8000-000000000001/kyc/SSS-014/aadhaar.jpg', 'image/jpeg', 'XXXX XXXX 4471', 'pending', 'b0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000014', 'pan', 'a0000000-0000-4000-8000-000000000001/kyc/SSS-014/pan.jpg', 'image/jpeg', 'XXXXX8821X', 'pending', 'b0000000-0000-4000-8000-000000000002');

-- Leave balances for the current year
insert into public.leave_balances (guard_id, agency_id, year)
select id, agency_id, extract(year from now())::int from public.guards;

-- ---------------------------------------------------------------------------
-- Roster patterns (guards 1-13). Site 1: Day = 1,2 ; Evening = 3,4 ; Night = 5,6
-- ---------------------------------------------------------------------------
create or replace function pg_temp.st(p_site uuid, p_name text) returns uuid language sql as $$
  select id from public.shift_types where site_id = p_site and name = p_name
$$;

insert into public.roster_patterns (agency_id, site_id, guard_id, shift_type_id, weekdays, starts_on, created_by) values
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', pg_temp.st('c0000000-0000-4000-8000-000000000001', 'Day'), '{1,2,3,4,5,6}', current_date - 45, 'b0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', pg_temp.st('c0000000-0000-4000-8000-000000000001', 'Day'), '{0,1,2,3,4,5,6}', current_date - 45, 'b0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', pg_temp.st('c0000000-0000-4000-8000-000000000001', 'Evening'), '{0,1,2,3,4,5,6}', current_date - 45, 'b0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004', pg_temp.st('c0000000-0000-4000-8000-000000000001', 'Evening'), '{0,1,2,3,4,5,6}', current_date - 45, 'b0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000005', pg_temp.st('c0000000-0000-4000-8000-000000000001', 'Night'), '{0,1,2,3,4,5,6}', current_date - 45, 'b0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000006', pg_temp.st('c0000000-0000-4000-8000-000000000001', 'Night'), '{0,1,2,3,4,5,6}', current_date - 45, 'b0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000007', pg_temp.st('c0000000-0000-4000-8000-000000000002', 'Day'), '{0,1,2,3,4,5,6}', current_date - 45, 'b0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000008', pg_temp.st('c0000000-0000-4000-8000-000000000002', 'Evening'), '{0,1,2,3,4,5,6}', current_date - 45, 'b0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000009', pg_temp.st('c0000000-0000-4000-8000-000000000002', 'Night'), '{0,1,2,3,4,5,6}', current_date - 45, 'b0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000010', pg_temp.st('c0000000-0000-4000-8000-000000000003', 'Day'), '{0,1,2,3,4,5,6}', current_date - 45, 'b0000000-0000-4000-8000-000000000003'),
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000011', pg_temp.st('c0000000-0000-4000-8000-000000000003', 'Evening'), '{0,1,2,3,4,5,6}', current_date - 45, 'b0000000-0000-4000-8000-000000000003'),
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000012', pg_temp.st('c0000000-0000-4000-8000-000000000003', 'Night'), '{0,1,2,3,4,5,6}', current_date - 45, 'b0000000-0000-4000-8000-000000000003'),
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000013', pg_temp.st('c0000000-0000-4000-8000-000000000004', 'Day'), '{1,2,3,4,5,6}', current_date - 45, 'b0000000-0000-4000-8000-000000000001');

-- Approved leave in the past + pending ones now (must exist before materializing so on_leave shows)
insert into public.leave_requests (agency_id, guard_id, site_id, type, start_date, end_date, reason, status, decided_by, decided_at, created_at) values
  ('a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'casual', current_date - 12, current_date - 11, 'Family function in village', 'approved', 'b0000000-0000-4000-8000-000000000002', now() - interval '14 days', now() - interval '15 days'),
  ('a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000002', 'earned', current_date - 20, current_date - 16, 'Travelling home to Nepal', 'approved', 'b0000000-0000-4000-8000-000000000002', now() - interval '25 days', now() - interval '26 days'),
  ('a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000003', 'casual', current_date - 5, current_date - 5, 'Medical appointment', 'declined', 'b0000000-0000-4000-8000-000000000003', now() - interval '7 days', now() - interval '8 days'),
  ('a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'casual', current_date + 3, current_date + 4, 'Daughter''s school admission', 'pending', null, null, now() - interval '1 day'),
  ('a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000003', 'earned', current_date + 7, current_date + 12, 'Annual visit home', 'pending', null, null, now() - interval '3 hours'),
  ('a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', 'unpaid', current_date + 1, current_date + 1, 'Court hearing', 'pending', null, null, now() - interval '30 minutes');

update public.leave_balances set casual_used = 2 where guard_id = 'e0000000-0000-4000-8000-000000000003';
update public.leave_balances set earned_used = 5 where guard_id = 'e0000000-0000-4000-8000-000000000008';

-- Materialize 35 days back through 7 days ahead
select public.materialize_roster('a0000000-0000-4000-8000-000000000001', current_date - 35, current_date + 7);

-- Apply approved leave to materialized shifts
update public.shifts s set attendance = 'on_leave', status = 'cancelled'
from public.leave_requests lr
where lr.guard_id = s.guard_id and lr.status = 'approved' and s.shift_date between lr.start_date and lr.end_date;

-- ---------------------------------------------------------------------------
-- Patrol routes
-- ---------------------------------------------------------------------------
insert into public.patrol_routes (id, agency_id, site_id, name, description, frequency_min, grace_min, min_photos, created_by) values
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Perimeter round', 'Full walk of the compound wall, both gates and the basement ramp', 120, 15, 2, 'b0000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Parking levels', 'B1 and B2 parking, check fire exits', 180, 20, 1, 'b0000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'Block round', 'All 4 residential blocks and the clubhouse', 120, 15, 1, 'b0000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'Loading bay check', 'Loading docks, cold storage doors, rear fence', 90, 15, 1, 'b0000000-0000-4000-8000-000000000003'),
  ('f0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004', 'Tower round', 'Towers A–D lobbies and terrace doors', 120, 15, 1, 'b0000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------------------
-- Task templates (global seeds) + tasks
-- ---------------------------------------------------------------------------
insert into public.task_templates (agency_id, key, title, description, photo_required) values
  (null, 'main_gate_check', 'Main gate check', 'Verify barrier, boom gate and visitor register at the main gate', true),
  (null, 'shift_change_briefing', 'Shift-change briefing', 'Hand over keys, logbook and pending issues to the incoming guard', true),
  (null, 'visitor_log_check', 'Visitor log check', 'Confirm every visitor entry has an out-time and a vehicle number', true),
  (null, 'fire_exit_check', 'Fire exit check', 'All fire exits unobstructed and alarm panel green', true);

-- ---------------------------------------------------------------------------
-- Simulate history for past shifts and live activity for today.
-- ---------------------------------------------------------------------------
do $$
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
  select * into ag from public.agencies limit 1;

  for s in
    select sh.*, g.full_name from public.shifts sh join public.guards g on g.id = sh.guard_id
    where sh.status = 'scheduled' and sh.scheduled_start < now()
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
end $$;

-- Late-start alert for the no-show (scheduled, not started, already due)
insert into public.events (agency_id, site_id, guard_id, shift_id, type, severity, title, payload, created_at)
select s.agency_id, s.site_id, s.guard_id, s.id, 'LATE_START', 'warn', g.full_name || ' has not started the shift',
  jsonb_build_object('scheduled_start', s.scheduled_start, 'body', 'Scheduled ' || to_char(s.scheduled_start at time zone 'Asia/Kolkata', 'HH24:MI')), s.scheduled_start + interval '15 minutes'
from public.shifts s join public.guards g on g.id = s.guard_id
where s.status = 'scheduled' and s.scheduled_start + interval '15 minutes' < now() and s.scheduled_end > now();

-- Tasks for today
insert into public.tasks (id, agency_id, site_id, template_id, title, description, due_at, photo_required, status, created_by) values
  ('10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', (select id from public.task_templates where key = 'main_gate_check'), 'Main gate check', 'Verify barrier, boom gate and visitor register at the main gate', date_trunc('hour', now()) + interval '2 hours', true, 'pending', 'b0000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', (select id from public.task_templates where key = 'shift_change_briefing'), 'Shift-change briefing', 'Hand over keys, logbook and pending issues to the incoming guard', now() - interval '3 hours', true, 'done', 'b0000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', (select id from public.task_templates where key = 'visitor_log_check'), 'Visitor log check', 'Confirm every visitor entry has an out-time', now() - interval '5 hours', true, 'missed', 'b0000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', (select id from public.task_templates where key = 'fire_exit_check'), 'Fire exit check', 'All fire exits unobstructed and alarm panel green', now() + interval '4 hours', true, 'in_progress', 'b0000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', null, 'Replace torch batteries at Gate 3', 'Client complained the torch at the night post is dim', now() + interval '20 hours', false, 'pending', 'b0000000-0000-4000-8000-000000000002');

insert into public.task_assignments (task_id, guard_id, agency_id, status, started_at, completed_at, photo_path, note) values
  ('10000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'pending', null, null, null, null),
  ('10000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'done', now() - interval '3 hours 20 minutes', now() - interval '3 hours 5 minutes', 'a0000000-0000-4000-8000-000000000001/tasks/10000000-0000-4000-8000-000000000002/done.jpg', 'Keys and logbook handed to Mohan'),
  ('10000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'missed', null, null, null, null),
  ('10000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000001', 'in_progress', now() - interval '25 minutes', null, null, null),
  ('10000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'pending', null, null, null, null);

insert into public.events (agency_id, site_id, guard_id, type, severity, title, payload, created_at) values
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'TASK_DONE', 'info', 'Suresh Gowda completed “Shift-change briefing”', '{"task_id":"10000000-0000-4000-8000-000000000002"}', now() - interval '3 hours 5 minutes'),
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000007', 'TASK_MISSED', 'warn', 'Lakshmi Devi missed “Visitor log check”', '{"task_id":"10000000-0000-4000-8000-000000000003"}', now() - interval '4 hours 30 minutes');

-- One active shareable profile
insert into public.profile_shares (agency_id, guard_id, token, created_by, label, expires_at, view_count, last_viewed_at)
values ('a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'demo-share-suresh-gowda-7f3a9c', 'b0000000-0000-4000-8000-000000000001', 'Prestige Group — Gate 3 deployment', now() + interval '22 days', 3, now() - interval '2 days');

-- Devices
insert into public.devices (agency_id, guard_id, fcm_token, device_model, os_version, app_version, bundle_version, last_seen_at)
select agency_id, id, 'fcm-' || employee_code, (array['Redmi 9A','Samsung M12','Realme C11','Vivo Y20'])[1 + (random() * 3)::int], (array['11','12','13'])[1 + (random() * 2)::int], '1.0.0', '2026.09.1', now() - (random() * interval '6 hours')
from public.guards where status = 'active';
