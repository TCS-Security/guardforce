# PRD v2.1 — GuardForce: Security Guard Management Platform

| | |
|---|---|
| **Status** | v2.1 — founder review incorporated; ready for team |
| **Date** | 2026-09-13 |
| **Supersedes** | `prd-mvp.md` (v1) |
| **Source docs** | 1. `guard-crm-notes.md` — founder's notes (**priority 1**) · 2. `prd-mvp.md` — competitive MVP draft (**priority 2**) · 3. `raksham-ai-product-spec.md` — competitive research |

> **How to read this PRD:** Where the founder's notes and the v1 PRD differ, the notes win. The product is a **guard-first security agency platform** — field-staff expansion (F&B, retail) is a later motion, not the launch focus.

---

## 1. Summary

We are building a **guard management platform for Indian security agencies** — two surfaces, one system:

1. **Guard App** (Android) — the guard's shift is enforced from his phone: verified attendance, live location, patrols, proof of work.
2. **Agency CRM + Dashboard** (web) — the agency's control room: sites, guard profiling & KYC, shifts, live monitoring, attendance analytics, leave, and shareable guard records.

We answer **six questions** no agency can answer today (from founder's notes — these define the product):

1. Did my guards reach the site?
2. Did they stay the full time?
3. Did patrolling happen?
4. How long were breaks / how long outside the site?
5. Were they sleeping on duty?
6. Is every guard's record stored properly in one place — safe, accessible, and **shareable**?

**Market context:** Raksham AI (Bengaluru) has validated willingness to pay in this exact segment — 50+ agencies/businesses, 17 cities, 8,000+ guards, ₹999–₹2,999/user/year — with a weak product surface (no real AI, template-heavy website, two separate apps). Competitors to also study: **Shivit, Ivisit, Security Forces**.

**Positioning:** *Every guard verified, every patrol proved, every record ready to share.*

---

## 2. Problem

Agency owners bill clients per guard-hour but cannot verify delivery: guards miss shifts, leave early, skip patrols, sleep at post, or don't show up at all — while clients demand documented proof (muster rolls, verification records, patrol logs). Meanwhile, India's guard deployment requires **documented police verification and KYC per guard**, which agencies manage in shoeboxes and WhatsApp folders.

Result: ghost payroll, client churn, audit risk, and zero institutional memory of their own workforce.

Raksham proved agencies pay for point solutions (attendance + tracking). We ship the **same verified core plus the CRM layer they lack** — guard profiling, KYC vault, and shareable records — making the agency's *client-facing and compliance* life easier, not just monitoring.

---

## 3. Users & Personas

| Persona | Device | Role |
|---|---|---|
| **Agency Owner** — runs 40–400 guards across 5–20 client sites | Android + laptop | Pays; monitors everything; answers to HIS clients; cares about billing proof and KYC compliance |
| **Site Supervisor** — one site, 5–30 guards | Android | Runs the site: rosters, patrols, attendance corrections, leave approvals |
| **Guard** — low digital literacy, budget Android, spotty network | Android phone | One-tap start/end, patrols with photo proof, sees own shifts & leaves |

**Constraints that shape engineering:** budget Androids, 2G/4G flaky networks, low data plans, low literacy, and *a strong incentive to defeat location tracking*.

**Secondary user (post-MVP):** the agency's **client** (housing society, factory, hotel) — sees verified attendance/patrol reports for their site. Seeded via **shareable guard profiles & reports** in MVP.

---

## 4. Goals & Non-Goals

### Goals
- **G1**: Owner sees, in real time, which guards are on site, since when, and whether they're inside the perimeter — on web and phone.
- **G2**: Attendance is **structurally trusted**: photo at shift start + presence inside geo-fence, and **no location = no shift**.
- **G3**: Patrols happen and are provable — routes + timestamps + photo evidence.
- **G4**: Guard profiles are complete, KYC-stored, and **shareable** as a clean link/PDF with clients.
- **G5**: Supervisor's daily reality lives in the product: rosters, break/exception review, corrections with audit trail, CSV/muster exports.
- **G6**: 3 design-partner agencies live within 2 weeks of onboarding (10 by pilot end).

### Non-Goals (out of MVP)
- ❌ Payroll computation & disbursement (PF/ESI/labor-law) — P2
- ❌ iOS app — P1
- ❌ Sleep/alertness detection — P1 (needs real-time infra from MVP, but not launch-gating)
- ❌ Full checkpoint-based patrol hardware (QR/NFC) — P1
- ❌ Client-facing portal with logins — P2 (MVP ships shareable links instead)
- ❌ Cashbook / accounting — P2
- ❌ Field-staff (non-guard) verticals — P2
- ❌ Self-serve signup + online payments — MVP is sales-assisted onboarding; **product Version 1 ships with no billing, paywall, or tier gating** (v2.1)

---

## 5. MVP Scope — P0

### F1. Agency CRM: Org, Sites, Roles
- Multi-tenant: **Agency → Sites → Guards**
- Roles: **Owner/Admin**, **Supervisor** (site-scoped), **Guard**
- **Site record** (per notes): site name, location (map pin), **perimeter/geo-fence (optional — radius default 150 m, or drawn polygon)**, **number of guards required**, **shift times required**
- **Boundary leeway (v2.1)**: agencies won't provide perfect site boundaries — the perimeter is captured approximately, and every fence check applies a **configurable leeway buffer** (default +50 m) around it
- Site staffing view: required vs. actual guards present (gap alert)
- Guard invite via SMS/WhatsApp deep link → app install

### F2. Guard Profiling & KYC (from notes — full list)
Structured guard profile with typed document slots:

| Field / Document | Required |
|---|---|
| Name, Phone (OTP-verified) | ✅ |
| Aadhaar Card | ✅ |
| PAN Card | ✅ |
| Police Verification Document | ✅ |
| 10th/12th Marksheet | Optional |
| Guard KYC (agency's verification record) | ✅ |
| Post/designation at site | ✅ |
| Registration selfie (reference for verification) | ✅ |
| Supervisor, site, shift, check-in/checkout times, location, photo verification | System-captured |

Rules:
- **Profile-completion gating**: a guard with incomplete mandatory KYC cannot be rostered to a shift (notes: *"guard profiling must be complete"*).
- Phone verified by **OTP** at onboarding; login = **phone + PIN** (no email — guards don't have it).
- **Shareable profile**: one-click "share" generates a clean PDF/web link of the guard's verified profile + KYC status — for clients or audits (notes: database must be *"shareable bhi ho"*).

### F3. Shift Management
- Shift types per site (morning/evening/night presets, custom times)
- Roster: assign guards, weekly repeating patterns; site-level roster view (today/week)
- Late-start detection → supervisor alert (default 15 min, configurable)
- Attendance states auto-computed: **Present (green) / Half Day (yellow) / Absent (red)**; early checkout flagged

### F4. Verified Attendance — the money path
Per the notes, attendance is marked **only if both conditions hold**:

1. **Photo (selfie) uploaded once at shift start**, AND
2. **Guard is present inside the site geo-location (geo-fence)** — fence checks run against the captured perimeter **with the leeway buffer applied** (v2.1: perfect boundaries won't be provided)

Enforcement rules:
- One-tap shift start: selfie + GPS + server timestamp; in-fence → present; out-of-fence → flagged `OUTSIDE_FENCE` (allowed, but visible to supervisor)
- Shift end: same flow + confirm screen with retake
- **Continuous location is mandatory: if the guard turns location OFF, the shift is NOT counted** (*notes: "Guard can not turn location off. If turn off, then shift maani nhi jayegi"*). Implemented as:
  - While location is off during a shift, the guard is **flashed a warning every 30 minutes** prompting him to turn location back on (persistent notification + in-app alert) *(v2.1)*
  - Location still off at shift end → shift status becomes `VOID — LOCATION OFF`
  - **Manager exception (v2.1)**: the guard's manager/supervisor can log an **exception** for genuine technical issues (e.g., device/GPS failure) with a mandatory reason — the shift then counts; the exception is audit-logged
- Mock-GPS detection → check-in blocked + `TAMPER_SUSPECTED` event
- Offline: attendance queues locally, syncs with original capture time; originals preserved, "synced late" annotated
- Trust badge per check-in: **clean / flagged / suspicious** (battery %, GPS accuracy, mock flags, fence state)

### F5. Live Tracking & Shift Enforcement
- During shift, app maintains **continuous location** (adaptive ping: 2–5 min; 15 min if stationary; foreground-service on Android)
- **Live dashboard map**: all on-duty guards per site — name, shift, battery %, last-seen; markers grey out at 15-min staleness with "last seen HH:MM"
- **In-site vs. out-of-site time**: time outside fence during a shift is computed automatically → surfaced as the guard's **break/away time** (core question #4)
- **Geo-fence exit event** during shift → immediate supervisor alert
- **Outage events**: location/GPS/internet off > 10 min → event + alert (feeds F4 void rule)
- Event feed on web: check-ins/outs, fence events, late starts, outages — filter by site/guard/type/date

### F6. Patrolling (first-class, MVP scope)
Core question #3 — "patrolling hui ki nhi" — gets a dedicated answer, not just generic tasks:

- **Patrol rounds**: supervisor defines a patrol for a site (name, expected frequency, e.g., "every 2 hours night shift")
- Guard starts a patrol from the app; app records the **GPS breadcrumb trail + duration**; guard captures **photo(s)** at points along the round (**per-site configuration** — when photo proof is enabled for a site it is mandatory; v2.1 decision)
- Patrol status per site: on-time ✅ / late ⚠️ / missed ❌ — visible on dashboard
- **MVP boundary**: free-form GPS+photo patrols. *Structured checkpoints (QR/NFC at posts, ordered route verification) = P1.*

### F7. Tasks with Photo Evidence
- Supervisor creates task: title, site, assignee(s), due, **photo proof required** (default on)
- States: pending → in progress → done (photo + timestamp) / missed
- Seeded templates: main gate check, shift-change briefing, visitor log check
- Task report per site/day with photos

### F8. Leave Management (named module in notes)
- Guard applies for leave (date, type: casual/earned/unpaid, reason) from app
- Supervisor approves/declines; status visible on roster (auto-marks expected absence)
- Leave calendar per site; guards see own balance & history
- *OT requests/approvals = P1*

### F9. Attendance Analytics & Reports (named module in notes)
- **Dashboard cards**: present/absent/half-day/flagged per site, today & trend (7/30-day)
- Guard-level scorecard: punctuality %, missed patrols, away-time average, flags
- Reports: **Daily attendance, Muster roll (site, month), Punch in/out** — all **CSV export**
- Daily 9 AM digest to owner (WhatsApp/PDF): per-site attendance summary with anomalies
- Filters: site, date range, guard, status

### F10. Notifications
- Push (FCM): shift reminders, patrol/task assignments & due alerts, leave decisions
- WhatsApp/SMS fallback for owner/supervisor alerts (late start, fence exit, location-off, outage)
- Daily email/WhatsApp digest for owners

---

## 6. P1 — Fast-follow (≤ 8 weeks post-launch)

1. **Sleep/alertness checks** (core question #5): random in-shift check → guard responds with selfie within 5 min → miss escalates to supervisor. *Raksham's most distinctive feature — we match, then beat it.*
2. **Checkpoint patrols**: QR/NFC at physical posts, ordered routes, patrol compliance %
3. **Leave + OT approvals wired into roster & analytics**
4. **Route history & distance metrics** (Raksham Ultimate-tier features — ours in the single paid tier)
5. **iOS app**
6. **Supervisor bulk attendance** with reason logging
7. Face-match of check-in selfies vs registration selfie (first real AI feature; MVP stores the data pipeline)

## 7. P2 — Later
- **Payroll automation** (attendance+OT → salary registers, PF/ESI exports)
- Client portal (logins, site reports, patrol logs)
- Cashbook/ops for owners; field-staff verticals (F&B/retail); API & integrations
- AI: anomaly detection (routes, attendance), auto-rostering

---

## 8. Key Functional Requirements

| ID | Requirement |
|---|---|
| AUTH-1 | Onboarding: phone + OTP; login: phone + PIN (biometric unlock optional) |
| KYC-1 | Guard profile stores all F2 documents; roster assignment blocked while mandatory slots are incomplete |
| KYC-2 | Shareable profile link/PDF expires after 30 days; KYC docs watermarked "Shared via [Agency]" |
| ATT-1 | Attendance = selfie (≥480p) + GPS fix ≤ 50 m accuracy + server timestamp |
| ATT-2 | In-fence at start → Present; out-of-fence → allowed but `OUTSIDE_FENCE`-flagged |
| FENCE-1 | Geo-fence = captured site perimeter (pin+radius or polygon) + configurable leeway buffer (default +50 m); all fence checks (attendance, away-time, exit events) use the buffered fence |
| ATT-3 | Mock GPS → check-in blocked, `TAMPER_SUSPECTED` logged |
| LOC-1 | Location off during shift → guard **warned every 30 min** to re-enable; still off at shift end → `VOID — LOCATION OFF` |
| LOC-3 | Guard's manager may log a documented **exception** for genuine technical issues (device/GPS failure) — shift counts; exception audit-logged (v2.1) |
| LOC-2 | Live dashboard staleness > 15 min → grey marker + last-seen time |
| PAT-1 | Every patrol captured with GPS trail, start/end timestamps, and ≥1 photo **when photo proof is enabled for the site** (per-site config — v2.1 decision) |
| BRK-1 | Away-time per shift computed from fence transitions; shown on dashboard & guard day-view |
| LEAVE-1 | Approved leave auto-marks roster day as `ON_LEAVE` (excluded from absence counts) |
| REP-1 | CSV export: attendance, muster, punch, patrol compliance; ≤ 5 s for ≤ 10k rows |
| ROLE-1 | Supervisors see only their site; guards see only their own data |
| AUD-1 | All attendance overrides/edits immutable-logged (who/when/why) |

---

## 9. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Battery | Continuous-shift tracking ≤ 6%/day on 4,000 mAh budget device |
| Data | ≤ 60 MB/month/guard (selfie ≤ 120 KB, task/patrol photo ≤ 250 KB) |
| Offline | Core flows (start/end, patrol, task, leave) work offline ≥ 24 h; queue survives restart |
| Latency | Dashboard P95 < 2 s; check-in round-trip < 5 s on 3G |
| Uptime | API 99.5%; check-in endpoint 99.9% |
| Security & compliance | TLS; PIN hashed; signed media URLs; **KYC docs encrypted at rest, access-logged**; selfies rolling 90-day retention (configurable); data residency in India (Mumbai region); Aadhaar stored per legal guidance (masked where possible, legal review pre-pilot — see Risks) |
| Scale | 50 agencies, 5,000 guards, 25k check-ins/day, no re-architecture |
| Devices | Android 8+, 2 GB RAM |
| i18n | English + Hindi at launch; externalized strings |

---

## 10. Architecture Sketch (informative)

- **Guard App**: Kotlin; foreground service for shift tracking; WorkManager sync queue; CameraX; Room
- **CRM/Web**: React/Next.js; MapLibre/Leaflet; server-side CSV/PDF (reports, shareable profiles)
- **Backend**: Node (NestJS) or Go; PostgreSQL + PostGIS (fence queries, breadcrumb storage); Redis (live presence); S3-compatible storage (KYC docs encrypted, selfies/photos); WebSocket dashboard; FCM + WhatsApp Business API
- **Multi-tenancy**: single DB, `agency_id` row-scoping; enterprise isolation path preserved

---

## 11. Pricing Hypothesis (validate in pilots)

| Tier | Price | Includes |
|---|---|---|
| **Starter** | Free ≤ 5 guards | Attendance + shifts + roster, 1 site, 30-day history |
| **Growth** | ₹599/guard/year (intro; list ₹999) | Full P0: live tracking, patrols, tasks, leave, analytics, reports, shareable profiles |
| **Scale** | ₹1,999/guard/year | + P1 pack (alertness checks, checkpoint patrols, OT, route analytics), API |

Wedge vs Raksham: single paid tier includes **tasks + metrics** (they gate to ₹2,999 Ultimate) **+ the CRM/KYC layer they don't have**.

> **v2.1 decision — no billing in Version 1:** the pilot product ships with **no billing, paywall, or tier gating**; all pilot agencies run the full feature set unbilled. The table above is the hypothesis for the **paid launch after pilots** — planning context only; no pricing/payments work exists in the v1 build.

---

## 12. Success Metrics (90 days post-launch)

| Metric | Target |
|---|---|
| Design-partner agencies | 10 live |
| Weekly active guards | ≥ 70% of licensed |
| First-attempt check-in success | ≥ 95% |
| Guard profile completion (KYC-complete) | ≥ 90% within 2 weeks of onboarding |
| Patrol compliance (on-time rounds) | ≥ 85%, rising |
| Shift-void events (location-off) | < 5% of shifts and falling |
| Shareable-profile shares per agency | ≥ 2/month (proxy for client-facing value) |
| Muster/patrol CSV exports per agency | ≥ 4/month |
| Pilot → paid conversion | ≥ 40% |
| Signup → first full verified day | ≤ 2 days |

---

## 13. Milestones (16 weeks)

| Week | Deliverable |
|---|---|
| 1–3 | Schema, OTP auth/PIN, agency/site/geo-fence model, CRM web shell, guard profile & KYC vault (F1–F2) |
| 4–6 | Guard App: register, OTP+PIN, registration selfie, verified shift start/end, offline queue (F4) |
| 7–9 | Continuous tracking service, location-off enforcement, live map dashboard, event feed, away-time computation (F5) |
| 10–11 | Shift roster, patrols (GPS+photo), tasks, notifications (F3, F6, F7, F10) |
| 12–13 | Leave module, attendance analytics, reports/CSV, shareable profiles, daily digests (F2 share, F8, F9) |
| 14 | Alpha with 1 friendly agency (~10 guards); battery/data/tamper tuning |
| 15–16 | Hardening; 3 more pilots; Play Store listing, demo environment, launch checklist (pricing/payments deferred to post-pilot paid launch — no billing in v1) |

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| Guards defeat tracking (GPS off, mock location, phone left at gate) | Multi-signal trust score (battery, accuracy, mock flags, movement); location-off voids shift; supervisor override keeps it human; patrol photos force physical presence |
| Aadhaar/KYC storage legal exposure | Legal review before pilot; masked Aadhaar (last 4), DigiLocker verification where possible, encrypted vault + access logs |
| Guard adoption resistance | 4-digit PIN, one-tap flows, offline support, Hindi UI; position as "proof of work = your pay protection"; seed via supervisor champions |
| Battery drain on budget devices | Adaptive pings; expose battery on dashboard (it's our data, not a complaint) |
| Indoors GPS accuracy (basement sites) | Out-of-fence allowed-but-flagged (never hard-block pay); supervisor override with reason |
| Raksham price war | Compete on CRM/KYC layer + trust scoring + shareable records, not price |
| Agency sales cycles | Free Starter tier; target agencies billing clients per guard-hour (fastest ROI); WhatsApp-led onboarding |

---

## 15. Decisions & Open Questions

### Decisions (from founder review — v2.1)
- ✅ **D1 — Location-off policy**: hard void at shift end, with 30-min recurring warnings to the guard and manager-logged exceptions for technical issues (resolves old Q1)
- ✅ **D2 — Geo-fence**: approximate perimeter capture + configurable leeway buffer; perfect site boundaries not required (resolves old Q3 of F4)
- ✅ **D3 — Patrol photos**: per-site configuration; mandatory when enabled (resolves old Q3)
- ✅ **D4 — No billing in Version 1**: pilots run unbilled; pricing/payments are post-pilot (defers old Q5)

### Open questions (remaining)
1. Aadhaar storage: masked storage vs. DigiLocker-based retrieval — legal review, pre-pilot.
2. Shareable profile format: expiring web link vs. PDF vs. both (recommend both).
3. Competitive scans of Shivit, Ivisit, Security Forces — assign owner; informs positioning before launch.

---

## Appendix — Traceability to sources

| This PRD | Source |
|---|---|
| 6 core questions, KYC fields, site fields, location-off rule, photo+geo attendance, leave & analytics modules, shareable database, patrolling, break/outside time | `guard-crm-notes.md` (priority 1) — all present |
| Trust score, offline-first, one mode-switched app vs Raksham's two, phone+PIN, single-tier pricing wedge, competitive data, NFRs, milestones | `prd-mvp.md` (priority 2) |
| Raksham feature matrix, pricing, GTM intel, template-artifact warnings | `raksham-ai-product-spec.md` |
| Geo-fence leeway buffer, 30-min location-off warnings, manager exceptions, patrol photo per-site config, no-billing v1 | Founder review comments on PRD v2.0 → incorporated as v2.1 |
