# Eagle Security Agency demo plan

*Written 8 Oct 2026. Demo: today. Runs on the deployed site (cloud Supabase), with the guard phone app included.*
*Research behind this plan: `research_notes/eagle/` (company, client sites, security ops). Facts there carry sources; anything marked "inferred" here is our judgement.*

---

## 1. Goal

Show Eagle's MD their own business running on GuardWatch AI: their real clients as sites, a believable guard roster, last night's events, this morning's attendance, and the money side. The demo should answer "would this fix what hurts us?" in 10–12 minutes, not walk through every screen.

## 2. Who we are pitching

| | |
|---|---|
| Company | Eagle Security Agency Pvt Ltd (formerly Eagle Detective Agency). Incorporated 1989; the site says "since 1979" |
| People | MD **Tharun Thimmaiah** (second generation). Directors Mala Annaiah, Tulika Thimmaiah. Founder M.M. Annaiah named as Chairman |
| HQ | Langford Gardens / Richmond Town, Bengaluru (~12.95998, 77.60257) |
| Size | "200+ clients"; revenue band ₹10–25 cr (FY23, a loss year); about 33 office staff on LinkedIn; guard headcount not published |
| Operations | Manual supervision ("day/night checks by Managers and Field Executives"); a Field Officer layer; 8 h and 12 h shifts; 21-day recruit training; two training centres |
| Tech | None seen. Dated website; ISO certificate expired 2020; no PSARA licence number published |
| Pay | Pays at least the minimum wage (confirmed by us) |

**What will land with them (inferred):**
1. **Margin.** The Karnataka minimum-wage notice of 22 May 2026 raised a Bengaluru guard's floor from ₹18,997 to ₹25,714 a month (unskilled). Since Eagle pays the minimum, their wage bill just jumped, and every contract priced at the old wage is underwater until re-priced. Gross pay above ₹21k also takes guards out of ESI, and above ₹25k they now pay professional tax.
2. **Proof of service.** Clients pay 60–90 days late and dispute bills over unmanned posts. Timestamped attendance, patrols and reports end the arguments.
3. **Supervision at a distance.** Their outskirts sites (Jigani, Dobaspet, Tumakuru, and Mumbai) are where manual night checks cost the most.
4. **Compliance.** PSARA rules (1 supervisor per 15 guards, 160 training hours, electronic registers), arms-licence expiry, police verification.

## 3. The client roster in the demo

Real client names throughout. R-Logic is dropped (not identified). Coordinates marked ~ are street or area centre points: pin them to the actual gate before drawing fences.

### Bengaluru

| # | Client / site | Location (lat, lng) | Type | Shift pattern | On duty (day / night) | What's specific | Story event (§4) |
|---|---|---|---|---|---|---|---|
| 1 | **C. Krishniah Chetty & Sons**, The Touchstone | 3A Main Guard Cross Rd (12.98075, 77.60734) | Jewellery flagship | 12 h | 3 incl. gunman / 1 | Opening and closing need two staff signatures; night guard is an insurance condition | Opening checklist done 10:00 |
| 2 | **Bhima Jewellers**, Jayanagar 4th Block | 33rd Cross (~12.92629, 77.58601) | Jewellery | 12 h | 4 incl. gunman / 2 | Armed door guard; festive-season crowds | Suspicious bikers circling, 19:40 |
| 3 | **Bhima Jewellers**, Malleshwaram | Sampige Rd (~13.00392, 77.57125) | Jewellery | 12 h | 3 incl. gunman / 1 | Same as above | Gunman's arms licence expires in 12 days |
| 4 | **Consulate-General of Japan** | 1st floor, Prestige Nebula, Cubbon Rd (12.98234, 77.59684) | Diplomatic mission | 12 h | 3 incl. lady searcher / 1 | Police handle outer security; visa windows 08:30–12:00 and 14:00–17:00; very strict timestamped reporting | Visitor peak in the morning visa window |
| 5 | **Diageo India / United Spirits**, UB Tower | Vittal Mallya Rd (~12.97186, 77.59567) | Corporate HQ | 8 h × 3 | 4 / 4 / 2 | Global-company audit standards; monthly KPI deck | Monthly client report ready |
| 6 | **Verint**, ITC Green Centre | Banaswadi Main Rd (12.99863, 77.62663) | Tech office | 8 h × 3 | 3 / 3 / 1 | ISO 27001 culture: laptops, tailgating | 06:00 no-show, relief arrives 06:40 |
| 7 | **Hyundai Motor India**, South Regional Office | Embassy One, Bellary Rd (13.01993, 77.58564) | Corporate office | 8 h × 3 | 2 / 1 / 1 | Office floor in a Grade-A tower | none |
| 8 | **BPL Medical Technologies**, HQ | Prestige Emerald, Madras Bank Rd (12.97278, 77.59946) | Office | 12 h | 1 / 1 | none | none |
| 9 | **BPL Medical Technologies**, Jigani plant | Jigani Industrial Area (~12.77663, 77.63532) | Factory | 12 h | 4 / 3 | ISO 13485; electronics stores; material gate | none |
| 10 | **Brigade Group**, HQ | WTC, Brigade Gateway (13.01225, 77.55617) | Corporate HQ | 8 h × 3 | 3 / 3 / 2 | Group-level contract (§6) | none |
| 11 | **Brigade Metropolis** | ITPL Main Rd, Mahadevapura (12.99098, 77.70254) | Residential township, 36 acres | 12 h | 6 / 4 | Gate, blocks, basements, resident visitors | Missed 02:00 round |
| 12 | **Orion Uptown** (Brigade) | Old Madras Rd, Huskur (13.05552, 77.76371) | Small mall | 12 h | 10 / 4 | Frisking at entrances, parking, loading dock | none |
| 13 | **Holiday Inn Express & Suites**, Old Madras Rd (Brigade) | Inside Orion Uptown (~13.05552, 77.76371; offset the fence) | Hotel, 129 rooms | 12 h | 4 / 3 | Coordination with the mall; key control | none |
| 14 | **Holiday Inn Express**, Whitefield ITPL | EPIP Zone (12.98635, 77.73258) | Hotel, 161 rooms | 12 h | 5 / 3 | Guest privacy, IHG brand audits | Guest dispute at the lobby, 22:15 |
| 15 | **Bagmane Tech Park** (Eagle's slice: 2 gates + MLCP) | C.V. Raman Nagar (12.98074, 77.65675) | Tech park | 8 h × 3 | 8 / 8 / 5 | Checkpoint patrols, vehicles, medical response | Medical emergency, 15:30 |
| 16 | **Vaswani Group**, Vaswani Victoria | 30 Victoria Rd (12.96642, 77.61316) | Corporate office | 12 h | 2 / 1 | none | none |
| 17 | **Virginia Mall** | Whitefield Main Rd (12.95763, 77.74520) | Small mall, 11:00–23:00 | 12 h | 8 / 4 | Closing sweep at 23:00 | none |
| 18 | **LAPP India**, Jigani plant (also India HQ) | Jigani Phase II (12.77427, 77.63168) | Cable factory | 12 h | 6 / 4 | Gate passes for goods out (returnable and not); copper is the theft target; German EHS standards | Copper gate-pass weight mismatch, 17:10 |
| 19 | **Nysha Mobility Tech** | Dobaspet, Nelamangala (~13.19423, 77.25135) | EV-harness factory | 12 h | 3 / 2 | ~50 km out; night cable theft | Night check: guard found asleep, 02:40 |
| 20 | **Indian Designs Exports** | Nagawara Main Rd (~13.03454, 77.62286) | Garment export unit | 12 h | 8 incl. 2 lady searchers / 3 | Exit frisking; buyer audits | none |
| 21 | **Brother International India**, Bengaluru office | Lalbagh Main Rd (~12.946, 77.588; aggregator address, unverified) | Office | 12 h | 1 / 1 | Japanese-company reporting culture | none |
| 22 | **Brother Machinery India**, factory | Japanese Industrial Township, Vasanthanarasapura, Tumakuru (~13.48518, 77.03640) | Machine-tool factory, ~7.9 acres | 12 h | 5 / 3 | ~70 km out; perimeter patrol | none |

### Mumbai

| # | Client / site | Location (lat, lng) | Type | Shift pattern | On duty (day / night) | What's specific |
|---|---|---|---|---|---|---|
| 23 | **Asahi Kasei India** | The Capital, 1502B, G Block, BKC (19.06325, 72.86185) | Office in a Grade-A tower | 12 h | 1 / 1 | Japanese HQ; meticulous daily report |
| 24 | **Brother International India**, head office | Alpha Building, Hiranandani Gardens, Powai (19.11881, 72.91307) | Corporate HQ | 12 h | 2 / 1 | Japanese HQ |

Both Mumbai sites are **inferred** as Eagle contracts: the logos are on Eagle's site, but we don't know which premises Eagle guards. Same timezone (IST), so nothing in the product changes.

### Also
- **25. Eagle Security HQ**, Langford Gardens (12.95998, 77.60257). The agency's own office as a site, so the guard phone can check in **live in the meeting room** if the demo happens there (§7).

### Scale

| | Count |
|---|---|
| Sites | 25 (23 Bengaluru incl. Eagle HQ, 2 Mumbai) |
| On duty, day shift | ~100 |
| On duty, night shift | ~55 |
| Guards on payroll | ~200, including relievers at about 1 per 6 posts |
| Field officers / supervisors | 8, at 1 per 15 guards per shift, one per cluster |
| Office logins | Owner, Ops Manager (all sites), Field Officer East (site-scoped), Field Officer Mumbai (site-scoped) |

**Clusters for field officers (one night-check route each):**
- Central: CKC, Consulate, UB Tower, BPL HQ, Vaswani, Brother office, Eagle HQ
- South: Bhima Jayanagar
- North-west: Brigade WTC, Bhima Malleshwaram, Hyundai, Indian Designs, Verint
- East: Bagmane, Metropolis, Virginia, HIE ITPL, Orion Uptown, HIE OMR
- Industrial south: LAPP, BPL Jigani
- Industrial north-west: Nysha, Brother Tumakuru
- Mumbai: Asahi Kasei, Brother Powai

**Guard mix:**
- Ex-servicemen gunmen at the jewellers, each with an arms-licence document and an expiry date.
- Lady guards and searchers at Indian Designs, the hotels, the jewellers and the Consulate.
- About 4% monthly churn: 8–10 recent joiners in "police verification pending" or "training 120/160 h".
- Indian names matching Bengaluru's mix (Kannada, Telugu, Tamil, North Indian, Northeast); Marathi names in Mumbai.
- Fake +91 phone numbers.

**Wages:** Eagle pays at least the minimum, so:
- Guards: ₹25,714 (the unskilled floor) up to ₹28,285 (semi-skilled).
- Gunmen: about 1.3×.
- Supervisors: ₹30–34k.

## 4. The story the data tells

Everything is generated relative to the moment the script runs, so the demo is always "now". The script is re-run shortly before the demo (§7).

**Last night (shown as history)**
- 22:15: Guest dispute in the HIE Whitefield lobby. The incident is logged with a photo and the duty manager informed.
- 23:00: Virginia Mall closing sweep completed on time.
- 23:00–04:00: The Field Officer East route across 6 sites. Every visit is timestamped and geofenced.
- 02:00: Missed patrol round at Brigade Metropolis (the guard was 400 m outside the fence for 25 minutes).
- 02:40: Industrial NW officer finds the Nysha night guard asleep. Exception logged and shift flagged.
- LAPP perimeter: hourly rounds all complete. This is the contrast case.

**This morning**
- 06:00: Verint post unmanned. Reliever assigned 06:12, arrives 06:40. The 40 minutes appear as a deduction line on Verint's bill.
- 06:00–07:00: Day shift check-ins across 25 sites, with 3 late arrivals and 1 absent.
- 08:30–12:00: Consulate visa-window visitor peak.
- 10:00: CKC opening checklist completed with two staff names.

**Today (live and pending)**
- A Bhima Malleshwaram gunman's arms licence expires in 12 days.
- 4 recent joiners are blocked from deployment because police verification is pending.
- 2 leave requests are waiting for approval, one of them clashing with a short-staffed weekend at Orion Uptown.
- Overtime to approve at Bagmane (a 12-hour cover of an 8-hour post).

**Staged during the demo (times relative to the demo)**
- Bhima Jayanagar: "suspicious bikers circling", raised as an incident with a photo.
- LAPP: copper gate-pass weight mismatch, raised as an incident.
- Bagmane: medical emergency, closed with a note.

## 5. What we show (the demo script)

About 10–12 minutes. **Real** screens are backed by the database. **Preview** screens show sample rows built around Eagle's real sites and guards, behind a banner.

| # | Beat | Screen | Real or Preview | What to say |
|---|---|---|---|---|
| 1 | "Your morning at 7 am" | Overview `/` | Real | 25 sites, who's on post, who isn't, open exceptions. No phone calls needed |
| 2 | The Verint no-show | `/attendance` → shift detail | Real | Unmanned for 40 min, reliever trail, and it is already on the bill |
| 3 | Live map | `/live` | Real | Zoom out to Jigani, Dobaspet, Tumakuru and Mumbai: the sites you can't drive to at 2 am |
| 4 | Last night | `/events`, `/patrols` | Real | The Metropolis missed round with GPS evidence; the Nysha sleeping guard caught on the night-check route |
| 5 | Jewellers | `/tasks` (CKC opening checklist), `/incidents` (Bhima bikers) | Real | Two-person opening on record; incidents with photos for the insurer |
| 6 | The guard phone | Guard app (§7) | Real | Check-in with selfie and geofence, a patrol photo, raise an incident. It appears on the dashboard in seconds |
| 7 | Compliance | `/guards` → guard profile, documents | Real | Arms licence expiring, police verification pending: blocked from deployment |
| 8 | Roster and leave | `/roster`, `/leave` | Real | The Orion weekend clash |
| 9 | Money | `/payroll`, `/overtime` | Preview | Payroll at the 2026 Karnataka rates; the ESI and professional-tax effects; overtime approvals |
| 10 | Client proof | `/client-reports` | Preview | Diageo's monthly KPI deck and the Consulate's daily timestamped report |
| 11 | Supervisor in the field | Supervisor mode on the phone | Real | Field officer's view of their cluster |

**Avoid in the demo:** `/campus`, `/visitors`, `/gate-passes`, `/property`, `/inspections`. Their sample towers and tenants are generic. Show them only if Eagle asks about Bagmane or the malls, after checking them in rehearsal.

## 6. The Orion Uptown thesis

- **What it is.** Orion Uptown is Brigade's smaller mall on Old Madras Road (Huskur / Sannatammanahalli). In 2019 Brigade described a planned "Orion Mall at Brigade Golden Triangle, Old Madras Road" of about **2.8 lakh sq ft**, serving 1 lakh nearby households. The flagship Orion Mall at Brigade Gateway is 8.2 lakh sq ft. Sources don't state outright that the Golden Triangle project and Orion Uptown are the same building, so treat the link as likely.
- **What's inside it.** Brigade's own **Holiday Inn Express & Suites, Old Madras Road** (129 rooms) sits inside Orion Uptown.
- **Why it matters.** Eagle's logo wall shows Brigade, an Orion logo and a Holiday Inn Express logo. One plausible reading (inferred) is a single Brigade group relationship that covers the HQ at WTC, the Orion Uptown mall and the hotel inside it, plus residential and construction sites. For the demo, Orion Uptown and HIE OMR sit side by side under one client group. If that's right, it's also how Eagle would think about the account: one relationship, many posts, one monthly report.
- **What it means for the pitch.** A group client wants one consolidated view across all its premises. The client report should be able to roll up "all Brigade sites".
- **Confirm with Eagle:** which Brigade properties they guard, and whether "Orion" means Orion Uptown, Orion Mall at Brigade Gateway, or Orion East.

Sources: [Brigade: Orion Mall at Brigade Golden Triangle](https://www.brigadegroup.com/blog/retail/orion-mall-at-brigade-golden-triangle-old-madras-road), [Brigade: Holiday Inn Express & Suites OMR](https://www.brigadegroup.com/hospitality/projects/bengaluru/holiday-inn-express-suites), [Brigade retail projects](https://www.brigadegroup.com/retail/projects/bengaluru), [indiaretailing: Orion Uptown tenants, 2023](https://www.indiaretailing.com/2023/07/05/shopping-centre-chain-orion-adds-7-new-brands-across-properties).

## 7. Build plan for today

### What's true today
- **The cloud project gets migrations, never `seed.sql`.** No script exists to seed a tenant on cloud.
- **The seed only works for one agency.** Its simulation block picks one with `limit 1`, so it can't be pointed at Eagle as-is.
- **The preview pages need only guards and sites.** Everything else in them is generated.
- **No cloud credentials on this machine.** `dashboard/.env.local` and `guard-app/app.json` both point at the local stack.
- **Every tenant table cascades from `agencies`.** All 31 `agency_id` foreign keys are `on delete cascade`, so wiping the demo tenant is one delete, plus removing its auth users.
- **The payroll preview pays guards ₹16,500–21,000**, below the new minimum. Shown to Eagle as-is, that's wrong.

### Access needed from you (first 30 minutes)

| Need | Why | Options |
|---|---|---|
| A way to run SQL on the cloud project | Load the tenant | (a) Give me the database connection string for this session (not committed), or (b) I hand you one SQL file to paste into the Supabase Studio SQL editor |
| Service-role key for the cloud project | Create logins through the auth admin API, which is safer than inserting into `auth.users` by hand on cloud | Set it in my shell only for this session |
| A test phone number on cloud | Guards sign in by phone OTP; cloud has no SMS provider | In Supabase Dashboard → Authentication → Phone: enable the provider and add a test number with a fixed OTP (e.g. `+91 90000 00001` → `123456`) |
| Demo time and place | Sets the cut-off, and whether the Eagle HQ site gets a live check-in | Your answer |

### Steps

| # | Step | Who | Time | Done when |
|---|---|---|---|---|
| 1 | **Access** as above | You | 0:00–0:30 | I can run a query on cloud; the test phone number is configured |
| 2 | **Demo script** `supabase/demo/eagle.sql`, re-runnable (see below) | Me | 0:30–3:00 | Runs twice in a row on local with no errors; screenshots of overview, live, attendance, patrols, incidents look right |
| 3 | **Payroll preview at 2026 wages**: guard pay from ₹25,714, gunmen and supervisors scaled; unit test updated; PR → merge → Vercel deploys | Me | 0:30–1:30, in parallel | Deployed `/payroll` shows 2026 rates |
| 4 | **Guard app pointed at cloud**: build with the cloud URL and anon key (emulator dev build is fastest; an EAS preview APK for a real phone takes longer and can queue) | Me, you install | 1:30–2:30, in parallel | App opens, reaches the phone/OTP screen against cloud |
| 5 | **Load on cloud** and check every demo screen on the deployed site | Me | 3:00–3:30 | Beats 1–11 in §5 all render |
| 6 | **Guard phone**: claim the demo guard with the test number, set PIN, check in at the right site (live at Eagle HQ, or a mocked location on the emulator), take a patrol photo, raise an incident | Me + you | 3:30–4:00 | Each action shows up on the deployed dashboard |
| 7 | **Rehearsal**: full run-through, timed; save screenshots of every beat as a fallback deck | Both | 4:00–4:30 | Under 12 minutes, fallback deck saved |
| 8 | **Refresh** shortly before the demo: re-run the script so "last night" and "this morning" line up with the clock | Me | 30–60 min before | Overview shows the morning's numbers |

Roughly 4.5 hours of work. **If the demo is sooner, cut in this order:**
1. History from 14 days to 7.
2. Mumbai sites.
3. The staged in-demo incidents (do them live from the phone instead).
4. The EAS build (use the emulator).

### What `supabase/demo/eagle.sql` does
1. **Wipe:** delete the agency with the fixed Eagle demo id (everything cascades). Auth users for the demo are deleted by email domain.
2. **Tenant:** "Eagle Security Agency" with timezone Asia/Kolkata and status `active`. The `agencies_bootstrap` trigger seeds the four system roles and app config.
3. **Staff logins** via the admin API, then profiles:
   - `owner@eagle-demo.test` (Owner)
   - `ops@eagle-demo.test` (Manager, all sites)
   - `fo.east@eagle-demo.test` (Supervisor, East cluster)
   - `fo.mumbai@eagle-demo.test` (Supervisor, Mumbai)
   - `supervisor_sites` rows for the scoped ones
4. **Sites:** the 25 sites with fences (radius for offices and showrooms, polygons for campuses and factories) and `shift_types` per site.
5. **Guards:**
   - About 200 guards, with `guard_documents` for Aadhaar and police verification (some pending) and `leave_balances`.
   - Arms licences stored as type `other` with an `expires_on` date. There's no arms-licence document type yet.
6. **Roster:** `roster_patterns` 14 days back, then `materialize_roster` for −14 to +7 days.
7. **Activity:** the seed's simulation block, copied and changed to take the Eagle agency id. It produces attendance, trust flags, `location_pings`, `guard_presence`, `events`, `patrols` and `patrol_photos`.
   - Pings only for last night and today, to keep cloud row counts sensible at about 5× the seed's guard count.
8. **Story (§4):**
   - Incidents with photos.
   - The Verint no-show and audit override.
   - The CKC opening checklist as a task.
   - Leave requests, the arms-licence expiry, and pending verifications.
9. **The demo guard:** a `guards` row with the test phone number, unclaimed, so the app claims it live during rehearsal.

### Risks and fallbacks

| Risk | Fallback |
|---|---|
| Phone OTP doesn't work on cloud even with a test number | Show supervisor mode on the phone: staff sign in with email and password, no SMS needed. Show guard screens from the rehearsal recording |
| The guard app build fails or the EAS queue is slow | Android emulator on the laptop, screen-shared |
| Check-in fails because the phone is outside every fence | The Eagle HQ site covers the meeting room. On the emulator, set a mock location at CKC |
| The script errors halfway on cloud | It's re-runnable: wipe and re-run. Keep the last good local run's screenshots |
| Vercel deploy of the payroll change fails (the Vercel check isn't required to merge) | Check the deployment status after merging. Worst case, skip beat 9 and talk to it |
| Centroid coordinates put a fence on the wrong building | Only the sites zoomed into during the demo need exact gates: CKC, Bhima Jayanagar, LAPP, Eagle HQ. Pin those by hand |
| Demo data visible to other tenants | It isn't: RLS scopes by agency. The platform console will list the tenant, which is fine |

## 8. Questions for Eagle

1. How many guards do you deploy, and across how many sites?
2. Which C. Krishniah Chetty entity do you guard: "& Sons" or the "Group of Jewellers"?
3. Which Brigade properties: HQ, Orion Uptown, the hotel, residential, construction?
4. Do you guard sites in Mumbai (Asahi Kasei, Brother) yourselves or through a partner?
5. How do field officers prove night checks today? How do you bill clients for unmanned hours?
6. How have you handled the May 2026 wage revision with clients: re-priced, absorbed, or still negotiating?
7. What do your biggest clients ask for in their monthly report?
8. Who runs payroll: Eagle Payroll Services (the sister company set up in 2022) or in-house?

## 9. After the demo

- Turn the copied simulation block into a function that takes an agency id. `seed.sql` (Sentinel) and the demo script both call it, which also removes the `limit 1` bug.
- Add an `arms_licence` document type (migration + TypeScript mirror + UI).
- E2E smoke test for the demo tenant, and unit tests for the demo generators.
- Decide whether the Eagle tenant stays (for a pilot) or gets wiped.
