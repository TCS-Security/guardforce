# Guard Management Product — Founder's Notes (Structured)

> **Source**: Google Doc (shared 2026-09-13), raw working notes in Hinglish.
> **Related docs**: `raksham-ai-product-spec.md` (competitive crawl), `prd-mvp.md` (MVP PRD).
> Original notes cleaned & structured below; Hindi phrases translated, all substance preserved verbatim in intent.

---

## 1. Reference Players (competitive set named in doc)

- **Shivit**
- **Ivisit**
- **Raksham**
- **Security Forces**

*(Guard-force management / security agency software landscape in India — Raksham already deep-dived in the spec doc; Shivit, Ivisit, Security Forces are additional comps to research.)*

---

## 2. Product Concept — Two Sides

| Side | Description |
|---|---|
| **Guard App** | Guard logs in to the mobile app; attendance & tracking enforced from the guard's phone |
| **Agency CRM / Dashboard** | Agency adds the guard to their dashboard; collects & manages all guard details, sites, shifts, verification |

### Guard login → registration data (CRM collects)
- Name
- Phone No. *(with OTP verification)*
- Shift check-in time
- Supervisor
- Site
- Checkout time
- Location
- Photo verification

---

## 3. CRM Requirements

### 3.1 New Site
| Field | Notes |
|---|---|
| Name of site | |
| Location of site | |
| Perimeter of site | Optional |
| No. of guard(s) required | Staffing level |
| Shift time required | |

### 3.2 Guard Profiling (Add Guard — full KYC)
| Document / Field | Required? |
|---|---|
| Name | ✅ |
| Phone No. | ✅ |
| Aadhaar Card | ✅ |
| PAN Card | ✅ |
| Police Verification Document | ✅ |
| 10th / 12th Marksheet | Optional |
| Guard KYC | ✅ |
| Post of guard | ✅ (designation at site) |

> *Guard profiling must be complete* — an incomplete profile = not deployable.

---

## 4. The 6 Core Questions the Product Must Answer

1. **Did my guards reach the site?** — mere guards site pr gye ki nhi
2. **Did they stay the full time?** — agar gye toh pure time reh ki nhi
3. **Did patrolling happen?** — patrolling hui ki nhi
4. **How long were breaks?** — break kitna liya (kitne time bahar tha break pr)
5. **Were they sleeping on duty?** — were they sleeping or not?
6. **Is there a proper guard database?** — systematic storage & management; guard ki information ek jagah sahi-salamat, accessible, platform pe ho, **aur shareable bhi ho** (safe in one place, accessible, platform-based, and shareable — e.g., with clients)

---

## 5. Dashboard & Tracking Rules (hard enforcement model)

1. **Guard location must be tracked continuously** — guard **cannot turn location off**.
2. **If location is turned off → the shift is NOT counted** (*"shift maani nhi jayegi"*).
3. **Attendance marking requires BOTH:**
   - Photo upload **once at shift start**, AND
   - Presence within the site's **geolocation/geo-fence**
   → Only then is attendance marked.
4. **Live tracking during shift timings**: where the guard was, at what time, and whether they went out of the site.
5. **Leave Management** *(named as a module — software for leave)*
6. **Guard Attendance Analytics** *(named as a module — analytics dashboard)*

---

## 6. New Requirements vs. `prd-mvp.md` (deltas to fold into the PRD)

| # | New / stricter requirement | Current PRD status | Suggested action |
|---|---|---|---|
| 1 | **Deep guard KYC**: Aadhaar, PAN, police verification, marksheet (opt.), guard KYC, post | PRD has generic "photo ID upload" in employee profile | Extend F1: structured guard profile with typed document slots + profile-completion gating |
| 2 | **Location-off ⇒ shift not counted** (hard rule) | PRD ATT-3 blocks check-in and flags `TAMPER_SUSPECTED`, but doesn't void the shift | Decide policy: default = shift voided unless supervisor overrides with reason. Align with "trust score" |
| 3 | **Patrolling as first-class concept** (not just a task) | PRD covers it via seeded task templates ("patrol round") | Consider a dedicated Patrol module: routes/checkpoints + proof (P1) |
| 4 | **Break/outside-time tracking** | PRD explicitly deferred breaks to P1 | Keep at P1 but note doc treats it as core question #4 |
| 5 | **Sleep detection** | PRD P1 (random alertness checks) | Confirmed as P1 priority by doc (question #5) |
| 6 | **Shareable guard profile** (share with clients — "shareable bhi ho") | PRD deferred client-site portal to open question #3 | Upweight: shareable KYC/profile link is a cheaper win than full client portal |
| 7 | **Leave management + attendance analytics** as named modules | PRD P1 (leave/OT) and implicit in reports | Confirm both in P1 |
| 8 | **OTP-based phone verification** at registration | PRD uses phone + PIN; OTP not explicit | Add OTP verification at onboarding (also strengthens KYC trail) |

---

## 7. Open Items from Notes

- Research the other 3 competitors: **Shivit, Ivisit, Security Forces** (feature/pricing scan like the Raksham crawl)
- Decide the **location-off policy** (hard void vs. flagged) — has payroll/legal implications
- Scope **patrol module** (checkpoints? QR/NFC at posts? GPS breadcrumbs?) — needs design
- **Shareable profile** format: link, PDF, or client login?
