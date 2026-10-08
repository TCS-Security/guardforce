-- ---------------------------------------------------------------------------
-- Eagle Security Agency — demo tenant
--
-- Builds a believable copy of Eagle's own business so their MD sees their clients,
-- not ours: 25 sites (23 Bengaluru, 2 Mumbai), ~200 guards, a fortnight of history,
-- last night's exceptions and this morning's attendance. Plan: docs/eagle-demo-plan.md
--
-- Re-runnable. It deletes its own tenant first, and every tenant table cascades from
-- `agencies`, so a second run is a clean rebuild. Run it again shortly before the demo
-- so "last night" and "this morning" line up with the clock.
--
--   psql "$DB_URL" -f supabase/demo/eagle.sql
--   -- or paste into the Supabase Studio SQL editor
--
-- Staff logins, password `eagle-demo`:
--   owner@eagle-demo.test     Tharun Thimmaiah   (Owner, all sites)
--   ops@eagle-demo.test       Latha Srinivasan   (Manager, all sites)
--   fo.east@eagle-demo.test   Mahesh Gowda       (Supervisor, East cluster)
--   fo.mumbai@eagle-demo.test Sandeep Jadhav     (Supervisor, Mumbai)
-- Demo guard for the phone: +91 90000 00001 at Eagle HQ, unclaimed. Guard PIN once
-- claimed is whatever the app sets. Every other guard's PIN is 1234.
-- ---------------------------------------------------------------------------

begin;

-- 1. Wipe -------------------------------------------------------------------
-- Every tenant table cascades from `agencies`, so one delete clears the lot. The
-- `roles_protect` trigger refuses to let the Owner role go, though, and a cascade is
-- still a delete — so it comes off for the length of the wipe. Targeted, rather than
-- `session_replication_role = replica`, which would also silence `agencies_bootstrap`
-- and leave the new tenant with no roles at all.
alter table public.roles disable trigger roles_protect;
delete from public.agencies where id = 'a0000000-0000-4000-8000-00000000ea91';
alter table public.roles enable trigger roles_protect;

delete from auth.users where email like '%@eagle-demo.test';
-- The demo phone too, so a re-run puts the guard app back to its first-run flow
-- rather than silently signing straight in as an already-claimed guard.
delete from auth.users where phone in ('919000000001', '+919000000001', '9000000001');

-- 2. Tenant. `agencies_bootstrap` seeds the four system roles and app_config. ---
insert into public.agencies (id, name, slug, city, status, plan, timezone,
  late_threshold_min, default_radius_m, default_leeway_m, digest_time)
values ('a0000000-0000-4000-8000-00000000ea91', 'Eagle Security Agency', 'eagle-demo', 'Bengaluru', 'active', 'pilot',
  'Asia/Kolkata', 10, 120, 40, '07:00');

-- 3. Staff logins and profiles ---------------------------------------------
create or replace function pg_temp.seed_user(p_id uuid, p_email text, p_password text)
returns void language plpgsql as $$
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text, jsonb_build_object('sub', p_id::text, 'email', p_email), 'email', now(), now(), now());
end $$;

create or replace function pg_temp.role_of(p_key text) returns uuid language sql as $$
  select id from public.roles where agency_id = 'a0000000-0000-4000-8000-00000000ea91' and system_key = p_key
$$;

select pg_temp.seed_user('b0000000-0000-4000-8000-00000000ea01', 'owner@eagle-demo.test',     'eagle-demo');
select pg_temp.seed_user('b0000000-0000-4000-8000-00000000ea02', 'ops@eagle-demo.test',       'eagle-demo');
select pg_temp.seed_user('b0000000-0000-4000-8000-00000000ea03', 'fo.east@eagle-demo.test',   'eagle-demo');
select pg_temp.seed_user('b0000000-0000-4000-8000-00000000ea04', 'fo.mumbai@eagle-demo.test', 'eagle-demo');

insert into public.profiles (id, agency_id, role, role_id, all_sites, full_name, email, phone) values
  ('b0000000-0000-4000-8000-00000000ea01', 'a0000000-0000-4000-8000-00000000ea91', 'owner', pg_temp.role_of('owner'),      true,  'Tharun Thimmaiah', 'owner@eagle-demo.test',     '9845100001'),
  ('b0000000-0000-4000-8000-00000000ea02', 'a0000000-0000-4000-8000-00000000ea91', 'staff', pg_temp.role_of('manager'),    true,  'Latha Srinivasan', 'ops@eagle-demo.test',       '9845100002'),
  ('b0000000-0000-4000-8000-00000000ea03', 'a0000000-0000-4000-8000-00000000ea91', 'staff', pg_temp.role_of('supervisor'), false, 'Mahesh Gowda',     'fo.east@eagle-demo.test',   '9845100003'),
  ('b0000000-0000-4000-8000-00000000ea04', 'a0000000-0000-4000-8000-00000000ea91', 'staff', pg_temp.role_of('supervisor'), false, 'Sandeep Jadhav',   'fo.mumbai@eagle-demo.test', '9845100004');

insert into public.notification_preferences (profile_id, agency_id, whatsapp_number)
values ('b0000000-0000-4000-8000-00000000ea01', 'a0000000-0000-4000-8000-00000000ea91', '919845100001');

-- 4. Sites ------------------------------------------------------------------
insert into public.sites (id, agency_id, name, client_name, address, city, lat, lng, fence_type, radius_m, polygon, leeway_m, guards_required, patrol_photo_required, notes) values
  ('c0000000-0000-4000-8000-0000ea000001', 'a0000000-0000-4000-8000-00000000ea91', $$C. Krishniah Chetty & Sons — The Touchstone$$, $$C. Krishniah Chetty & Sons$$, $$3A Main Guard Cross Rd, Shivaji Nagar$$, $$Bengaluru$$, 12.98075, 77.60734, 'radius', 70, null, 40, 3, true, $$12h shift pattern; 3/1 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000002', 'a0000000-0000-4000-8000-00000000ea91', $$Bhima Jewellers, Jayanagar 4th Block$$, $$Bhima Jewellers$$, $$33rd Cross, Jayanagar 4th Block$$, $$Bengaluru$$, 12.92629, 77.58601, 'radius', 70, null, 40, 4, true, $$12h shift pattern; 4/2 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000003', 'a0000000-0000-4000-8000-00000000ea91', $$Bhima Jewellers, Malleshwaram$$, $$Bhima Jewellers$$, $$Sampige Rd, Malleshwaram$$, $$Bengaluru$$, 13.00392, 77.57125, 'radius', 70, null, 40, 3, true, $$12h shift pattern; 3/1 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000004', 'a0000000-0000-4000-8000-00000000ea91', $$Consulate-General of Japan$$, $$Consulate-General of Japan$$, $$Prestige Nebula, Cubbon Rd$$, $$Bengaluru$$, 12.98234, 77.59684, 'radius', 90, null, 40, 3, true, $$12h shift pattern; 3/1 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000005', 'a0000000-0000-4000-8000-00000000ea91', $$Diageo India — UB Tower$$, $$Diageo India / United Spirits$$, $$UB City, Vittal Mallya Rd$$, $$Bengaluru$$, 12.97186, 77.59567, 'radius', 120, null, 40, 4, true, $$8h shift pattern; 4/4/2 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000006', 'a0000000-0000-4000-8000-00000000ea91', $$Verint — ITC Green Centre$$, $$Verint Systems$$, $$Banaswadi Main Rd$$, $$Bengaluru$$, 12.99863, 77.62663, 'radius', 110, null, 40, 3, true, $$8h shift pattern; 3/3/1 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000007', 'a0000000-0000-4000-8000-00000000ea91', $$Hyundai Motor India — South Regional Office$$, $$Hyundai Motor India$$, $$Embassy One, Bellary Rd$$, $$Bengaluru$$, 13.01993, 77.58564, 'radius', 100, null, 40, 2, true, $$8h shift pattern; 2/1/1 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000008', 'a0000000-0000-4000-8000-00000000ea91', $$BPL Medical Technologies — HQ$$, $$BPL Medical Technologies$$, $$Prestige Emerald, Madras Bank Rd$$, $$Bengaluru$$, 12.97278, 77.59946, 'radius', 80, null, 40, 1, true, $$12h shift pattern; 1/1 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000009', 'a0000000-0000-4000-8000-00000000ea91', $$BPL Medical Technologies — Jigani plant$$, $$BPL Medical Technologies$$, $$Jigani Industrial Area$$, $$Bengaluru$$, 12.77663, 77.63532, 'polygon', 260, '{"type":"Polygon","coordinates":[[[77.63298,12.77429],[77.63766,12.77429],[77.63766,12.77897],[77.63298,12.77897],[77.63298,12.77429]]]}'::jsonb, 60, 4, true, $$12h shift pattern; 4/3 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000010', 'a0000000-0000-4000-8000-00000000ea91', $$Brigade Group — HQ, WTC$$, $$Brigade Group$$, $$World Trade Center, Brigade Gateway$$, $$Bengaluru$$, 13.01225, 77.55617, 'radius', 130, null, 40, 3, true, $$8h shift pattern; 3/3/2 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000011', 'a0000000-0000-4000-8000-00000000ea91', $$Brigade Metropolis$$, $$Brigade Group$$, $$ITPL Main Rd, Mahadevapura$$, $$Bengaluru$$, 12.99098, 77.70254, 'polygon', 420, '{"type":"Polygon","coordinates":[[[77.69876,12.98720],[77.70632,12.98720],[77.70632,12.99476],[77.69876,12.99476],[77.69876,12.98720]]]}'::jsonb, 60, 6, true, $$12h shift pattern; 6/4 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000012', 'a0000000-0000-4000-8000-00000000ea91', $$Orion Uptown$$, $$Brigade Group$$, $$Old Madras Rd, Huskur$$, $$Bengaluru$$, 13.05552, 77.76371, 'polygon', 240, '{"type":"Polygon","coordinates":[[[77.76155,13.05336],[77.76587,13.05336],[77.76587,13.05768],[77.76155,13.05768],[77.76155,13.05336]]]}'::jsonb, 60, 10, true, $$12h shift pattern; 10/4 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000013', 'a0000000-0000-4000-8000-00000000ea91', $$Holiday Inn Express & Suites, Old Madras Rd$$, $$Brigade Group$$, $$Inside Orion Uptown, Old Madras Rd$$, $$Bengaluru$$, 13.05612, 77.76441, 'radius', 110, null, 40, 4, true, $$12h shift pattern; 4/3 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000014', 'a0000000-0000-4000-8000-00000000ea91', $$Holiday Inn Express, Whitefield ITPL$$, $$IHG / Brigade$$, $$EPIP Zone, Whitefield$$, $$Bengaluru$$, 12.98635, 77.73258, 'radius', 120, null, 40, 5, true, $$12h shift pattern; 5/3 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000015', 'a0000000-0000-4000-8000-00000000ea91', $$Bagmane Tech Park — Gates 2, 5 and MLCP$$, $$Bagmane Developers$$, $$C.V. Raman Nagar$$, $$Bengaluru$$, 12.98074, 77.65675, 'polygon', 520, '{"type":"Polygon","coordinates":[[[77.65207,12.97606],[77.66143,12.97606],[77.66143,12.98542],[77.65207,12.98542],[77.65207,12.97606]]]}'::jsonb, 60, 8, true, $$8h shift pattern; 8/8/5 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000016', 'a0000000-0000-4000-8000-00000000ea91', $$Vaswani Victoria$$, $$Vaswani Group$$, $$30 Victoria Rd$$, $$Bengaluru$$, 12.96642, 77.61316, 'radius', 80, null, 40, 2, true, $$12h shift pattern; 2/1 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000017', 'a0000000-0000-4000-8000-00000000ea91', $$Virginia Mall$$, $$Virginia Mall$$, $$Whitefield Main Rd$$, $$Bengaluru$$, 12.95763, 77.7452, 'radius', 160, null, 40, 8, true, $$12h shift pattern; 8/4 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000018', 'a0000000-0000-4000-8000-00000000ea91', $$LAPP India — Jigani plant and India HQ$$, $$LAPP India$$, $$Jigani Phase II$$, $$Bengaluru$$, 12.77427, 77.63168, 'polygon', 300, '{"type":"Polygon","coordinates":[[[77.62898,12.77157],[77.63438,12.77157],[77.63438,12.77697],[77.62898,12.77697],[77.62898,12.77157]]]}'::jsonb, 60, 6, true, $$12h shift pattern; 6/4 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000019', 'a0000000-0000-4000-8000-00000000ea91', $$Nysha Mobility Tech — Dobaspet$$, $$Nysha Mobility Tech$$, $$Dobaspet Industrial Area, Nelamangala$$, $$Bengaluru$$, 13.19423, 77.25135, 'polygon', 220, '{"type":"Polygon","coordinates":[[[77.24937,13.19225],[77.25333,13.19225],[77.25333,13.19621],[77.24937,13.19621],[77.24937,13.19225]]]}'::jsonb, 60, 3, true, $$12h shift pattern; 3/2 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000020', 'a0000000-0000-4000-8000-00000000ea91', $$Indian Designs Exports$$, $$Indian Designs Exports$$, $$Nagawara Main Rd$$, $$Bengaluru$$, 13.03454, 77.62286, 'radius', 150, null, 40, 8, true, $$12h shift pattern; 8/3 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000021', 'a0000000-0000-4000-8000-00000000ea91', $$Brother International India — Bengaluru office$$, $$Brother International India$$, $$Lalbagh Main Rd$$, $$Bengaluru$$, 12.946, 77.588, 'radius', 80, null, 40, 1, true, $$12h shift pattern; 1/1 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000022', 'a0000000-0000-4000-8000-00000000ea91', $$Brother Machinery India — Tumakuru factory$$, $$Brother Machinery India$$, $$Japanese Industrial Township, Vasanthanarasapura$$, $$Tumakuru$$, 13.48518, 77.0364, 'polygon', 340, '{"type":"Polygon","coordinates":[[[77.03334,13.48212],[77.03946,13.48212],[77.03946,13.48824],[77.03334,13.48824],[77.03334,13.48212]]]}'::jsonb, 60, 5, true, $$12h shift pattern; 5/3 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000023', 'a0000000-0000-4000-8000-00000000ea91', $$Asahi Kasei India — BKC$$, $$Asahi Kasei India$$, $$The Capital, G Block, Bandra Kurla Complex$$, $$Mumbai$$, 19.06325, 72.86185, 'radius', 90, null, 40, 1, true, $$12h shift pattern; 1/1 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000024', 'a0000000-0000-4000-8000-00000000ea91', $$Brother International India — Powai head office$$, $$Brother International India$$, $$Alpha Building, Hiranandani Gardens, Powai$$, $$Mumbai$$, 19.11881, 72.91307, 'radius', 90, null, 40, 2, true, $$12h shift pattern; 2/1 on duty$$),
  ('c0000000-0000-4000-8000-0000ea000025', 'a0000000-0000-4000-8000-00000000ea91', $$Eagle Security Agency — HQ, Langford Gardens$$, $$Eagle Security Agency$$, $$Langford Gardens, Richmond Town$$, $$Bengaluru$$, 12.95998, 77.60257, 'radius', 120, null, 40, 2, true, $$12h shift pattern; 2/1 on duty$$);

-- Shift types: 12-hour sites run Day/Night; 8-hour sites run Morning/Evening/Night.
insert into public.shift_types (agency_id, site_id, name, start_time, end_time, guards_required) values
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000001', 'Day',     '08:00', '20:00', 3),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000001', 'Night',   '20:00', '08:00', 1),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000002', 'Day',     '08:00', '20:00', 4),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000002', 'Night',   '20:00', '08:00', 2),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000003', 'Day',     '08:00', '20:00', 3),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000003', 'Night',   '20:00', '08:00', 1),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000004', 'Day',     '08:00', '20:00', 3),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000004', 'Night',   '20:00', '08:00', 1),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000005', 'Morning', '06:00', '14:00', 4),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000005', 'Evening', '14:00', '22:00', 4),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000005', 'Night',   '22:00', '06:00', 2),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000006', 'Morning', '06:00', '14:00', 3),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000006', 'Evening', '14:00', '22:00', 3),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000006', 'Night',   '22:00', '06:00', 1),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000007', 'Morning', '06:00', '14:00', 2),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000007', 'Evening', '14:00', '22:00', 1),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000007', 'Night',   '22:00', '06:00', 1),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000008', 'Day',     '08:00', '20:00', 1),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000008', 'Night',   '20:00', '08:00', 1),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000009', 'Day',     '08:00', '20:00', 4),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000009', 'Night',   '20:00', '08:00', 3),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000010', 'Morning', '06:00', '14:00', 3),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000010', 'Evening', '14:00', '22:00', 3),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000010', 'Night',   '22:00', '06:00', 2),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000011', 'Day',     '08:00', '20:00', 6),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000011', 'Night',   '20:00', '08:00', 4),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000012', 'Day',     '08:00', '20:00', 10),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000012', 'Night',   '20:00', '08:00', 4),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000013', 'Day',     '08:00', '20:00', 4),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000013', 'Night',   '20:00', '08:00', 3),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000014', 'Day',     '08:00', '20:00', 5),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000014', 'Night',   '20:00', '08:00', 3),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000015', 'Morning', '06:00', '14:00', 8),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000015', 'Evening', '14:00', '22:00', 8),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000015', 'Night',   '22:00', '06:00', 5),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000016', 'Day',     '08:00', '20:00', 2),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000016', 'Night',   '20:00', '08:00', 1),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000017', 'Day',     '08:00', '20:00', 8),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000017', 'Night',   '20:00', '08:00', 4),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000018', 'Day',     '08:00', '20:00', 6),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000018', 'Night',   '20:00', '08:00', 4),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000019', 'Day',     '08:00', '20:00', 3),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000019', 'Night',   '20:00', '08:00', 2),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000020', 'Day',     '08:00', '20:00', 8),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000020', 'Night',   '20:00', '08:00', 3),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000021', 'Day',     '08:00', '20:00', 1),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000021', 'Night',   '20:00', '08:00', 1),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000022', 'Day',     '08:00', '20:00', 5),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000022', 'Night',   '20:00', '08:00', 3),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000023', 'Day',     '08:00', '20:00', 1),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000023', 'Night',   '20:00', '08:00', 1),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000024', 'Day',     '08:00', '20:00', 2),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000024', 'Night',   '20:00', '08:00', 1),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000025', 'Day',     '08:00', '20:00', 2),
  ('a0000000-0000-4000-8000-00000000ea91', 'c0000000-0000-4000-8000-0000ea000025', 'Night',   '20:00', '08:00', 1);

-- Field officers are site-scoped: East cluster, and Mumbai.
insert into public.supervisor_sites (profile_id, site_id, agency_id)
select 'b0000000-0000-4000-8000-00000000ea03', id, 'a0000000-0000-4000-8000-00000000ea91' from public.sites
where agency_id = 'a0000000-0000-4000-8000-00000000ea91' and name ~ 'Bagmane|Metropolis|Virginia|Whitefield ITPL|Orion Uptown|Old Madras Rd';
insert into public.supervisor_sites (profile_id, site_id, agency_id)
select 'b0000000-0000-4000-8000-00000000ea04', id, 'a0000000-0000-4000-8000-00000000ea91' from public.sites
where agency_id = 'a0000000-0000-4000-8000-00000000ea91' and city = 'Mumbai';

-- 5. Guards -----------------------------------------------------------------
-- One row per post, so headcount follows the duty chart rather than a guess.
create temp table eagle_site_tag (site_id uuid primary key, gunman boolean, lady boolean) on commit drop;
insert into eagle_site_tag (site_id, gunman, lady) values
  ('c0000000-0000-4000-8000-0000ea000001', true, false),
  ('c0000000-0000-4000-8000-0000ea000002', true, true),
  ('c0000000-0000-4000-8000-0000ea000003', true, false),
  ('c0000000-0000-4000-8000-0000ea000004', false, true),
  ('c0000000-0000-4000-8000-0000ea000005', false, false),
  ('c0000000-0000-4000-8000-0000ea000006', false, false),
  ('c0000000-0000-4000-8000-0000ea000007', false, false),
  ('c0000000-0000-4000-8000-0000ea000008', false, false),
  ('c0000000-0000-4000-8000-0000ea000009', false, false),
  ('c0000000-0000-4000-8000-0000ea000010', false, false),
  ('c0000000-0000-4000-8000-0000ea000011', false, false),
  ('c0000000-0000-4000-8000-0000ea000012', false, true),
  ('c0000000-0000-4000-8000-0000ea000013', false, true),
  ('c0000000-0000-4000-8000-0000ea000014', false, true),
  ('c0000000-0000-4000-8000-0000ea000015', false, false),
  ('c0000000-0000-4000-8000-0000ea000016', false, false),
  ('c0000000-0000-4000-8000-0000ea000017', false, true),
  ('c0000000-0000-4000-8000-0000ea000018', false, false),
  ('c0000000-0000-4000-8000-0000ea000019', false, false),
  ('c0000000-0000-4000-8000-0000ea000020', false, true),
  ('c0000000-0000-4000-8000-0000ea000021', false, false),
  ('c0000000-0000-4000-8000-0000ea000022', false, false),
  ('c0000000-0000-4000-8000-0000ea000023', false, false),
  ('c0000000-0000-4000-8000-0000ea000024', false, false),
  ('c0000000-0000-4000-8000-0000ea000025', false, false);

create temp table eagle_post on commit drop as
select row_number() over (order by s.name, st.start_time, slot.i) as n,
       st.site_id, st.id as shift_type_id, st.name as shift_name, slot.i as slot,
       t.gunman, t.lady
from public.shift_types st
join public.sites s on s.id = st.site_id
join eagle_site_tag t on t.site_id = st.site_id
cross join lateral generate_series(1, st.guards_required) slot(i)
where st.agency_id = 'a0000000-0000-4000-8000-00000000ea91';

-- Names drawn from Bengaluru's actual mix, with Marathi names for the Mumbai posts.
create temp table eagle_person on commit drop as
select row_number() over () as n, first_name, last_name from (
  select f.v as first_name, l.v as last_name
  from unnest(array['Ramesh','Suresh','Mahesh','Girish','Naveen','Prakash','Vinod','Santosh','Manjunath','Basavaraj',
                    'Shivakumar','Nagaraj','Venkatesh','Srinivas','Lokesh','Chandru','Yogesh','Harish','Dinesh','Rakesh',
                    'Imran','Firoz','Altaf','Rafiq','Sadiq','Tej Bahadur','Dhan Bahadur','Pemba','Lalit','Bikash',
                    'Rajendra','Mukesh','Satyendra','Devendra','Jitendra','Munna','Pintu','Chandan','Ashok','Arvind',
                    'Lakshmi','Sunita','Geetha','Shobha','Rekha','Kavitha','Mangala','Jayanthi','Nirmala','Pushpa'] ) with ordinality f(v, fi)
  cross join unnest(array['Yadav','Gowda','Reddy','Naik','Shetty','Hegde','Kamath','Rao','Murthy','Prasad',
                          'Kumar','Singh','Thapa','Rana','Pradhan','Mandal','Barman','Oraon','Paswan','Kurmi',
                          'Patil','Kulkarni','Pawar','Jadhav','Shinde','Pasha','Khan','Sharma','Mishra','Tiwari'] ) with ordinality l(v, li)
  order by (fi * 31 + li * 17) % 997, fi, li
) z;

insert into public.guards (id, agency_id, employee_code, full_name, phone, phone_verified_at, pin_hash,
  designation, site_id, supervisor_id, status, registration_selfie_path, joined_at, languages, date_of_birth)
select
  ('e0000000-0000-4000-8000-' || lpad((900000 + p.n)::text, 12, '0'))::uuid,
  'a0000000-0000-4000-8000-00000000ea91',
  'ESA-' || lpad(p.n::text, 3, '0'),
  pr.first_name || ' ' || pr.last_name,
  '98' || lpad((4000000 + p.n * 7)::text, 8, '0'),
  now() - ((case when p.n % 19 = 0 then 8 + (p.n % 18) else 120 + p.n * 3 end) || ' days')::interval,
  extensions.crypt('1234', extensions.gen_salt('bf')),
  case
    when p.gunman and p.slot = 2 then 'Gunman'
    when p.lady and p.slot = 3 then 'Lady Guard'
    when p.slot = 1 then 'Head Guard'
    when p.shift_name = 'Night' then 'Night Guard'
    when p.slot % 3 = 0 then 'Patrol Guard'
    else 'Gate Guard'
  end,
  p.site_id,
  case when sc.profile_id is not null then sc.profile_id else 'b0000000-0000-4000-8000-00000000ea02' end,
  'active',
  'a0000000-0000-4000-8000-00000000ea91/selfies/reg/ESA-' || lpad(p.n::text, 3, '0') || '.jpg',
  now() - ((case when p.n % 19 = 0 then 8 + (p.n % 18) else 120 + p.n * 3 end) || ' days')::interval,
  case when s.city = 'Mumbai' then '{mr,hi}'::text[] else (array['{kn,hi}','{hi}','{kn,en}','{te,kn}','{ta,kn}','{ne,hi}'])[1 + p.n % 6]::text[] end,
  (date '1975-01-01' + (((p.n * 137) % 8400))::int)::date
from eagle_post p
join eagle_person pr on pr.n = p.n
join public.sites s on s.id = p.site_id
left join public.supervisor_sites sc on sc.site_id = p.site_id;

-- Relievers: the bench that covers a no-show, at about one per six posts. No roster
-- pattern, which is exactly why they show as available when a post goes unmanned.
insert into public.guards (id, agency_id, employee_code, full_name, phone, phone_verified_at, pin_hash,
  designation, site_id, supervisor_id, status, registration_selfie_path, joined_at, languages, date_of_birth)
select
  ('e0000000-0000-4000-8000-' || lpad((950000 + i)::text, 12, '0'))::uuid,
  'a0000000-0000-4000-8000-00000000ea91', 'ESA-R' || lpad(i::text, 2, '0'),
  pr.first_name || ' ' || pr.last_name,
  '98' || lpad((5000000 + i * 11)::text, 8, '0'),
  now() - ((20 + i) || ' days')::interval,
  extensions.crypt('1234', extensions.gen_salt('bf')),
  'Reliever', null, 'b0000000-0000-4000-8000-00000000ea02', 'active',
  'a0000000-0000-4000-8000-00000000ea91/selfies/reg/ESA-R' || lpad(i::text, 2, '0') || '.jpg',
  now() - ((60 + i * 9) || ' days')::interval, '{hi}'::text[],
  (date '1980-01-01' + (((i * 211) % 6500))::int)::date
from generate_series(1, 29) i
join eagle_person pr on pr.n = 200 + i;

insert into public.leave_balances (guard_id, agency_id, year)
select id, agency_id, extract(year from now())::int from public.guards where agency_id = 'a0000000-0000-4000-8000-00000000ea91';

-- 6. KYC, training and arms licences ---------------------------------------
-- Aadhaar and police verification for everyone; the most recent joiners are still
-- waiting on verification, which is what blocks them from being rostered.
insert into public.guard_documents (agency_id, guard_id, type, file_path, mime_type, number_masked,
  status, verified_by, verified_at, uploaded_by, issued_on)
select 'a0000000-0000-4000-8000-00000000ea91', g.id, t.type,
  'a0000000-0000-4000-8000-00000000ea91/kyc/' || g.employee_code || '/' || t.type || '.jpg', 'image/jpeg',
  case t.type
    when 'aadhaar' then 'XXXX XXXX ' || lpad((1000 + (random() * 8999)::int)::text, 4, '0')
    when 'pan' then 'XXXXX' || lpad((1000 + (random() * 8999)::int)::text, 4, '0') || 'X'
  end,
  (case when g.joined_at > now() - interval '45 days' and t.type = 'police_verification'
        then 'pending' else 'verified' end)::public.document_status,
  'b0000000-0000-4000-8000-00000000ea01', g.joined_at + interval '3 days',
  'b0000000-0000-4000-8000-00000000ea01', (g.joined_at - interval '500 days')::date
from public.guards g
cross join (values ('aadhaar'::public.document_type), ('pan'), ('police_verification'), ('guard_kyc')) as t(type)
where g.agency_id = 'a0000000-0000-4000-8000-00000000ea91';

-- Arms licences for the ex-servicemen gunmen at the jewellers. There is no
-- `arms_licence` document type yet, so they ride on `other` with an expiry date.
-- One is deliberately 12 days from lapsing: that guard cannot legally stand an
-- armed post past it, and nothing in Eagle's current process would surface it.
insert into public.guard_documents (agency_id, guard_id, type, file_path, mime_type, number_masked,
  status, verified_by, verified_at, uploaded_by, issued_on, expires_on)
select 'a0000000-0000-4000-8000-00000000ea91', g.id, 'other',
  'a0000000-0000-4000-8000-00000000ea91/kyc/' || g.employee_code || '/arms-licence.jpg', 'image/jpeg',
  'ARMS/KA/' || lpad((1000 + row_number() over (order by g.employee_code))::text, 5, '0'),
  'verified', 'b0000000-0000-4000-8000-00000000ea01', g.joined_at + interval '3 days',
  'b0000000-0000-4000-8000-00000000ea01',
  (now() - interval '3 years')::date,
  case when s.name like 'Bhima%Malleshwaram%' then (current_date + 12)
       else (current_date + (200 + (row_number() over (order by g.employee_code)) * 37)::int) end
from public.guards g
join public.sites s on s.id = g.site_id
where g.agency_id = 'a0000000-0000-4000-8000-00000000ea91' and g.designation = 'Gunman';

-- 7. Patrol routes. These must exist before the history is simulated, because the
--    rounds and their photos are generated from them.
insert into public.patrol_routes (agency_id, site_id, name, description, frequency_min, grace_min, min_photos, created_by)
select 'a0000000-0000-4000-8000-00000000ea91', s.id, r.name, r.descr, r.freq, r.grace, r.photos,
  'b0000000-0000-4000-8000-00000000ea01'
from public.sites s
join (values
  ('C. Krishniah Chetty%',  'Strong-room and shutter check', 'Strong room, display shutters, staff entry and the rear lane', 120, 15, 2),
  ('Bhima Jewellers, Jay%', 'Showroom round',                'Floor, strong room, rear exit and the ATM lobby',             120, 15, 2),
  ('Bhima Jewellers, Mal%', 'Showroom round',                'Floor, strong room and the rear exit',                        120, 15, 1),
  ('Consulate%',            'Perimeter and visa hall',       'Visa windows, consular floor, lift lobby and the fire exits',   90, 10, 1),
  ('Brigade Metropolis%',   'Block and basement round',      'All towers, both basements, clubhouse and the rear service gate', 120, 15, 1),
  ('Orion Uptown%',         'Concourse round',               'Ground to second concourse, atrium, food court and fire exits',  90, 15, 2),
  ('Holiday Inn Express, Whitefield%', 'Floor and back-of-house round', 'Guest floors, kitchen, laundry and the staff entry', 120, 15, 1),
  ('Holiday Inn Express & Suites%',    'Floor round',                   'Guest floors, lobby and the mall interconnect door', 120, 15, 1),
  ('Bagmane Tech Park%',    'Checkpoint patrol',             'Gates 2 and 5, MLCP levels, transformer yard and fire exits',    60, 10, 2),
  ('Virginia Mall%',        'Closing sweep',                 'All floors, washrooms, service corridor and the shutters',      120, 15, 1),
  ('LAPP India%',           'Perimeter and copper store',    'Fence line, copper store, despatch dock and the weighbridge',    60, 10, 2),
  ('Nysha Mobility%',       'Night perimeter',               'Fence line, cable yard, DG room and the back gate',              90, 15, 2),
  ('BPL Medical Technologies — Jigani%', 'Plant round',      'Material gate, electronics store, ETP and the fence line',       90, 15, 1),
  ('Brother Machinery%',    'Perimeter round',               'Fence line, machine bay shutters, scrap yard and the main gate',  90, 15, 1),
  ('Indian Designs%',       'Floor and exit round',          'Cutting floor, finishing, exit frisking point and the fire exits',120, 15, 1),
  ('Brigade Group — HQ%',   'Tower round',                   'Lobby, basements, terrace doors and the fire exits',             120, 15, 1),
  ('Eagle Security Agency — HQ%', 'Office round',            'Reception, both floors, records room, parking and the rear gate', 120, 15, 1)
) as r(pat, name, descr, freq, grace, photos) on s.name like r.pat
where s.agency_id = 'a0000000-0000-4000-8000-00000000ea91';

-- 8. Roster: one pattern per post, then materialise a fortnight back and a week ahead.
insert into public.roster_patterns (agency_id, site_id, guard_id, shift_type_id, weekdays, starts_on, created_by)
select 'a0000000-0000-4000-8000-00000000ea91', p.site_id,
  ('e0000000-0000-4000-8000-' || lpad((900000 + p.n)::text, 12, '0'))::uuid,
  p.shift_type_id,
  case when p.shift_name = 'Night' then '{0,1,2,3,4,5,6}'::int[] else '{1,2,3,4,5,6}'::int[] end,
  current_date - 21,
  'b0000000-0000-4000-8000-00000000ea01'
from eagle_post p
-- The newest joiners are not rostered: police verification is still pending.
where not exists (
  select 1 from public.guards g
  join public.guard_documents d on d.guard_id = g.id and d.type = 'police_verification' and d.status = 'pending'
  where g.id = ('e0000000-0000-4000-8000-' || lpad((900000 + p.n)::text, 12, '0'))::uuid
);

select public.materialize_roster('a0000000-0000-4000-8000-00000000ea91', current_date - 14, current_date + 7);

-- 9. The history: check-ins, breadcrumbs, fence exits, rounds and the events feed.
select public.simulate_agency_history('a0000000-0000-4000-8000-00000000ea91');

commit;

-- ---------------------------------------------------------------------------
-- 10. The story. These run after the simulation, because each one bends a
--     generated row into the specific thing the demo talks about.
-- ---------------------------------------------------------------------------
begin;

-- The Verint 06:00 post went unmanned. The rostered guard never came, a reliever was
-- assigned at 06:12 and reached the gate at 06:40. Those 40 minutes are the deduction
-- line on Verint's bill, and the argument Eagle currently has to win by phone.
do $$
declare
  v_ag uuid := 'a0000000-0000-4000-8000-00000000ea91';
  v_site uuid;
  v_shift record;
  v_reliever uuid;
  v_start timestamptz;
begin
  select id into v_site from public.sites where agency_id = v_ag and name like 'Verint%';
  select * into v_shift from public.shifts
  where agency_id = v_ag and site_id = v_site and shift_date = (now() at time zone 'Asia/Kolkata')::date
  order by scheduled_start limit 1;
  if v_shift.id is null then return; end if;

  -- Put the post back to "nobody came".
  delete from public.location_pings where shift_id = v_shift.id;
  delete from public.guard_presence where shift_id = v_shift.id;
  delete from public.patrols where shift_id = v_shift.id;
  delete from public.events where shift_id = v_shift.id;
  update public.shifts set status = 'absent', attendance = 'absent', started_at = null,
    start_selfie_path = null, start_lat = null, start_lng = null, start_in_fence = null,
    worked_minutes = 0, late_by_min = 0, away_seconds = 0, location_off_seconds = 0,
    trust = 'clean', flags = '{}', exception_id = null
  where id = v_shift.id;

  v_start := v_shift.scheduled_start;
  insert into public.events (agency_id, site_id, guard_id, shift_id, type, severity, title, payload, created_at)
  values (v_ag, v_site, v_shift.guard_id, v_shift.id, 'LATE_START', 'warn',
    (select full_name from public.guards where id = v_shift.guard_id) || ' has not started the shift',
    jsonb_build_object('body', 'Scheduled ' || to_char(v_start at time zone 'Asia/Kolkata', 'HH24:MI')), v_start + interval '12 minutes'),
   (v_ag, v_site, v_shift.guard_id, v_shift.id, 'STAFFING_GAP', 'critical',
    'Verint 06:00 post unmanned', jsonb_build_object('body', 'Reliever assigned 06:12, reached the gate 06:40'), v_start + interval '12 minutes');

  -- The reliever's own shift, checked in 40 minutes late.
  select id into v_reliever from public.guards where agency_id = v_ag and designation = 'Reliever' order by employee_code limit 1;
  insert into public.shifts (agency_id, site_id, guard_id, shift_type_id, shift_date, scheduled_start, scheduled_end,
    started_at, start_captured_at, start_selfie_path, start_lat, start_lng, start_in_fence, start_distance_m,
    status, attendance, trust, flags, late_by_min, worked_minutes)
  select v_ag, v_site, v_reliever, v_shift.shift_type_id, v_shift.shift_date, v_start, v_shift.scheduled_end,
    v_start + interval '40 minutes', v_start + interval '40 minutes',
    v_ag || '/selfies/relief/' || v_shift.id || '.jpg', s.lat, s.lng, true, 18,
    'in_progress', 'pending', 'clean', '{LATE_START}', 40, 0
  from public.sites s where s.id = v_site;
end $$;

-- 02:40: the Industrial North-West officer's night check found the Nysha guard asleep.
-- Logged as an exception against the shift, which is the record Eagle has no way to keep today.
do $$
declare
  v_ag uuid := 'a0000000-0000-4000-8000-00000000ea91';
  v_shift record; v_ex uuid;
begin
  select sh.*, s.id as sid into v_shift
  from public.shifts sh join public.sites s on s.id = sh.site_id
  where sh.agency_id = v_ag and s.name like 'Nysha%' and sh.status = 'completed'
    and sh.scheduled_start < now() - interval '12 hours'
  order by sh.scheduled_start desc limit 1;
  if v_shift.id is null then return; end if;

  insert into public.shift_exceptions (agency_id, shift_id, logged_by, reason, category)
  values (v_ag, v_shift.id, 'b0000000-0000-4000-8000-00000000ea02',
    'Night check at 02:40: guard found asleep in the gate cabin. Woken, warned, and briefed on the cable-yard round. Site manager informed in the morning.',
    'other')
  returning id into v_ex;

  update public.shifts set exception_id = v_ex, trust = 'flagged',
    flags = array(select distinct unnest(coalesce(flags, '{}') || '{EXCEPTION_LOGGED}'))
  where id = v_shift.id;

  insert into public.events (agency_id, site_id, guard_id, shift_id, type, severity, title, payload, created_at)
  values (v_ag, v_shift.sid, v_shift.guard_id, v_shift.id, 'EXCEPTION_LOGGED', 'critical',
    'Night check: guard found asleep at Nysha Dobaspet',
    jsonb_build_object('body', 'Logged by Latha Srinivasan on the 02:40 night check'),
    date_trunc('day', now()) - interval '21 hours 20 minutes');
end $$;

-- The CKC opening checklist, completed at 10:00 with two staff names on it. Opening
-- and closing the strong room is an insurance condition, not a nicety.
insert into public.task_templates (agency_id, key, title, description, photo_required) values
  ('a0000000-0000-4000-8000-00000000ea91', 'eagle_strongroom_open', 'Strong-room opening', 'Two-person opening: seals checked, shutters up, alarm disarmed, both names recorded', true),
  ('a0000000-0000-4000-8000-00000000ea91', 'eagle_closing_sweep',   'Closing sweep',       'All floors, washrooms and service corridors cleared, shutters down', true)
on conflict do nothing;

insert into public.tasks (agency_id, site_id, template_id, title, description, due_at, photo_required, status, created_by)
select 'a0000000-0000-4000-8000-00000000ea91', s.id,
  (select id from public.task_templates where key = 'eagle_strongroom_open'),
  'Strong-room opening', 'Two-person opening with H. Sridhar (CKC staff) and our head guard; seals intact, alarm disarmed 09:58',
  (current_date + time '10:00') at time zone 'Asia/Kolkata', true, 'done', 'b0000000-0000-4000-8000-00000000ea01'
from public.sites s where s.agency_id = 'a0000000-0000-4000-8000-00000000ea91' and s.name like 'C. Krishniah Chetty%';

insert into public.tasks (agency_id, site_id, template_id, title, description, due_at, photo_required, status, created_by)
select 'a0000000-0000-4000-8000-00000000ea91', s.id,
  (select id from public.task_templates where key = 'eagle_closing_sweep'),
  'Closing sweep', 'Mall closes 23:00; sweep all floors and confirm shutters',
  (current_date - 1 + time '23:00') at time zone 'Asia/Kolkata', true, 'done', 'b0000000-0000-4000-8000-00000000ea01'
from public.sites s where s.agency_id = 'a0000000-0000-4000-8000-00000000ea91' and s.name like 'Virginia Mall%';

-- Two leave requests waiting on a decision. The Orion one clashes with a weekend the
-- mall is already short-staffed for, which is the trade-off the roster screen shows.
insert into public.leave_requests (agency_id, guard_id, site_id, type, start_date, end_date, reason, status, created_at)
select 'a0000000-0000-4000-8000-00000000ea91', g.id, g.site_id, 'casual',
  current_date + 2, current_date + 3, 'Sister''s wedding in Hassan', 'pending', now() - interval '6 hours'
from public.guards g join public.sites s on s.id = g.site_id
where g.agency_id = 'a0000000-0000-4000-8000-00000000ea91' and s.name like 'Orion Uptown%'
order by g.employee_code limit 1;

insert into public.leave_requests (agency_id, guard_id, site_id, type, start_date, end_date, reason, status, created_at)
select 'a0000000-0000-4000-8000-00000000ea91', g.id, g.site_id, 'earned',
  current_date + 5, current_date + 11, 'Going home to Gorakhpur for the harvest', 'pending', now() - interval '2 days'
from public.guards g join public.sites s on s.id = g.site_id
where g.agency_id = 'a0000000-0000-4000-8000-00000000ea91' and s.name like 'Bagmane%'
order by g.employee_code limit 1;

commit;

-- ---------------------------------------------------------------------------
-- 11. Patrol compliance.
--
-- The simulation's per-round miss rate suits a four-site demo but reads as a
-- catastrophe across ten thousand rounds, and it drowns the two misses the demo
-- actually talks about. Set the proportions deliberately instead: about 2% missed and
-- 8% late, which is what a well-run manual agency looks like, bucketed on a hash of
-- the round id so a re-run lands the same way. LAPP stays spotless as the contrast
-- case, and the Metropolis 02:00 round is re-asserted afterwards because this pass
-- owns every patrol status and would otherwise close it.
-- ---------------------------------------------------------------------------
begin;

do $$
declare
  v_ag uuid := 'a0000000-0000-4000-8000-00000000ea91';
begin
  update public.patrols p
  set status = v.want,
      started_at = case when v.want = 'missed' then null
                        else p.expected_at + make_interval(mins => (v.bucket % 9)) end,
      ended_at   = case when v.want = 'missed' then null
                        else p.expected_at + make_interval(mins => 13 + (v.bucket % 11)) end
  from (
    select pt.id,
           abs(hashtext(pt.id::text)) % 100 as bucket,
           case
             when s.name like 'LAPP India%' then 'completed'
             when abs(hashtext(pt.id::text)) % 100 < 2  then 'missed'
             when abs(hashtext(pt.id::text)) % 100 < 10 then 'late'
             else 'completed'
           end::public.patrol_status as want
    from public.patrols pt
    join public.sites s on s.id = pt.site_id
    where pt.agency_id = v_ag and pt.expected_at < now()
  ) v
  where v.id = p.id and p.status <> v.want;

  -- Rounds still ahead of the clock are simply scheduled.
  update public.patrols set status = 'scheduled', started_at = null, ended_at = null
  where agency_id = v_ag and expected_at >= now() and status <> 'scheduled';

  -- Photos only make sense on a round that was actually walked.
  delete from public.patrol_photos ph
  using public.patrols p
  where ph.patrol_id = p.id and p.agency_id = v_ag and p.status in ('missed', 'scheduled');

  -- And the missed-round alerts must match what the board now shows.
  delete from public.events e
  where e.agency_id = v_ag and e.type = 'PATROL_MISSED'
    and not exists (
      select 1 from public.patrols p
      where p.id = (e.payload->>'patrol_id')::uuid and p.status = 'missed'
    );

  insert into public.events (agency_id, site_id, guard_id, shift_id, type, severity, title, payload, created_at)
  select v_ag, p.site_id, p.guard_id, p.shift_id, 'PATROL_MISSED', 'warn',
    g.full_name || ' missed patrol ' || r.name,
    jsonb_build_object('patrol_id', p.id), p.expected_at + make_interval(mins => r.grace_min * 2)
  from public.patrols p
  join public.patrol_routes r on r.id = p.route_id
  join public.guards g on g.id = p.guard_id
  where p.agency_id = v_ag and p.status = 'missed'
    and not exists (
      select 1 from public.events e
      where e.agency_id = v_ag and e.type = 'PATROL_MISSED' and (e.payload->>'patrol_id')::uuid = p.id
    );
end $$;

-- 02:00 at Brigade Metropolis: the round the client will ask about. Re-asserted here,
-- after the compliance pass, so it survives a re-run.
do $$
declare
  v_ag uuid := 'a0000000-0000-4000-8000-00000000ea91';
  v_p record;
begin
  select p.* into v_p
  from public.patrols p join public.sites s on s.id = p.site_id
  where p.agency_id = v_ag and s.name like 'Brigade Metropolis%' and p.expected_at < now() - interval '6 hours'
  order by abs(extract(epoch from (p.expected_at - (date_trunc('day', p.expected_at) + interval '2 hours')))) asc
  limit 1;
  if v_p.id is null then return; end if;

  update public.patrols set status = 'missed', started_at = null, ended_at = null where id = v_p.id;
  delete from public.patrol_photos where patrol_id = v_p.id;
  delete from public.events
  where agency_id = v_ag and type = 'PATROL_MISSED' and (payload->>'patrol_id')::uuid = v_p.id;

  insert into public.events (agency_id, site_id, guard_id, shift_id, type, severity, title, payload, created_at)
  values (v_ag, v_p.site_id, v_p.guard_id, v_p.shift_id, 'PATROL_MISSED', 'warn',
    'Missed 02:00 block round at Brigade Metropolis',
    jsonb_build_object('patrol_id', v_p.id, 'body', 'Guard was 400 m outside the fence for 25 minutes'),
    v_p.expected_at + interval '30 minutes');
end $$;

commit;

-- ---------------------------------------------------------------------------
-- 12. Incidents. Human-written narratives, each pinned to a guard who was actually
--     on that post at that hour, and to a wall-clock time rather than an offset from
--     now() so a re-run at any hour still reads correctly.
-- ---------------------------------------------------------------------------
begin;

do $$
declare
  v_ag uuid := 'a0000000-0000-4000-8000-00000000ea91';
  r record;
  v_site record;
  v_guard uuid;
  v_at timestamptz;
begin
  delete from public.incidents where agency_id = v_ag;

  for r in
    select * from (values
      ('Holiday Inn Express, Whitefield%', 'altercation_with_client', 'moderate', 'resolved', 1, '22:15',
       'Guest dispute at the lobby desk',
       'A guest checking in at 22:15 became loud with the front-desk staff over a room category and refused to step aside from the queue. Our guard stood by, did not touch him, and called the duty manager, who moved the conversation to the back office and upgraded the room. No police involvement. IHG''s brand standard is that security does not escalate with guests, and that is what happened.',
       'Duty manager recorded it in the hotel''s own log and thanked the guard for not intervening physically. We have added the lobby queue to the evening briefing.'),

      ('Bhima Jewellers, Jay%', 'trespass', 'high', 'investigating', 1, '19:40',
       'Two men circling the showroom on a bike without plates',
       'Between 19:25 and 19:40 the same two men on a bike with no number plate passed the showroom front four times, slowing at the shutter each time and looking at the camera positions. Our gunman and the head guard moved to the door, the gunman stayed visible, and the shutter was brought halfway down fifteen minutes before closing. They did not return. Photo taken from the door camera position; the bike is a dark Pulsar with a damaged right mirror.',
       null),

      ('LAPP India%', 'theft', 'high', 'investigating', 1, '17:10',
       'Copper scrap gate pass short by 180 kg against the weighbridge',
       'The despatch gate pass for scrap copper read 1,240 kg. The weighbridge ticket for the same lorry read 1,420 kg. Our guard at the material gate held the vehicle, called the stores in-charge and the shift engineer, and did not let it leave. The driver said the pass was written before the last two drums were loaded. Both tickets are attached. Copper is the only thing on this site worth stealing in quantity, and the gap is 180 kg of it.',
       null),

      ('Bagmane Tech Park%', 'medical', 'moderate', 'resolved', 1, '15:30',
       'Contractor collapsed on MLCP level 3',
       'A painting contractor working on MLCP level 3 collapsed at about 15:30 in the afternoon heat. Our patrol guard reached him within two minutes of the radio call, moved him into shade, raised his legs and sent for water while the control room called the park''s medical room and 108. The park nurse arrived in six minutes; the ambulance in fourteen. He was conscious throughout and was taken in for observation.',
       'Park facilities logged it as correctly handled. Two of our guards on the MLCP beat are booked onto the next first-aid refresher, and we have asked the park for a shaded rest point on level 3.'),

      ('Consulate%', 'unauthorised_vehicle', 'low', 'resolved', 2, '11:20',
       'Van parked across the consular entrance during the visa window',
       'A courier van stopped across the consular entrance at 11:20, in the middle of the morning visa window, and the driver left it to make a delivery two doors away. With a queue of applicants on the pavement this blocks the only accessible approach. Our guard logged the registration, found the driver and had it moved in six minutes.',
       'Reported to the building manager, who has written to the tenant. We now log any vehicle stopping in the entrance bay during visa hours.'),

      ('Indian Designs%', 'theft', 'moderate', 'resolved', 4, '18:05',
       'Finished garments found in a worker''s bag at exit frisking',
       'At the evening exit frisking point one of our lady searchers found four finished shirts, tags still on, in a worker''s personal bag. The worker said she meant to return them. HR and the floor supervisor were called to the gate and the garments were booked back into finishing the same evening.',
       'The client''s HR ran its own enquiry and issued a warning letter. Buyer audits ask specifically whether exit frisking is manned by a searcher of the same sex on every shift, and this is the record that it is.')
    ) as t(site_pat, itype, sev, st, days_ago, at_time, title, body, resolution)
  loop
    select * into v_site from public.sites where agency_id = v_ag and name like r.site_pat limit 1;
    continue when v_site.id is null;

    v_at := ((current_date - r.days_ago) + r.at_time::time) at time zone 'Asia/Kolkata';

    -- Whoever was actually standing that post at that hour.
    select sh.guard_id into v_guard from public.shifts sh
    where sh.agency_id = v_ag and sh.site_id = v_site.id
      and sh.scheduled_start <= v_at and sh.scheduled_end >= v_at
    order by sh.scheduled_start desc limit 1;
    if v_guard is null then
      select id into v_guard from public.guards
      where agency_id = v_ag and site_id = v_site.id and status = 'active' limit 1;
    end if;

    insert into public.incidents (agency_id, site_id, type, severity, title, description, occurred_at,
      reported_by, guard_id, lat, lng, status, resolution, resolved_at, resolved_by)
    values (v_ag, v_site.id, r.itype::public.incident_type, r.sev::public.incident_severity,
      r.title, r.body, v_at, 'b0000000-0000-4000-8000-00000000ea02', v_guard,
      v_site.lat + (random() - 0.5) * 0.0014, v_site.lng + (random() - 0.5) * 0.0014,
      r.st::public.incident_status, r.resolution,
      case when r.st = 'resolved' then v_at + interval '16 hours' end,
      case when r.st = 'resolved' then 'b0000000-0000-4000-8000-00000000ea01'::uuid end);
  end loop;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- 13. The demo phone. One guard on the Eagle HQ day post carries the test number
--     so the app can be claimed live in the meeting room: sign in with the OTP, set
--     a PIN, check in against the HQ fence, walk a round, raise an incident.
--
--     Left deliberately unclaimed — no verified phone, no PIN, no profile — because
--     the first-run flow is the thing worth showing. `normalize_phone` keeps the last
--     ten digits, so +91 90000 00001 and 9000000001 are the same guard.
-- ---------------------------------------------------------------------------
begin;

update public.guards g
set phone = '9000000001',
    phone_verified_at = null,
    pin_hash = null,
    profile_id = null,
    full_name = 'Ravi Shankar',
    designation = 'Head Guard'
where g.id = (
  select g2.id from public.guards g2
  join public.sites s on s.id = g2.site_id
  where g2.agency_id = 'a0000000-0000-4000-8000-00000000ea91'
    and s.name like 'Eagle Security Agency — HQ%'
  order by g2.employee_code
  limit 1
);

commit;

-- Put the demo guard's own shift back to "not started". simulate_agency_history has
-- already walked every past shift, including this one, so without this the app opens
-- on "End shift" and the check-in beat cannot be shown.
do $$
declare
  v_ag uuid := 'a0000000-0000-4000-8000-00000000ea91';
  v_guard uuid;
  v_shift uuid;
  v_task uuid;
begin
  select id into v_guard from public.guards where agency_id = v_ag and phone = '9000000001';
  if v_guard is null then return; end if;

  select id into v_shift from public.shifts
  where agency_id = v_ag and guard_id = v_guard
    and shift_date = (now() at time zone 'Asia/Kolkata')::date
  order by scheduled_start limit 1;
  if v_shift is null then return; end if;

  delete from public.location_pings where shift_id = v_shift;
  delete from public.guard_presence where shift_id = v_shift;
  delete from public.patrol_photos where patrol_id in (select id from public.patrols where shift_id = v_shift);
  delete from public.patrols where shift_id = v_shift;
  delete from public.events where shift_id = v_shift;

  update public.shifts set
    status = 'scheduled', attendance = 'pending',
    started_at = null, start_captured_at = null, start_selfie_path = null,
    start_lat = null, start_lng = null, start_accuracy_m = null,
    start_in_fence = null, start_distance_m = null,
    ended_at = null, end_captured_at = null, end_selfie_path = null,
    end_lat = null, end_lng = null, end_in_fence = null,
    worked_minutes = 0, late_by_min = 0, away_seconds = 0, location_off_seconds = 0,
    trust = 'clean', flags = '{}', exception_id = null
  where id = v_shift;

  -- And one task waiting on him, so the phone has something to do besides check in.
  insert into public.tasks (agency_id, site_id, template_id, title, description, due_at, photo_required, status, created_by)
  select v_ag, s.id, null,
    'Visitor register check',
    'Confirm every visitor entry since the morning has an out-time and a vehicle number',
    (current_date + time '17:00') at time zone 'Asia/Kolkata', true, 'pending',
    'b0000000-0000-4000-8000-00000000ea02'
  from public.sites s where s.agency_id = v_ag and s.name like 'Eagle Security Agency — HQ%'
  returning id into v_task;

  insert into public.task_assignments (task_id, guard_id, agency_id, status)
  values (v_task, v_guard, v_ag, 'pending');
end $$;

commit;

-- ---------------------------------------------------------------------------
-- 14. Pay and next of kin. An agency cannot run a salary off a name and a phone
--     number: it needs a bank account to credit, an IFSC to route it, a UAN for the
--     PF return and an ESIC number for the half-yearly. And when a guard is hurt on a
--     night shift, somebody has to be called.
--
--     Account numbers are masked to the last four digits on purpose — enough to
--     reconcile a payout against a payslip, without putting a payable account number
--     in front of every manager who can read the guard list.
-- ---------------------------------------------------------------------------
begin;

update public.guards g set
  bank_name = (array['State Bank of India','Canara Bank','Union Bank of India','Karnataka Bank','Bank of Baroda','Kotak Mahindra Bank'])[1 + (abs(hashtext(g.id::text)) % 6)],
  bank_account_masked = 'XXXXXX' || lpad((abs(hashtext(g.id::text || 'acct')) % 10000)::text, 4, '0'),
  bank_ifsc = (array['SBIN0005678','CNRB0002341','UBIN0809128','KARB0000412','BARB0BANGLR','KKBK0008051'])[1 + (abs(hashtext(g.id::text)) % 6)],
  uan = '10' || lpad((abs(hashtext(g.id::text || 'uan')) % 1000000000)::text, 10, '0'),
  esic_ip = '31' || lpad((abs(hashtext(g.id::text || 'esic')) % 100000000)::text, 9, '0'),
  -- Relation and name have to agree, or the first person to read it stops trusting
  -- everything else on the screen. The relations are all ones that say nothing about
  -- the guard's own gender, which we do not record — "Wife" on a woman's record is
  -- exactly the kind of detail that makes a demo look generated.
  emergency_contact = (
    case when abs(hashtext(g.id::text || 'rel')) % 2 = 0
      then (array['Mother','Sister','Daughter'])[1 + (abs(hashtext(g.id::text || 'rel')) % 3)]
        || ' · ' || (array['Sunita','Kamala','Radha','Manju','Shanti','Girija'])[1 + (abs(hashtext(g.id::text || 'kin')) % 6)]
      else (array['Father','Brother','Son'])[1 + (abs(hashtext(g.id::text || 'rel')) % 3)]
        || ' · ' || (array['Ramesh','Mohan','Suresh','Anil','Dinesh','Prakash'])[1 + (abs(hashtext(g.id::text || 'kin')) % 6)]
    end)
    || ' · +91 ' || (array['98450','99860','80956','73494','94480'])[1 + (abs(hashtext(g.id::text || 'kinp')) % 5)]
    || ' ' || lpad((abs(hashtext(g.id::text || 'kinn')) % 100000)::text, 5, '0'),
  address = (array['Room 4','No. 12','No. 7','Plot 23','Door 9'])[1 + (abs(hashtext(g.id::text || 'ad')) % 5)]
    || ', ' || (array['Ejipura','Kadugondanahalli','Byatarayanapura','Sudduguntepalya','Lingarajapuram','Hongasandra','Kodigehalli','Marathahalli Bridge'])[1 + (abs(hashtext(g.id::text || 'loc')) % 8)]
    || ', Bengaluru ' || (array['560047','560045','560092','560029','560084','560068','560097','560037'])[1 + (abs(hashtext(g.id::text || 'pin')) % 8)]
where g.agency_id = 'a0000000-0000-4000-8000-00000000ea91';

commit;
