# PRD — MVP: Field-Force & Guard Workforce Management Platform

| | |
|---|---|
| **Status** | Draft v1.0 |
| **Date** | 2026-09-13 |
| **Author** | — |
| **Source** | Competitive research: `raksham-ai-product-spec.md` (full crawl of raksham.ai) |

---

## 1. Summary

We are building a direct competitor to **Raksham AI** (NammaRaksham AI Pvt Ltd, Bengaluru): a workforce management platform for **field staff and security guards** at multi-site SMBs. Raksham has proven demand (50+ clients, 17 cities, 8,000+ tracked staff, ₹999–₹2,999/user/year) but a weak product surface: no real AI, a thin marketing site full of template placeholders, and heavy reliance on manual photo checks.

Our MVP ships the **proven core** — verified attendance, live location visibility, shift management, task accountability, and reports — in a modern, reliable, offline-first package, targeting the same two segments where Raksham has public traction: **security agencies** and **multi-site hospitality/F&B**.

**One-line pitch:** *Every guard and field worker, verified and visible — attendance, location, and tasks with photo-proof, in real time.*

---

## 2. Problem Statement

Owners of distributed field workforces (security agencies, facility/F&B multi-site operators) cannot answer three basic questions:

1. **Is my staff actually at the site?** (ghost payroll, buddy punching, guards absent/asleep at post)
2. **Did the work happen?** (patrols, gate checks, cleaning rounds — no proof)
3. **What do I pay them?** (attendance + overtime computed manually, error-prone)

Existing tools solve this with clipboard muster rolls, WhatsApp photos, or expensive enterprise systems. Raksham validated that SMBs will pay ~₹83–₹250/user/month for a lightweight mobile-first answer. We replicate the validated core and win on reliability, trust (anti-tamper), and polish.

---

## 3. Goals & Non-Goals

### Goals (MVP, ~14 weeks)
- **G1**: Owner can see, in real time, which staff are on duty, where, and whether they checked in with valid selfie+GPS.
- **G2**: Attendance data is trusted: selfie + geo-fence + anti-tamper signals make ghost payroll structurally hard.
- **G3**: Supervisors can run their sites entirely from the product: shifts, tasks, attendance corrections, reports.
- **G4**: Reports replace muster rolls: daily attendance + punch reports, CSV export.
- **G5**: 3 design-partner agencies onboarded and using daily within 2 weeks of signup (target: 10 total in pilot).

### Non-Goals (explicitly out of MVP)
- ❌ **Payroll computation & disbursement** — compliance-heavy (PF/ESI/PT, labor law nuance). Fast-follow, not MVP.
- ❌ **iOS app** — guards/staff in this segment are overwhelmingly Android; iOS ships post-validation.
- ❌ **Route history / distance analytics** — expensive (battery, storage); P1.
- ❌ **Cashbook / manager accounting** — Raksham's premium-app experiment; unvalidated for us.
- ❌ **AI features** (face-match, anomaly detection, auto-scheduling) — differentiators, but P2; MVP ships the data pipelines they need.
- ❌ **Self-serve signup + payments** — MVP is sales-assisted onboarding (like Raksham's demo-first model).

---

## 4. Target Users & Personas

| Persona | Device | Role in product |
|---|---|---|
| **Ram — Agency owner** (runs 40–400 guards across 5–20 client sites) | Android phone, sometimes laptop | Sees everything; pays; cares about billing clients for attended hours and stopping ghost payroll |
| **Sita — Site supervisor** (one site or branch, 5–30 staff) | Android phone | Assigns shifts/tasks, resolves attendance disputes, marks bulk attendance, runs daily report |
| **Ali — Guard / field staff** (low digital literacy, budget Android, spotty network) | Android phone | Starts/ends shift with selfie, sees shifts, completes tasks with photo, flags incidents |

**Context constraints (drives NFRs):** budget Android devices, 2G/4G spotty connectivity, low data plans, low digital literacy, incentive to cheat location.

---

## 5. MVP Scope

### 5.1 P0 — Must-have for launch

#### F1. Organizations & Users
- Multi-tenant: **Org → Branches (sites) → Users**
- Roles: **Owner/Admin**, **Supervisor** (per-branch scoping), **Employee** (staff or guard mode — one app, mode set by role; we do NOT ship two separate apps like Raksham)
- Employee profile: name, phone, employee ID, branch, shift, documents (photo ID upload) — "employee database + document storage" parity with Raksham
- Onboarding: admin bulk-invites via phone number (SMS/WhatsApp deep link) → employee sets 4-digit PIN + selfie registration (registration selfie becomes the reference for future verification)
- **Login by phone + PIN** (not email — our users don't have email; Raksham uses email, a friction point we remove)

#### F2. Shift Management
- Branch-scoped shift types: name, start time, end time (general/morning/night presets)
- Assign employees to shifts (single or repeating weekly pattern)
- Shift roster view per branch (supervisor) with today/week toggle
- Late-start detection: if shift-start attendance isn't recorded within X min of shift start → alert to supervisor (X configurable, default 15)

#### F3. Verified Attendance (the core)
- **One-tap shift start**: captures selfie + GPS + timestamp; validated against branch geo-fence (default 150 m radius, configurable)
- States: ✅ inside fence → present; ⚠️ outside fence → allowed but flagged "out-of-fence check-in"; 🚫 GPS off/mocked → blocked, warned
- **Shift end**: same flow + confirmation screen with retake (parity with Raksham's photo-confirmed shift end)
- Auto half-day logic: < half of shift duration = **Half Day** (yellow); no record = **Absent** (red); present ≥ half = **Present** (green) — matches the color language managers already know
- Manual correction: supervisor can edit a day's status with mandatory reason (audit-logged) — needed for disputes; Raksham lacks an explicit dispute flow, a known gap
- Break tracking is **out of MVP** (keep the state machine simple); logged as P1

#### F4. Anti-Tamper & Trust Signals (differentiator — do better than Raksham's outage flag)
- Mock-location detection (mock-provider flag, sudden-teleport heuristics)
- Offline queue: attendance captured without network syncs when back online, with original capture timestamp + "synced late" annotation
- Device signals with every check-in: battery %, GPS on/off, last known location age
- "Trust score" badge per check-in: clean / flagged / suspicious — simple 3-level signal for the owner, computed from the above
- Outage event: GPS or internet disabled for > 10 min during a shift → event + supervisor alert

#### F5. Live Dashboard (Web + Admin mobile view)
- Map (per-branch or all-branches): on-duty staff as markers with name, shift, battery %, last-seen time
- Live attendance summary cards: present / absent / half-day / flagged counts (Raksham parity)
- Event feed: check-ins, check-outs, geo-fence exits, late starts, outages — filter by branch / employee / event type / date
- Geo-fence breach during shift: alert + event

#### F6. Tasks with Photo Evidence
- Supervisor/admin creates task: title, branch, assignee(s), due date/time, **photo proof required** (on/off, default on)
- Employee sees task list (today/upcoming), completes with photo + optional note; timestamped
- Status states: pending → in progress → done (photo) / missed
- Preset guard task templates seeded: main gate check, patrol round, shift-change briefing (matches Raksham's guard workflows)
- Task report per branch/day with photos

#### F7. Reports & Export
- Daily attendance report (per branch, date-range), Muster roll (branch, month), Punch in/out report (employee, date-range)
- Every report: **CSV download** (parity — Raksham exports CSV everywhere)
- Filters: branch, date range, employee, status
- Web dashboard + emailed daily digests (PDF) to owner — a cheap "operational dashboard" parity win

#### F8. Notifications
- Push (FCM): shift reminders (15 min before), task assignments, task due reminders, alerts to supervisors/owners
- WhatsApp/SMS fallback for owner-level alerts (late starts, outages) — owners in this segment live on WhatsApp (Raksham uses WhatsApp as a sales channel; we use it as a product channel)

### 5.2 P1 — Fast-follow (≤ 8 weeks post-launch, in priority order)
1. **Leave & OT requests** with approval flow (feeds P2 payroll)
2. **Route history & timeline**: breadcrumb path per shift, distance traveled, time outside fence (Raksham's Ultimate-tier metrics — we give them in our single paid tier)
3. **Incident reporting** (guard logs incident with photo; supervisor review) — guard segment expects this
4. **Random alertness (sleep) checks**: random in-shift push → employee responds with selfie within 5 min; escalation to supervisor on miss. *This is Raksham's most distinctive guard feature — must reach parity quickly*
5. **Supervisor bulk attendance** for feature-phone stragglers (mark N employees from one phone, reason-logged)
6. Task templates (reusable, configurable)
7. iOS app (if ≥ 15% of pilot staff demand it)

### 5.3 P2 — Later
- **Payroll automation** (attendance + OT → salary registers, PF/ESI exports)
- **AI verification**: face-match check-in selfies vs registration selfie; route anomaly detection; auto-scheduling suggestions — this is where we make the "AI" real (Raksham's is branding-only)
- Cashbook / business ops for owners
- API + integrations (biometric devices, ERP payroll)

---

## 6. User Stories (P0 acceptance slices)

1. As an **owner**, I create my org, add branches with their geo-fence (map pin + radius), and invite a supervisor, in under 10 minutes.
2. As a **supervisor**, I add guards with phone numbers, assign them to tonight's shift, and they receive an SMS to install & register.
3. As a **guard**, I install the app, register with phone + PIN + one selfie, and can start my shift with one tap that takes a selfie and checks I'm at the site.
4. As a **guard** with no network at basement parking, my check-in is captured, queued, and syncs when I get signal — my attendance time is still correct.
5. As a **supervisor**, I get an alert when a guard is 15+ min late, or leaves the geo-fence mid-shift, or turns GPS off.
6. As a **supervisor**, I assign a "main gate check every 2 hours" task and the guard completes it with a photo I can see in the task report.
7. As an **owner**, I open the web dashboard and see, right now, how many of my 120 guards are present, flagged, or absent, per site.
8. As an **owner**, I download the month's muster roll for a client site as CSV to bill them.
9. As a **supervisor**, I correct a wrongly-flagged attendance with a reason, and the change is audit-logged.
10. As an **owner**, I get a WhatsApp digest at 9 AM: per-site attendance summary with anomalies.

---

## 7. Functional Requirements (key rules)

| ID | Requirement |
|---|---|
| ATT-1 | Shift-start/end requires selfie (JPEG, ≥480p) + GPS fix (accuracy ≤ 50 m) + server timestamp; client timestamp stored alongside |
| ATT-2 | Geo-fence: configurable radius (100 m–1 km) per branch; check-in outside fence succeeds but is flagged `OUTSIDE_FENCE` |
| ATT-3 | Mock GPS or no GPS → check-in blocked with warning; event logged `TAMPER_SUSPECTED` |
| ATT-4 | Attendance status auto-computed daily at shift end: PRESENT / HALF_DAY / ABSENT; manual override only by Supervisor+ with reason |
| ATT-5 | Offline attendance queue: FIFO, original capture time preserved, photos stored locally until sync; queue survives app restart |
| SHIFT-1 | Shifts are branch-scoped; weekly repeat patterns supported; one employee = one active shift at a time |
| TRACK-1 | During active shift, app captures location pings every 5 min (adaptive: 2 min if moving fast, 15 min if stationary) |
| TRACK-2 | Live dashboard staleness: last-seen older than 15 min shows grey marker with "last seen HH:MM" |
| TASK-1 | Task completion photo is mandatory when task has `photo_required=true`; completion is timestamped server-side |
| ALERT-1 | Late start, fence breach, outage, missed task-due → push to supervisor within 60 s of detection |
| REP-1 | All reports exportable as CSV; report generation ≤ 5 s for ≤ 10k attendance rows |
| ROLE-1 | Supervisors see only their branches; employees see only their own data and their branch roster |
| AUD-1 | Every attendance edit, deletion, or override is immutable-logged (who, when, reason) |

---

## 8. Non-Functional Requirements

| Area | Requirement |
|---|---|
| **Battery** | Background tracking ≤ 6% battery/day on a 4,000 mAh device (adaptive ping rate; no always-on GPS between shifts) |
| **Data** | ≤ 60 MB/month per employee on typical usage (image compression: selfie ≤ 120 KB, task photo ≤ 250 KB) |
| **Offline** | App core (check-in/out, task completion) fully functional offline ≥ 24 h |
| **Latency** | Dashboard P95 < 2 s; check-in flow (tap → server confirm) < 5 s on 3G |
| **Uptime** | 99.5% API; check-in endpoint 99.9% (it's the money path) |
| **Security** | TLS everywhere; images in object storage with signed URLs; PIN hashed (bcrypt); PII minimal (selfies retained 90 days rolling, configurable); Indian data residency (Mumbai region) |
| **Scale (MVP)** | 50 orgs, 5,000 employees, 25k check-ins/day without re-architecture |
| **Devices** | Android 8+ (covers the budget-device fleet); works on 2 GB RAM |
| **i18n** | English + Hindi at launch; strings externalized for Kannada/Tamil fast-follow |

---

## 9. Architecture Sketch (informative, not binding)

- **Mobile (Android, MVP)**: Kotlin, foreground-service location during shift, WorkManager for sync queue, CameraX, Room cache
- **Admin web**: React/Next.js, MapLibre/Leaflet + self-hosted tiles or Mapbox, server-side CSV/PDF generation
- **Backend**: Node (NestJS) or Go; PostgreSQL + PostGIS (geo-fence queries); Redis (live presence); S3-compatible object storage (selfies/photos)
- **Realtime**: WebSockets for dashboard; FCM push; WhatsApp Business API for owner digests/alerts
- **Multi-tenancy**: single DB, `org_id` row-level scoping (MVP) — designed so enterprise isolation is possible later

---

## 10. Pricing & Packaging (launch hypothesis, to be validated with pilots)

| Tier | Price (launch) | Includes |
|---|---|---|
| **Starter** | Free ≤ 5 staff | Full attendance + shifts, 1 branch, 30-day report history |
| **Growth** | ₹599 /user/year (intro; list ₹999) | Everything in MVP scope: live tracking, tasks, reports, alerts, unlimited branches, history 3 yr |
| **Scale** | ₹1,999 /user/year | + P1 pack (routes/distance, leave/OT, incidents, alertness checks, bulk attendance), API access |

Rationale: undercut Raksham's Ultimate (₹2,999) while **including tasks and metrics in every paid tier** — Raksham gates tasks behind Ultimate; our single paid tier with everything is a clean sales story. Free tier seeds bottom-up adoption from single-site owners.

---

## 11. Success Metrics (first 90 days post-launch)

| Metric | Target |
|---|---|
| Design partners onboarded | 10 (≥ 6 security agencies) |
| Weekly active guards/staff | ≥ 70% of licensed users |
| Check-in success rate (first attempt) | ≥ 95% |
| Flagged/suspicious check-ins | < 5% of total (and falling) |
| Attendance disputes resolved in-app | ≥ 80% |
| Muster-roll CSV exports per org | ≥ 4/month (proxy for workflow adoption) |
| Pilot → paid conversion | ≥ 40% |
| Time-to-value: signup → first full day of verified attendance | ≤ 2 days |

---

## 12. Milestones (14 weeks)

| Week | Deliverable |
|---|---|
| 1–2 | Schema, auth, org/branch/roles, admin web shell; geo-fence model |
| 3–5 | Android app: register, PIN, shift start/end with selfie+GPS, offline queue |
| 6–7 | Live dashboard: map, events, alerts; anti-tamper v1 |
| 8–9 | Shifts & tasks (mobile + web), notifications, seeded guard task templates |
| 10–11 | Reports + CSV/PDF digests; manual corrections + audit log |
| 12 | Alpha with 1 friendly agency (staff of ~10); battery/data tuning |
| 13–14 | Hardening, 2 more pilots, launch checklist (Play Store listing, demo env, pricing page) |

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Guards resist surveillance/selfies | Position as "your proof of work = your pay protection"; instant PIN login; works offline; pilot with supervisor champions first |
| Battery drain on budget devices | Adaptive ping rate; battery telemetry exposed to owner so it's our data, not a complaint |
| GPS inaccuracy indoors (basements) | Out-of-fence check-in allowed-but-flagged (never hard-block pay); supervisor override with reason |
| Raksham undercuts on price | Our moat is reliability + trust scoring + single-tier simplicity, not price war |
| Long sales cycles with agencies | Free Starter tier + WhatsApp-led onboarding; target agencies billing clients per guard-hour (fastest ROI story) |

---

## 14. Open Questions

1. Do we launch with **one app (mode-switched)** or follow Raksham's Staff/Guard split? — *Recommendation: one app. Raksham's split doubles maintenance with little user benefit.*
2. Selfie retention policy & consent language (states treat biometric data strictly) — legal review needed before pilot.
3. Should the MVP include **client-site portal** (agency's client sees their guards' attendance)? Big differentiator for agency sales; adds a role + scoping work. Recommend post-MVP.
4. WhatsApp Business API cost vs. SMS fallback for alerts — pilot both, pick by delivery rate.
5. Payment collection (Razorpay subscription vs. invoice) — needed by week 13.

---

## Appendix A — Raksham Parity Map (what we matched / beat / deferred)

| Raksham feature | Our MVP |
|---|---|
| Selfie + location attendance, geo-fence, color-coded status | ✅ Matched |
| One-tap shift start, photo shift end + retake | ✅ Matched |
| Shift types, automated scheduling basics | ✅ Matched |
| Live map, battery %, event feed, CSV reports | ✅ Matched |
| Task management with mandatory photo evidence | ✅ Matched (in every paid tier — Raksham gates it to Ultimate) |
| Supervisor bulk attendance | ⏭ P1 |
| Route history, distance metrics | ⏭ P1 (Raksham Ultimate) |
| Sleep alerts, incident reporting, OT/leave | ⏭ P1 |
| Payroll automation | ⏭ P2 |
| Cashbook, manager mode | ⏭ P2 (unvalidated) |
| Outage detection | ✅ **Beat**: 3-level trust score + mock-GPS detection vs. Raksham's binary flag |
| Email login | ✅ **Beat**: phone + PIN |
| Two separate staff/guard apps | ✅ **Beat**: one mode-switched app |
| "AI" branding | ⏭ P2: real face-match + anomaly detection |
