# What the US guard-software industry has that we don't

> Research date: 2026-10-04. Scope: companies whose *primary* market is contract
> security guard agencies (not generic workforce/HRMS). Benchmark for "2x–3x
> better": `docs/raksham-ai-product-spec.md`.

---

## 0. The one-paragraph answer

The US category is split into two halves. The half we have built — **proof of
service**: GPS attendance, geofences, patrol tours, incident reports, live map,
rosters — is the *commodity* half over there. Every one of the nine vendors below
ships it, and the ones that only ship it (GuardMetrics, OfficerReports, QR
Patrol) are the cheap tier, $10–30/guard/month, constantly churning. The half
that creates the money and the switching cost is **the back office**: clients,
contracts, bill rates, invoices, payroll, statutory compliance, licence
eligibility, recruiting, and a client-facing portal. That half is 100% missing
from GuardWatch AI, and it is *also* missing from Raksham — which is why it, not
more tracking features, is the 2x–3x wedge. Raksham sells a better pedometer.
The agency owner's actual daily pain is "did I bill all 412 posts correctly, can
I pay on the 7th when the client pays on the 60th, and will the labour inspector
find my wage register". Verified attendance, which we already have, is the
*input* to all of that — we are sitting one join away from the valuable product
and haven't taken it.

---

## 1. The five-plus companies

### 1.1 Trackforce (TrackTik + Silvertrac + GuardTek) — the category leader
The consolidation of TrackTik (Montreal), Trackforce, Valiant Solutions (NY) and
Silvertrac (Irvine CA) into one company. Sells to the enterprise end: Allied
Universal / Securitas tier regionals and nationals, 50+ countries, 55+ languages.

Module list, as they market it:

- **Protect (field ops)** — security operations, guard management, guard tour
  system, incident reporting, guard app, **equipment/asset tracking**, **guard
  dispatch**, **mobile patrol management**, **security command centre**.
- **Run the business (back office)** — business administration, "Back Office
  Operating System" suite, **contracts & invoicing**, **payroll and tax
  compliance incl. ACA reporting**, people management, **recruiting &
  onboarding**.
- **Data** — BI & analytics, **ReportPro AI**, a documented REST API + webhooks,
  integrations to ADP, Paycor, Sage Intacct, QuickBooks, Xero, Immix (alarm
  monitoring) and Scylla (video AI).

Things in there we have no equivalent of at all: checkpoint verification over
**NFC / QR / barcode** (not just GPS), a **dispatch** module that assigns the
nearest available officer to an inbound call and runs an **SLA timer**, **panic
button + hazard-alert (dead-man) timers** for lone workers, **asset tracking**,
**contract-terms-to-billing-rules**, and a **client portal** where the customer
self-serves proof of service.

**ReportPro AI** (Sept 2025) is the most copyable idea in the category: the guard
dictates rough notes, AI turns them into compliance-ready prose, supervisors get
an auto executive summary, and **every AI edit is kept in a field-level audit log
with original vs enhanced side by side**. The audit log is the clever part — it
makes AI admissible in an insurance or court context.

### 1.2 TEAM Software (WinTeam + eHub) — now part of WorkWave
Omaha, NE. The ERP of the industry; sells to cleaning and security contractors
together. The distinction that matters: **payroll, AR, AP, general ledger and
contract-level job costing are native, not integrated**. Verified hours become
both a paycheque and an invoice without re-entry.

Capabilities: accounts receivable/payable, general ledger, financial reporting,
payment processing, **job cost analysis**, **labour budgeting**, payroll & tax,
**employee qualification & licence management**, hourly-benefit time-off accrual,
**applicant tracking & onboarding**, **benefits enrolment**, **employee
recognition & awards**, DOL compliance, personnel *and* work scheduling as
separate linked modules, guard touring, **inventory & equipment usage**, QA
inspections, auto-invoice from completed shifts, **automatic alerts for expiring
licences and certifications**, BI dashboards. **eHub** is a combined
employee+client portal with SMS check-in response.

What this company proves: the thing an agency will not switch away from is the
one holding its general ledger. Everything we have built is, from TEAM's point
of view, a data-collection front end for payroll and billing.

### 1.3 Belfry — the modern, best-designed competitor ($20M raised, NYC, 2022)
The closest analogue to what GuardWatch AI *should* become, and the best single
product to study. $12M Series A led by Base10 in Jan 2025. Explicitly
"scheduling to payroll, timesheet to invoice" in one app.

- **Scheduling** — smart shift matching, shift *offers* filtered by
  certification, OT cost control.
- **Timekeeping** — electronic timesheets, GPS-synced **auto-approval**,
  **officer-overlap and excessive-OT flagging**, automated break-compliance
  alerts.
- **Operations** — real-time **client portals**, NFC/geofence tours, custom
  patrol workflows, dispatch, mobile incident reporting.
- **Payroll & HR** — embedded payroll ("timesheets to payroll in three clicks"),
  custom pay rates and deductions, **next-day direct deposit**, benefits, tax
  filing, ACA compliance, employee self-enrolment.
- **Billing** — automated invoice distribution, **ACH and card collection**, OT
  billing and rate multipliers, **site-level profitability dashboards**.
- **Compliance** — licence/certification tracking with alert automation.
- **Belfry Recruiting** — a hiring add-on, sold as a service.
- **AI** — "Belle AI Dispatcher" which *resolves missed clock-ins by itself*, and
  a general AI assistant.

Note what Belfry chose to own rather than integrate: **money movement**. Payroll
disbursement and invoice collection. That is the durable business.

### 1.4 Silvertrac — the SMB field-ops standard (now Trackforce)
Irvine CA. Still sold as a separate SKU because it owns the small-to-mid
US agency. Worth studying for the *detail* of its ops surface, which is richer
than ours in places we'd not have thought of:

customizable guard tours, real-time incident reporting, **parking management**
(ticketing, tow logs, permit lookups — a real revenue line for US patrol
companies), employee time clocks, **pass-down notes** shift-to-shift and
post-to-post, **post orders**, live GPS maps, centralised dispatch and task
management, **automation of recurring tasks and reminders**, scheduled/automated
reporting pushed to clients, guard performance metrics, audio+text+photo evidence
capture from the field.

**Pass-down notes** and **post orders** are the two cheapest high-value things on
this entire page, and we have neither.

### 1.5 Celayix — the scheduling-engine specialist
Sells *only* scheduling/T&A into security, and survives against full suites
because its engine is better. Its pitch is a hard number: **auto-prevent
non-billable overtime, "clients have saved up to $100,000/year"**. Features:
rules-based auto-scheduling, **self-scheduling** (guards claim open shifts), **shift
trading**, **shift posting** when a guard can't work, conflict detection,
certification-aware matching.

### 1.6–1.9 The rest of the field, briefly
- **GuardMetrics** (US) — guard tour via **RFID/NFC/QR**, and its headline
  feature is the **automated DAR email**: a branded Daily Activity Report
  delivered to the client at a chosen hour every day, with times, dates,
  locations and photos, plus a searchable DAR database per client.
- **OfficerReports** (US) — markets "Active Security Officer Tracking", i.e.
  continuous verification *instead of* checkpoint scanning; gives the tour system
  away free to pull agencies onto its reporting product.
- **THERMS**, **Resgrid**, **SequriX**, **GMS Cloud** — the mobile-patrol /
  alarm-response tier: dispatch inbound calls, **track patrol vehicles**,
  **optimise a night's route across many sites with randomised visit times**,
  re-plan when an alarm call pulls an officer off route, SLA monitoring, per-visit
  billing. Resgrid notably prices **per entity, not per guard**.
- **Guardhouse** (AU, but bought **Mobohubb** to enter the US) — the one that does
  **subcontractor management** properly: identify subbie guards, custom rates per
  service level and site, send **work orders to the subcontractor for approval**.
  Also a **complex award/EBA interpreter** for pay rules. Both are directly
  relevant to India.
- **TeamBridge**, **Snap Schedule 365**, **InTime** — scheduling with formal
  **shift-bidding engines** (eligible guards bid, rules pick the winner).

### 1.10 Prices, for calibration
US unarmed guard bills at **$27–50/hr** against a fully-loaded cost of
**$23–25/hr**: ~20–30% gross, **6–15% net**. One officer is $40–60k of annual
revenue. Software at $20–40/guard/month is a rounding error against that, which
is why US vendors can charge 20–40x Raksham's ₹83–250/user/month. India's margins
are thinner, so the Indian equivalent of "worth paying for" is software that
*moves* the margin — billing accuracy, OT control, attrition — not software that
reports on it.

---

## 2. Gap table

Legend: ✅ have · ◐ partial · ❌ absent. "Raksham" column from our own crawl.

| # | Capability | GuardWatch AI | Raksham | US standard |
|---|---|---|---|---|
| 1 | GPS/selfie attendance, geofence | ✅ | ✅ | ✅ |
| 2 | Live map, trails, replay | ✅ | ✅ | ✅ |
| 3 | Roster + patterns + month view | ✅ | ◐ | ✅ |
| 4 | Patrols/tours (GPS) | ✅ | ❌ | ✅ |
| 5 | Tasks + photo proof + templates | ✅ | ✅ | ✅ |
| 6 | Incidents | ✅ | ◐ | ✅ |
| 7 | Leave + balances | ✅ | ◐ | ✅ |
| 8 | Reports + CSV/XLSX export | ✅ | ✅ | ✅ |
| 9 | Role × scope RBAC, audit log, multi-tenant console | ✅ (ahead) | ❌ | ◐ |
| 10 | Anti-tamper / outage / location-off | ✅ | ✅ | ◐ |
| 11 | **Clients & contracts as entities** | ❌ (`sites.client_name` is free text) | ❌ | ✅ |
| 12 | **Rate cards, bill rate vs pay rate, OT multipliers** | ❌ | ❌ | ✅ |
| 13 | **Invoicing from verified attendance + collection** | ❌ | ❌ | ✅ |
| 14 | **Post-level / client-level profitability** | ❌ | ❌ | ✅ |
| 15 | **Payroll engine + statutory filings** | ❌ | ◐ (claimed) | ✅ |
| 16 | **Licence/certification eligibility + expiry blocking** | ❌ | ❌ | ✅ |
| 17 | **Training / LMS, mandated hours** | ❌ | ❌ | ✅ |
| 18 | **Client portal + auto-DAR** | ◐ (guard profile share only) | ❌ | ✅ |
| 19 | **Post orders (versioned, acknowledged)** | ❌ | ◐ (preset tasks) | ✅ |
| 20 | **Pass-down / handover register** | ❌ | ◐ (briefing task) | ✅ |
| 21 | **Open-shift marketplace / bidding / trades** | ❌ | ❌ | ✅ |
| 22 | **OT prediction & prevention engine** | ❌ | ◐ (OT approval) | ✅ |
| 23 | **Panic / man-down / dead-man timer, escalation** | ❌ | ◐ (sleep alert) | ✅ |
| 24 | **Dispatch + mobile patrol + vehicles + SLA timers** | ❌ | ❌ | ✅ |
| 25 | **NFC/QR/beacon checkpoints** | ❌ (GPS only) | ❌ | ✅ |
| 26 | **Recruiting funnel + digital onboarding** | ◐ (invites) | ❌ | ✅ |
| 27 | **Equipment/uniform issuance + deduction** | ❌ | ❌ | ✅ |
| 28 | **Subcontractor / partner-agency coverage** | ❌ | ❌ | ◐ |
| 29 | **Public API, webhooks, accounting integrations** | ❌ | ❌ | ✅ |
| 30 | **Real AI (not branding)** | ❌ | ❌ (name only) | ◐ (emerging) |
| 31 | **Visitor / gate / parking register** | ❌ | ❌ | ◐ |
| 32 | **Client-facing BI / QBR pack** | ◐ (internal reports) | ◐ | ✅ |

Rows 1–10 are where both we and Raksham compete, and we already win most of
them. **Rows 11–32 are the report.**

---

## 3. The twelve gaps that matter, with the India design

Ordered by (value to the agency owner) × (distance from what we already have).

### Gap 1 — Clients, contracts and rate cards
`sites.client_name text` is the entire extent of our customer model. Everything
downstream — invoices, margin, SLA, renewal risk — is impossible without a real
`clients` → `contracts` → `contract_posts` chain.

The India shape: a contract covers N posts per site, each post has a **skill
grade** (unarmed guard / head guard / supervisor / gunman / housekeeping, because
Indian agencies sell mixed manpower), a **shift pattern** (12-hour day/night is
the norm, not 8), a **bill rate** usually quoted as ₹/post/month rather than
₹/hour, a **minimum-wage floor by state and skill category** that the bill rate
must legally clear once PF/ESIC/bonus/relief are loaded, **escalation clauses**
(annual, or auto on VDA revision — this is a *huge* unbilled-revenue leak:
minimum wage revises, the agency's cost rises, nobody re-bills the client),
deduction rules for vacant posts, and a **GST treatment** flag (forward charge vs
reverse charge — RCM applies to security services supplied to a body corporate by
a non-body-corporate, and agencies get this wrong constantly).

Why it's first: it unlocks gaps 2, 3, 4, 9 and 12 and it is mostly schema +
forms, not research.

### Gap 2 — Invoicing from verified attendance
This is the single highest-value thing we can build, because **we already own the
hard input**. We know, per post per day, whether a warm body was inside the fence
for the contracted hours. Nobody in the Indian market can assemble an invoice
from *verified* presence; they all bill from the roster and argue later.

Build: monthly bill run per contract → per-post reconciliation (contracted shifts
vs attended / vacant / relieved / half-day) → deduction lines the client agreed to
→ OT and festival/national-holiday double-wage lines → GST → **e-invoice IRN +
QR for ≥₹5 crore turnover clients**, e-way irrelevant → PDF + Tally/Zoho export →
payment link → **ageing and collection follow-up**.

The feature that sells it in one sentence: *"the vacant-post deduction appears on
the invoice automatically, with the attendance evidence attached, so the client
stops disputing and you stop writing off."*

### Gap 3 — Payroll with Indian statutory compliance
TEAM and Belfry both concluded payroll must be native. For India it is harder
*and* more defensible, because the compliance surface is brutal and no
guard-specific product does it well:

- **Minimum wages** per state × zone × skill category × with-VDA, revised
  half-yearly. Needs to be a versioned rate table with effective dates, not a
  number in a settings page.
- **PF** — 12%+12%, ₹15,000 ceiling, UAN, monthly **ECR text file** generation.
- **ESIC** — 0.75% employee / 3.25% employer up to ₹21,000, monthly return.
- **Professional tax** — per-state slabs.
- **TDS**, Form 16, Form 24Q.
- **Bonus** (Payment of Bonus Act, 8.33%), **gratuity** accrual, **leave
  encashment**, **National & Festival Holidays Act** double wages.
- **OT at 2x** and the weekly-hours/rest-day rules.
- **Registers and returns**: wage register, muster roll, OT register, Form XII,
  the Contract Labour (R&A) Act Form registers, Shops & Establishments filings.
  These are exactly what a labour inspector asks for, and exactly what agencies
  fake up the night before.
- Payout: bank file / UPI-batch / NPCI payouts, **salary slip in Hindi/regional
  language on WhatsApp**.

Even shipping *just the registers and the ECR/ESIC files* off our existing
attendance data would be a product people pay for on its own.

### Gap 4 — Post-level profitability
`revenue_per_post − (wages + PF + ESIC + bonus/gratuity accrual + uniform +
supervisor overhead allocation)`, per post, per site, per client, per month, with
OT as a visible margin leak. US vendors treat this as table stakes; in India
owners genuinely do not know which of their 40 sites loses money. A single
"sites ranked by margin, with the three reasons each one is bleeding" page would
be the most screenshotted thing we ship.

### Gap 5 — PSARA & eligibility compliance cockpit
Our `guard_documents` has `aadhaar, pan, police_verification, marksheet,
guard_kyc, other` with a `pending/verified/rejected` status — that's a document
store, not a compliance engine. Migration `0014_drop_kyc_roster_block` removed
the hard block, which was the right UX call but left nothing in its place.

What the US equivalent does and we should: an **eligibility rule set** evaluated
per guard per assignment, with 90/60/30-day expiry alerts and a **warn-at-assign**
(not block) with an override that lands in the audit log. India's rule set:

- Agency **PSARA licence** validity *per state* we operate in (licences are
  state-scoped — an agency deploying across a border without one is the single
  biggest existential risk to our customers).
- Guard: age bounds, **police verification not older than N**, **medical fitness
  certificate**, **training completion (the Model Rules' 100/160-hour syllabus,
  refresher hours)**, ex-servicemen status, armed-guard arms licence where
  applicable, Aadhaar/UAN/ESIC-IP present.
- Client-specific requirements (a bank or airport post demands more than a
  residential gate).
- Output: a **compliance score per site and per contract**, and an
  **inspection-ready pack** exportable as a zip. That last one is the
  demo-closing feature.

### Gap 6 — Client portal + the auto-DAR, over WhatsApp
In the US a branded client portal has gone from nice-to-have to a **contract
requirement**, and GuardMetrics' whole business is "a branded DAR lands in the
client's inbox at 7am". We have `share/[token]` for a *guard profile* — the
plumbing exists, the product doesn't.

India twist: don't lead with a portal, lead with **WhatsApp**. A daily 7am
message to the facility manager — posts manned 11/12, one vacant 02:00–06:00 with
a reliever at 04:10, 3 patrol rounds complete, 1 incident, photos — with a link
into a read-only portal for history, DARs, incidents, guard profiles (we already
have profile shares), and the current month's attendance. This is simultaneously
the **retention** feature and the **sales** feature: it's what the prospect's
incumbent can't do.

### Gap 7 — Post orders and pass-down
Cheapest significant wins on the list.

**Post orders**: a versioned site instruction book — standing orders, emergency
contacts, escalation matrix, do/don't, client-specific SOPs — pushed to the guard
app, **acknowledged with a timestamp at first shift on a new version**, available
offline, in the guard's language. The acknowledgement record is what the agency
shows when a client says "your guard didn't know the procedure".

**Pass-down / handover register**: the outgoing guard records what the incoming
guard must know (keys, visitors expected, equipment faults, open incidents); the
incoming guard acknowledges. This is the physical register that exists at every
real Indian gate and is on nobody's software.

### Gap 8 — Shift fill: open-shift marketplace, trades, and OT prevention
The daily 6am fire at every Indian agency is a no-show, solved today by the
supervisor phoning fifteen people. Celayix sells *only* this and justifies itself
with "$100,000/year of avoided non-billable OT".

Build: when a shift goes unfilled or a check-in is missed past threshold, compute
**eligible + available + nearby + not-into-OT** guards and broadcast the open
shift to their app and WhatsApp; first acceptance wins; roster, OT, and the
client-side vacancy note all update themselves. Add guard-initiated **shift
swaps** with supervisor approval, and a **reliever pool** per cluster. Plus the
preventive side: flag before the roster is published that a guard will cross
48/60 hours, has no weekly off, or has back-to-back doubles.

This is also the strongest **retention** feature — agency attrition in Indian
guarding runs 60–100%+, and schedule agency is what the US literature identifies
as the fix.

### Gap 9 — Recruiting funnel and digital onboarding
Given that attrition, hiring is a continuous production line, not an HR event.
Our `guard_invites` is the seed. Needed: a **pipeline** (sourced → screened →
docs → verification → trained → inducted → deployed) with aging per stage,
**referral bonus tracking** (how Indian agencies actually hire), **DigiLocker /
Aadhaar-based document pull**, police-verification request tracking with the
local station, a **joining-to-first-shift clock**, and **cost-per-hire**. The US
insight worth stealing: 20% of turnover happens in the first 45 days, so measure
and attack day-1-to-day-45 survival explicitly.

### Gap 10 — Guard safety: panic, man-down, dead-man timer
Raksham's "random sleep alert" is a *surveillance* feature pointed at the guard.
The US equivalent — panic button, hazard-alert timer, man-down, lone-worker
monitoring — is a *protection* feature pointed at the guard's risk, and it is an
easier sell both to the guard and to the client's safety team. Build: SOS in the
app (and a hardware-button/volume-key fallback), configurable **check-in timer
that escalates if unanswered**, fall/no-motion detection, an **escalation matrix**
(supervisor → area manager → client contact → police) with acknowledgement
tracking, and a live incident console. Keep the alertness check, but reframe it
as a welfare check with the escalation attached.

### Gap 11 — Mobile patrol / supervisor-visit dispatch
A large slice of Indian agency revenue and SLA obligation is the **supervisor's
night round** — visit N sites between 22:00 and 06:00 at non-predictable times.
Today it's verified by a signature in a register. The US mobile-patrol tier
(THERMS, SequriX, Resgrid, GMS) already solved exactly this: **route plans with
randomised visit times, GPS-verified arrival, per-visit reporting, SLA timers,
re-planning when a call pulls the officer away, vehicle tracking, and per-visit
billing**. We have patrol routes *within* a site; this is patrols *across* sites,
and it's mostly a reuse of what we have.

### Gap 12 — Real AI, with an audit trail
Raksham has "AI" in its name and zero AI in its product. That is the loudest
unclaimed position in the Indian market, and the US has shown exactly which
applications land:

1. **Voice-to-incident/DAR in Hindi and regional languages** — the guard speaks,
   we produce a clean, client-ready, English-and-vernacular report. Copy
   ReportPro's discipline: keep the raw audio and the original text, log every
   AI edit, show original-vs-enhanced side by side. Without that audit trail the
   report is worthless in an insurance claim.
2. **Selfie face-match + liveness** — buddy punching and photo-of-a-photo are the
   #1 attendance fraud in India and *nobody* in this segment verifies identity,
   only that *a* face appeared. This is a trust moat for the client portal.
3. **Missed-clock-in auto-resolution** (Belfry's "Belle Dispatcher") — on a missed
   check-in, auto-call/WhatsApp the guard, then the standby, then the supervisor,
   and log the resolution. Turns our existing monitor events into actions.
4. **Attrition risk scoring** — predict which guards quit in 30 days from OT
   load, pay volatility, commute, shift-pattern churn, leave-rejection history.
   Directly attacks the industry's worst number.
5. **Route/attendance anomaly detection** — "this trail is physically
   implausible", "this guard's fence dwell pattern changed", on our existing
   `location_pings`.
6. **Natural-language ops query** over our own data — "which sites are short
   tomorrow night and who's eligible" — which is cheap for us given the schema is
   already clean and RLS-scoped.
7. **Schedule optimisation** — fill the month at minimum OT subject to
   eligibility, rest rules and travel.

### Also-missing, lower priority but cheap
- **NFC/QR/beacon checkpoints** alongside GPS (needed indoors, in basements,
  in high-rises — GPS-only patrols are not credible in a mall or a tower).
- **Equipment & uniform** issuance, return, and payroll recovery.
- **Subcontractor/partner-agency** coverage with work-order approval (Guardhouse's
  model) — Indian agencies sub out of-town posts constantly.
- **Visitor/gate register, vehicle in-out, parking** — the guard is already at the
  gate holding a phone; this is a free upsell to the client and the data is
  genuinely valuable to them.
- **Public REST API + webhooks**, and integrations to **Tally, Zoho Books, the GST
  portal, WhatsApp Business API, Razorpay/payout rails, and gate biometric/face
  devices** — the Indian equivalents of QuickBooks/ADP.
- **Client-facing BI / QBR pack** — a monthly one-click review deck per client
  (SLA attainment, incidents by type, response times, manning %) that the agency
  presents at renewal.
- **Earned-wage access / advance against wages** — Indian guards routinely take
  advances from the supervisor in cash; formalising it is both a welfare feature
  and a retention lever.

### And the strategic one: working capital
US analysis of this industry keeps landing on the same structural fact: **payroll
is 70–85% of revenue, guards are paid monthly, clients pay net 45–60**. Indian
agencies live or die on this float. Belfry's answer was to own money movement
(embedded payroll + ACH collection). If GuardWatch AI holds verified attendance,
signed contracts, rate cards and issued invoices, it holds the **best
underwriting data in the market** for invoice discounting. That is a revenue line
an order of magnitude above ₹250/user/month, and it is unreachable for Raksham
because they don't have contracts or invoices. Worth noting now even if it's not
built for two years — because gaps 1, 2 and 3 are the prerequisites either way.

---

## 4. What this means for the roadmap

**Tier 1 — the wedge (build next; makes us a different category from Raksham).**
Clients/contracts/rate cards → invoicing from verified attendance → post-level
margin. All three sit directly on data we already have. Nothing else on this page
changes the sales conversation as much, because it moves the owner from "nice
tracking app" to "this is how I bill and how I know what I earn".

**Tier 2 — the moat (compliance + the client).** PSARA/eligibility cockpit with
the inspection-ready export; statutory payroll starting with registers and
PF-ECR/ESIC files; the WhatsApp daily DAR + read-only client portal. These are
what make the agency unable to leave and what the client starts demanding of
competitors.

**Tier 3 — the daily operations win.** Open-shift fill + swaps + OT prevention;
post orders with acknowledgement; pass-down register; panic/man-down with
escalation; cross-site supervisor dispatch. Mostly reuse of existing primitives,
very high perceived value per unit of work.

**Tier 4 — the differentiators nobody in India has.** Voice-to-report in
vernacular with a full AI audit log; face-match + liveness on selfies;
auto-resolution of missed check-ins; attrition risk; NL query over ops data.
Lands the "AI" claim Raksham only borrowed.

**Deliberately not building**: autonomous patrol robots, drone-as-first-responder,
video analytics/remote guarding, GSOC/command-centre for enterprise end-clients.
Those are the US's *other* industry (Verkada, Ambient, HiveWatch, Scylla) selling
to the people who *buy* guarding, not the agencies that *supply* it. Integrate
with cameras eventually; never compete with them.

**One framing to keep**: Raksham, and every Indian competitor we've seen, sells
*attendance*. The US market long ago learned that attendance is the cheap,
churny, commodity tier, and that the business is **the money and the compliance
sitting on top of verified attendance**. We've already built a better verified-
attendance layer than Raksham. The 2x–3x is not more of it — it's everything
that layer makes possible and that we haven't built yet.

---

## 5. Sources

Trackforce / TrackTik: [capabilities checklist](https://www.trackforce.com/resources/blog-articles/complete-guide-to-security-company-software-essential-capabilities-checklist/) ·
[platform](https://www.trackforce.com/) ·
[guard tour](https://www.trackforce.com/products/tracktik/security-guard-tour-system/) ·
[dispatch & SLA](https://www.trackforce.com/products/tracktik/security-guard-dispatch/) ·
[asset tracking](https://www.trackforce.com/products/tracktik/asset-tracking/) ·
[ReportPro AI](https://www.trackforce.com/reportpro-ai/) ·
[ReportPro launch](https://www.helpnetsecurity.com/2025/09/26/trackforce-reportpro-ai/) ·
[integrations](https://www.trackforce.com/products/integrations/) ·
[TrackTik vs Belfry vs WinTeam](https://www.tracktik.com/resources/blog-articles/security-guard-business-administration-software-compared-tracktik-vs-belfry-vs-winteam/)

TEAM Software: [security guard software](https://teamsoftware.com/industries/security-guard-software) ·
[WinTeam operations](https://teamsoftware.com/software/winteam/operations-management-software/) ·
[eHub portal](https://teamsoftware.com/winteam/ehub) ·
[best ERP for security companies](https://teamsoftware.com/blog/best-software-for-security-companies) ·
[WinTeam review](https://www.contractorsoftwarehub.com/winteam-review/)

Belfry: [product](https://www.belfrysoftware.com/) ·
[operations](https://www.belfrysoftware.com/operations) ·
[$12M Series A](https://www.alleywatch.com/2025/01/belfry-security-operations-platform-guard-management-business-jordan-wallach/) ·
[Crunchbase](https://www.crunchbase.com/organization/belfry-3b43) ·
[pricing guard contracts 2026](https://www.belfrysoftware.com/blog/how-to-price-security-guard-contracts-in-2026) ·
[licence requirements by state](https://www.belfrysoftware.com/blog/security-guard-license-requirements-by-state)

Silvertrac: [product](https://www.trackforce.com/products/silvertrac/) ·
[dispatch](https://www.silvertracsoftware.com/smarter-security-dispatch) ·
[pricing strategies](https://www.silvertracsoftware.com/extra/3-pricing-strategies) ·
[profile](https://www.softwareadvice.com/cmms/silvertrac-software-profile/)

Scheduling / shift bidding: [Celayix](https://www.celayix.com/industries/security-guard-officer-scheduling-software/) ·
[Snap Schedule 365](https://www.snapschedule.com/industry/security-guard/) ·
[TeamBridge on shift bidding & retention](https://www.teambridge.com/blog/security-guard-retention-shift-bidding-scheduling) ·
[InTime](https://intime.com/scheduling-software-security/)

SMB / patrol tier: [GuardMetrics DAR](https://guardmetrics.com/security-daily-activity-report-dar/) ·
[GuardMetrics compliance](https://guardmetrics.com/security-guard-compliance-software/) ·
[GuardMetrics guard tour](https://guardmetrics.com/guard-tour-system-security-software/) ·
[OfficerReports](https://officerreports.com/guard-tour-tracking-software.html) ·
[GuardsPro client portal](https://support.guardspro.com/hc/en-us/articles/27192416790043-GuardsPro-Quick-Start-Guide-for-Client-Web-Portal) ·
[THERMS](https://www.therms.io/) ·
[SequriX dispatch](https://www.sequrix.com/product/security-dispatch-software/) ·
[Resgrid patrol](https://resgrid.com/solutions/security-patrol) ·
[Novagems lone worker](https://novagems.com/guard-tour-tracking-and-lone-worker-protection/) ·
[Guardhouse acquires Mobohubb](https://www.guardhousehq.com/blog/guardhouse-acquires-mobohubb-strengthening-its-u-s-security-workforce-platform) ·
[Guardhouse how it works](https://getguardhouse.com/au/howitworks/)

Unit economics: [bill-rate breakdown](https://www.overtonsecurity.com/how-do-security-guard-services-get-to-a-bill-rate-for-their-services/) ·
[US 2026 pricing guide](https://www.hiresecuritynow.com/blog/how-much-does-security-cost) ·
[profit margins](https://dojobusiness.com/blogs/news/private-security-company-profit-margin) ·
[working capital / net-30 gap](https://axiantpartners.com/working-capital-loans/articles/security-guard-company-working-capital/)

India compliance: [payroll for PSARA firms](https://futurexsolutions.com/payroll-outsourcing-security-companies-india/) ·
[payroll compliance 2026](https://futurexsolutions.com/payroll-compliance-india-2026/) ·
[PF & ESIC rules](https://www.mewurk.com/blog/pf-esic-compliance-india) ·
[security service agreement & wage code](https://evaakil.com/security-service-agreement-india/) ·
[PSARA eligibility, wages, 100-hour training](https://jobs.sabapna.com/security-guard-jobs-2026-psara-eligibility-minimum-wages-100-hour-training-and-how-to-apply/)

Hiring & AI context: [ATS for security hiring](https://www.beghr.com/services/applicant-tracking-system/applicant-tracking-for-security) ·
[AI in the guard industry 2026](https://novagems.com/ai-in-security-guard-industry-2026/) ·
[Verkada 2026 predictions](https://www.verkada.com/blog/7-predictions-for-the-physical-security-industry-in-2026/) ·
[physical security trends 2026](https://www.alertmedia.com/blog/physical-security-trends/)
