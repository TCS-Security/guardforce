-- GuardWatch AI demo seed. Everything is relative to now() so the dashboard always looks live.
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
values ('b0000000-0000-4000-8000-000000000099', 'platform@guardforce.test', 'GuardWatch Ops', 'platform_owner');

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


-- Six more live sites, so the book looks like a real mid-size agency: an IT park,
-- a mall, a hospital, a fulfilment centre, a bank branch and a school.
insert into public.sites (id, agency_id, name, client_name, address, city, lat, lng, fence_type, radius_m, polygon, leeway_m, guards_required, patrol_photo_required) values
  ('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'Manyata Embassy Business Park — Block 9', 'Embassy Group', 'Outer Ring Rd, Nagavara, Rachenahalli', 'Bengaluru', 13.04560, 77.62030, 'radius', 200, null, 50, 6, true),
  ('c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'Phoenix Marketcity, Whitefield', 'Phoenix Mills', 'Whitefield Main Rd, Mahadevapura', 'Bengaluru', 12.99700, 77.69670, 'radius', 240, null, 60, 5, true),
  ('c0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'Columbia Asia Hospital, Hebbal', 'Columbia Asia', 'Kirloskar Business Park, Bellary Rd, Hebbal', 'Bengaluru', 13.03580, 77.59120, 'radius', 160, null, 40, 4, true),
  ('c0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 'Delhivery Fulfilment Centre, Nelamangala', 'Delhivery Ltd', 'NH-48 Service Rd, Sondekoppa, Nelamangala', 'Bengaluru', 13.09940, 77.39450, 'polygon', 200,
    '{"type":"Polygon","coordinates":[[[77.3920,13.0980],[77.3972,13.0984],[77.3976,13.1012],[77.3922,13.1008],[77.3920,13.0980]]]}'::jsonb, 60, 4, true),
  ('c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 'Karnataka Bank — Jayanagar 4th Block', 'Karnataka Bank', '11th Main Rd, Jayanagar 4th Block', 'Bengaluru', 12.92790, 77.58340, 'radius', 90, null, 30, 2, false),
  ('c0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000001', 'Vidyashilp Academy, Jakkur', 'Vidyashilp Trust', 'Jakkur Plantation, Yelahanka', 'Bengaluru', 13.07660, 77.60410, 'radius', 220, null, 50, 3, false);

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

-- Twenty-four more guards for the new sites (PIN 1234 for all). Tenure is spread so the
-- guard list shows a realistic mix of old hands and recent joiners.
insert into public.guards (id, agency_id, employee_code, full_name, phone, phone_verified_at, pin_hash, designation, site_id, supervisor_id, status, registration_selfie_path, joined_at, languages, date_of_birth)
select
  ('e0000000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid,
  'a0000000-0000-4000-8000-000000000001',
  'SSS-' || lpad(v.n::text, 3, '0'),
  v.full_name,
  '99000000' || lpad(v.n::text, 2, '0'),
  now() - ((v.n * 7) || ' days')::interval,
  extensions.crypt('1234', extensions.gen_salt('bf')),
  v.designation,
  v.site_id::uuid,
  v.supervisor_id::uuid,
  'active',
  'a0000000-0000-4000-8000-000000000001/selfies/reg/SSS-' || lpad(v.n::text, 3, '0') || '.jpg',
  now() - ((v.n * 7) || ' days')::interval,
  v.languages::text[],
  v.dob::date
from (values
  (17, 'Mahesh Pawar',        'Head Guard',   'c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', '{mr,hi}',  '1983-02-11'),
  (18, 'Satyendra Mishra',    'Gate Guard',   'c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', '{hi}',     '1990-06-24'),
  (19, 'Nagaraj Hiremath',    'Gate Guard',   'c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', '{kn}',     '1988-09-30'),
  (20, 'Pintu Mandal',        'Patrol Guard', 'c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', '{bn,hi}',  '1994-04-02'),
  (21, 'Jagdish Barman',      'Night Guard',  'c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', '{as,hi}',  '1991-12-18'),
  (22, 'Ravi Shankar Tiwari', 'Night Guard',  'c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', '{hi,bho}', '1986-08-07'),
  (23, 'Firoz Khan',          'Head Guard',   'c0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', '{ur,hi}',  '1985-05-19'),
  (24, 'Sunita Rani',         'Lady Guard',   'c0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', '{hi,pa}',  '1993-03-27'),
  (25, 'Basavaraj Kamble',    'Gate Guard',   'c0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', '{kn,mr}',  '1989-11-14'),
  (26, 'Chandan Rai',         'Patrol Guard', 'c0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', '{hi,mai}', '1995-07-21'),
  (27, 'Ashok Pradhan',       'Night Guard',  'c0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', '{or,hi}',  '1987-01-09'),
  (28, 'Geetha Srinivasan',   'Lady Guard',   'c0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001', '{ta,kn}',  '1992-10-05'),
  (29, 'Devendra Chauhan',    'Gate Guard',   'c0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001', '{hi}',     '1984-02-28'),
  (30, 'Kiran Shetty',        'Head Guard',   'c0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001', '{kn,tu}',  '1981-09-16'),
  (31, 'Munna Paswan',        'Night Guard',  'c0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001', '{hi}',     '1996-05-11'),
  (32, 'Tej Bahadur Rana',    'Head Guard',   'c0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000001', '{ne,hi}',  '1982-12-04'),
  (33, 'Sanjay Kurmi',        'Gate Guard',   'c0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000001', '{hi}',     '1990-08-23'),
  (34, 'Mallikarjun Patil',   'Patrol Guard', 'c0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000001', '{kn}',     '1993-06-13'),
  (35, 'Rakesh Oraon',        'Night Guard',  'c0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000001', '{hi}',     '1997-02-20'),
  (36, 'Vinod Kulkarni',      'Head Guard',   'c0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000001', '{mr,kn}',  '1979-04-08'),
  (37, 'Arvind Choudhary',    'Gate Guard',   'c0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000001', '{hi}',     '1991-10-29'),
  (38, 'Shobha Hegde',        'Lady Guard',   'c0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000001', '{kn}',     '1994-01-17'),
  (39, 'Ganesh Kamath',       'Gate Guard',   'c0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000001', '{kn,tu}',  '1988-07-26'),
  (40, 'Hemant Dubey',        'Night Guard',  'c0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000001', '{hi}',     '1986-11-30')
) as v(n, full_name, designation, site_id, supervisor_id, languages, dob);

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

-- Full KYC for the new guards, with two police verifications still pending so the
-- compliance warnings have something real to point at.
insert into public.guard_documents (agency_id, guard_id, type, file_path, mime_type, number_masked, status, verified_by, verified_at, uploaded_by, issued_on)
select 'a0000000-0000-4000-8000-000000000001', g.id, t.type,
  'a0000000-0000-4000-8000-000000000001/kyc/' || g.employee_code || '/' || t.type || '.jpg', 'image/jpeg',
  case t.type when 'aadhaar' then 'XXXX XXXX ' || lpad((1000 + (random() * 8999)::int)::text, 4, '0')
              when 'pan' then 'XXXXX' || lpad((1000 + (random() * 8999)::int)::text, 4, '0') || 'X' else null end,
  (case when g.employee_code in ('SSS-023', 'SSS-031') and t.type = 'police_verification' then 'pending' else 'verified' end)::public.document_status,
  'b0000000-0000-4000-8000-000000000001', g.joined_at + interval '2 days', 'b0000000-0000-4000-8000-000000000001', (g.joined_at - interval '400 days')::date
from public.guards g
cross join (values ('aadhaar'::public.document_type), ('pan'), ('police_verification'), ('guard_kyc')) as t(type)
where g.employee_code between 'SSS-017' and 'SSS-040';

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

-- Roster patterns for the new sites. Day/Evening/Night split per the guards' designations.
insert into public.roster_patterns (agency_id, site_id, guard_id, shift_type_id, weekdays, starts_on, created_by)
select 'a0000000-0000-4000-8000-000000000001', v.site_id::uuid,
  ('e0000000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid,
  pg_temp.st(v.site_id::uuid, v.shift), v.weekdays::int[], current_date - 45, v.created_by::uuid
from (values
  (17, 'c0000000-0000-4000-8000-000000000005', 'Day',     '{1,2,3,4,5,6}',   'b0000000-0000-4000-8000-000000000001'),
  (18, 'c0000000-0000-4000-8000-000000000005', 'Day',     '{0,1,2,3,4,5,6}', 'b0000000-0000-4000-8000-000000000001'),
  (19, 'c0000000-0000-4000-8000-000000000005', 'Evening', '{0,1,2,3,4,5,6}', 'b0000000-0000-4000-8000-000000000001'),
  (20, 'c0000000-0000-4000-8000-000000000005', 'Evening', '{0,1,2,3,4,5,6}', 'b0000000-0000-4000-8000-000000000001'),
  (21, 'c0000000-0000-4000-8000-000000000005', 'Night',   '{0,1,2,3,4,5,6}', 'b0000000-0000-4000-8000-000000000001'),
  (22, 'c0000000-0000-4000-8000-000000000005', 'Night',   '{0,1,2,3,4,5,6}', 'b0000000-0000-4000-8000-000000000001'),
  (23, 'c0000000-0000-4000-8000-000000000006', 'Day',     '{0,1,2,3,4,5,6}', 'b0000000-0000-4000-8000-000000000001'),
  (24, 'c0000000-0000-4000-8000-000000000006', 'Day',     '{1,2,3,4,5,6}',   'b0000000-0000-4000-8000-000000000001'),
  (25, 'c0000000-0000-4000-8000-000000000006', 'Evening', '{0,1,2,3,4,5,6}', 'b0000000-0000-4000-8000-000000000001'),
  (26, 'c0000000-0000-4000-8000-000000000006', 'Evening', '{0,1,2,3,4,5}',   'b0000000-0000-4000-8000-000000000001'),
  (27, 'c0000000-0000-4000-8000-000000000006', 'Night',   '{0,1,2,3,4,5,6}', 'b0000000-0000-4000-8000-000000000001'),
  (28, 'c0000000-0000-4000-8000-000000000007', 'Day',     '{0,1,2,3,4,5,6}', 'b0000000-0000-4000-8000-000000000001'),
  (29, 'c0000000-0000-4000-8000-000000000007', 'Day',     '{1,2,3,4,5,6}',   'b0000000-0000-4000-8000-000000000001'),
  (30, 'c0000000-0000-4000-8000-000000000007', 'Evening', '{0,1,2,3,4,5,6}', 'b0000000-0000-4000-8000-000000000001'),
  (31, 'c0000000-0000-4000-8000-000000000007', 'Night',   '{0,1,2,3,4,5,6}', 'b0000000-0000-4000-8000-000000000001'),
  (32, 'c0000000-0000-4000-8000-000000000008', 'Day',     '{0,1,2,3,4,5,6}', 'b0000000-0000-4000-8000-000000000001'),
  (33, 'c0000000-0000-4000-8000-000000000008', 'Day',     '{1,2,3,4,5,6}',   'b0000000-0000-4000-8000-000000000001'),
  (34, 'c0000000-0000-4000-8000-000000000008', 'Evening', '{0,1,2,3,4,5,6}', 'b0000000-0000-4000-8000-000000000001'),
  (35, 'c0000000-0000-4000-8000-000000000008', 'Night',   '{0,1,2,3,4,5,6}', 'b0000000-0000-4000-8000-000000000001'),
  (36, 'c0000000-0000-4000-8000-000000000009', 'Day',     '{1,2,3,4,5,6}',   'b0000000-0000-4000-8000-000000000001'),
  (37, 'c0000000-0000-4000-8000-000000000009', 'Evening', '{1,2,3,4,5,6}',   'b0000000-0000-4000-8000-000000000001'),
  (38, 'c0000000-0000-4000-8000-000000000010', 'Day',     '{1,2,3,4,5}',     'b0000000-0000-4000-8000-000000000001'),
  (39, 'c0000000-0000-4000-8000-000000000010', 'Day',     '{1,2,3,4,5,6}',   'b0000000-0000-4000-8000-000000000001'),
  (40, 'c0000000-0000-4000-8000-000000000010', 'Night',   '{0,1,2,3,4,5,6}', 'b0000000-0000-4000-8000-000000000001')
) as v(n, site_id, shift, weekdays, created_by);

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
insert into public.patrol_routes (id, agency_id, site_id, name, description, frequency_min, grace_min, min_photos, created_by) values
  ('f0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000005', 'Block 9 perimeter', 'Compound wall, both lobbies, generator yard and the basement ramp', 120, 15, 2, 'b0000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000005', 'Parking sweep', 'B1 and B2 bays, two-wheeler stand, fire exits', 180, 20, 1, 'b0000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000006', 'Mall concourse round', 'Ground to third concourse, atrium, food court and all fire exits', 90, 15, 2, 'b0000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000006', 'Service corridor check', 'Back-of-house corridors, loading bay and waste yard', 180, 20, 1, 'b0000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000007', 'Ward and OPD round', 'OPD waiting, ward corridors, pharmacy shutter and the ambulance bay', 120, 15, 1, 'b0000000-0000-4000-8000-000000000003'),
  ('f0000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000008', 'Dock and fence line', 'All eight docks, trailer yard, rear fence and the seal-check point', 90, 15, 2, 'b0000000-0000-4000-8000-000000000003'),
  ('f0000000-0000-4000-8000-00000000000c', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000010', 'Campus round', 'Academic blocks, playground, bus bay and the back gate', 150, 20, 1, 'b0000000-0000-4000-8000-000000000003');

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
select public.simulate_agency_history('a0000000-0000-4000-8000-000000000001');

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

-- ---------------------------------------------------------------------------
-- Incidents (F11). Human-reported major events, deliberately distinct from the
-- automated `events` feed. Each one is pinned onto a real breadcrumb time so the
-- "where was everyone when it happened" map has positions to draw.
-- ---------------------------------------------------------------------------
do $$
declare
  v_agency uuid := 'a0000000-0000-4000-8000-000000000001';
  v_prestige uuid := 'c0000000-0000-4000-8000-000000000001';
  v_brigade uuid := 'c0000000-0000-4000-8000-000000000002';
  v_metro uuid := 'c0000000-0000-4000-8000-000000000003';
  v_site record;
  v_when timestamptz;
  v_guard uuid;
begin
  -- 1. Open: a theft at Prestige, minutes ago, while the post is still manned.
  select * into v_site from public.sites where id = v_prestige;
  select lp.recorded_at, sh.guard_id into v_when, v_guard
  from public.location_pings lp
  join public.shifts sh on sh.id = lp.shift_id
  where sh.site_id = v_prestige and sh.status = 'in_progress'
  order by lp.recorded_at desc limit 1;
  v_when := coalesce(v_when, now() - interval '20 minutes');

  insert into public.incidents (id, agency_id, site_id, type, severity, title, description, occurred_at,
    reported_by, guard_id, lat, lng, status)
  values ('11000000-0000-4000-8000-000000000001', v_agency, v_prestige, 'theft', 'high',
    'Two laptops taken from a car on the B2 parking level',
    'The client''s IT manager reported two laptops missing from a parked car on B2. The boom-barrier register shows an unregistered white hatchback leaving without a visitor pass around the same time. CCTV pull requested from the client; the guard on Gate 3 did not record the vehicle number. Client has been told we will report back by tomorrow morning.',
    v_when, 'b0000000-0000-4000-8000-000000000002', v_guard,
    v_site.lat + 0.0007, v_site.lng - 0.0005, 'open');

  -- 2. Investigating: trespass at Brigade Meadows earlier today.
  select * into v_site from public.sites where id = v_brigade;
  select lp.recorded_at, sh.guard_id into v_when, v_guard
  from public.location_pings lp
  join public.shifts sh on sh.id = lp.shift_id
  where sh.site_id = v_brigade and lp.recorded_at < now() - interval '4 hours'
  order by lp.recorded_at desc limit 1;
  v_when := coalesce(v_when, now() - interval '5 hours');

  insert into public.incidents (id, agency_id, site_id, type, severity, title, description, occurred_at,
    reported_by, guard_id, lat, lng, status)
  values ('11000000-0000-4000-8000-000000000002', v_agency, v_brigade, 'trespass', 'moderate',
    'Four men entered through the rear service gate',
    'Four men without passes walked in through the rear service gate while a delivery van was being checked in and went towards Block C. Residents called the guard room. They left on their own when challenged. The rear gate latch has been broken for a week and was reported to the RWA twice.',
    v_when, 'b0000000-0000-4000-8000-000000000002', v_guard, null, null, 'investigating');

  -- 3. Resolved: a fight at Metro two days ago, closed with a resolution note.
  select * into v_site from public.sites where id = v_metro;
  select lp.recorded_at, sh.guard_id into v_when, v_guard
  from public.location_pings lp
  join public.shifts sh on sh.id = lp.shift_id
  where sh.site_id = v_metro and sh.shift_date = current_date - 2
  order by lp.recorded_at desc limit 1;
  v_when := coalesce(v_when, now() - interval '2 days');

  insert into public.incidents (id, agency_id, site_id, type, severity, title, description, occurred_at,
    reported_by, guard_id, lat, lng, status, resolution, resolved_at, resolved_by)
  values ('11000000-0000-4000-8000-000000000003', v_agency, v_metro, 'fight', 'critical',
    'Fight between two loaders at the rear loading dock',
    'Two contract loaders came to blows at the rear dock over a queue dispute. One of them picked up a trolley bar. Our guard separated them and called the store manager; no serious injury, one loader had a cut lip and was taken to the clinic by the client.',
    v_when, 'b0000000-0000-4000-8000-000000000003', v_guard,
    v_site.lat - 0.0009, v_site.lng + 0.0008, 'resolved',
    'Store manager suspended both loaders pending the contractor''s enquiry. We have added a second guard to the dock for the evening peak and briefed the team to call the control room before intervening physically.',
    v_when + interval '20 hours', 'b0000000-0000-4000-8000-000000000001');
end $$;

-- ---------------------------------------------------------------------------
-- Seven more incidents across the expanded book, spread over the last three
-- weeks so the list has a real newest-first spine and every status/severity
-- combination the board can filter on is represented.
-- ---------------------------------------------------------------------------
do $$
declare
  v_agency uuid := 'a0000000-0000-4000-8000-000000000001';
  r record;
  v_guard uuid;
  v_site record;
  v_at timestamptz;
begin
  for r in
    select * from (values
      ('11000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000005', 'medical', 'high', 'resolved',
       1, '15:40',
       'Visitor collapsed in the Block 9 lobby',
       'A visitor waiting at the Block 9 reception collapsed at around the shift-change hour. Our head guard cleared the area, put him in the recovery position and called the Embassy facility desk and 108 at the same time. The ambulance reached in eleven minutes. The client''s own first-aid kit was used for the oxygen mask. The visitor was conscious before he was moved.',
       'Client''s facility head recorded it as handled correctly and asked us to put one first-aid trained guard on every day shift at Block 9. Two guards are booked onto the next St John first-aid batch.',
       'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', true),

      ('11000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000008', 'fire', 'critical', 'resolved',
       3, '02:15',
       'Cardboard baler caught fire at the rear of the fulfilment centre',
       'The cardboard baler at the rear of the FC began smoking during the night shift and caught flame. The night guard raised the alarm on the walkie, pulled the nearest two extinguishers and got the shutter down to stop the draught. The client''s own fire team and the Nelamangala tender both attended. No stock loss beyond the baled waste; no injuries.',
       'Client''s EHS team found the baler motor had been running past its duty cycle. We have added a baler temperature check to the dock patrol round and the guard who raised the alarm has been recommended for the quarterly award.',
       'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', true),

      ('11000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000007', 'altercation_with_client', 'moderate', 'investigating',
       5, '11:05',
       'Patient attender abused the guard at the OPD queue',
       'An attender in the OPD queue became abusive when asked to wait behind the line and pushed our lady guard. The hospital''s duty manager intervened. Our guard did not retaliate. The attender was escorted out by hospital security. We have asked the client for CCTV of the OPD counter for the enquiry file.',
       null,
       'b0000000-0000-4000-8000-000000000001', null, false),

      ('11000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000004', 'theft', 'high', 'investigating',
       8, '07:20',
       'Two bicycles taken from the Tower C basement',
       'Two residents reported bicycles missing from the Tower C basement stand on the same morning. The basement has no camera on the cycle stand and the night register shows no material-out entry. A scrap collector who had been let in for a flat renovation on the 9th floor is the line of enquiry; his entry was logged but his exit was not.',
       null,
       'b0000000-0000-4000-8000-000000000001', null, false),

      ('11000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000010', 'vandalism', 'moderate', 'investigating',
       11, '06:10',
       'Back gate lock broken and graffiti on the playground wall',
       'The back gate chain lock was found cut and the playground boundary wall had fresh spray paint when the morning guard opened up. Nothing was taken from the campus. The school has asked whether the night post should be extended to cover the back gate, which is currently outside the patrol round.',
       null,
       'b0000000-0000-4000-8000-000000000001', null, false),

      ('11000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000006', 'unauthorised_vehicle', 'low', 'resolved',
       14, '19:35',
       'Car parked in the fire lane without a pass for two hours',
       'A car with no parking pass was left in the mall''s east fire lane through the evening peak. The evening guard logged it, put a notice on the windscreen and called the mall control room; the owner was traced through a tenant and moved it.',
       'Mall operations have agreed to a wheel-clamp for repeat offenders and we have added a fire-lane sweep to the concourse round.',
       'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', true),

      ('11000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-000000000009', 'property_damage', 'low', 'resolved',
       19, '10:50',
       'ATM lobby shutter dented by a reversing auto',
       'An auto reversing in the lane clipped the ATM lobby shutter and dented the lower panel. The shutter still operates. Our guard noted the auto number and the branch manager was informed the same morning.',
       'Branch manager raised it with the auto owner, who paid for the panel. No claim on us.',
       'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', true)
    ) as t(id, site_id, itype, sev, st, days_ago, at_time, title, body, resolution, reporter, resolver, is_resolved)
  loop
    select * into v_site from public.sites where id = r.site_id::uuid;
    v_at := ((current_date - r.days_ago) + r.at_time::time) at time zone 'Asia/Kolkata';

    -- Pin it onto a guard who was actually on that post around then, when there is one.
    select sh.guard_id into v_guard
    from public.shifts sh
    where sh.site_id = r.site_id::uuid
      and sh.scheduled_start <= v_at
      and sh.scheduled_end   >= v_at
    order by sh.scheduled_start desc limit 1;
    if v_guard is null then
      select id into v_guard from public.guards where site_id = r.site_id::uuid and status = 'active' limit 1;
    end if;

    insert into public.incidents (id, agency_id, site_id, type, severity, title, description, occurred_at,
      reported_by, guard_id, lat, lng, status, resolution, resolved_at, resolved_by)
    values (r.id::uuid, v_agency, r.site_id::uuid, r.itype::public.incident_type, r.sev::public.incident_severity,
      r.title, r.body, v_at, r.reporter::uuid, v_guard,
      v_site.lat + (random() - 0.5) * 0.0018, v_site.lng + (random() - 0.5) * 0.0018,
      r.st::public.incident_status, r.resolution,
      case when r.is_resolved then v_at + interval '18 hours' else null end,
      r.resolver::uuid);
  end loop;
end $$;
