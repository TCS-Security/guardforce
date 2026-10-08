# Shivaizer (Shivit Technologies): product teardown from the demo call

> Source: two phone recordings of one Microsoft Teams screen-share, Tue 6 Oct 2026, from
> ~6:35 PM IST (the app's own clock reads `06/10/2026 06:36 PM`). Presenter: **Shivit
> Technologies**. Attendees: **Piyush Khare**, **Shubh** (plus an "Arun" on the audio).
>
> | Part | Length | Teams timer | Drive id | Local copy |
> |---|---|---|---|---|
> | 1 | 14 min 16 s | 00:00 – ~15:35 | `1Wr0tNPp4jt5g0MMr-R9PPHldCPy06F_3` | `/tmp/drive-video/video.mp4` |
> | 2 | 9 min 00 s | ~15:44 – ~25:00 | `1HjM4ErcExBijyqnmMm660xeZXgGN5So-` | `/tmp/drive-video2/video.mp4` |
> | 3 | 8 min 47 s | ~24:49 – ~33:30 | `1yFt0n2zCQBRWDiwxIgNhuglXATtluEgJ` | `/tmp/drive-video3/video.mp4` |
>
> Part 3 was processed lightly (frames every 15 s in contact sheets, no frame-by-frame reading).
>
> **How this was extracted.** The phone was pointed at a laptop that was showing the Teams
> share, so the frames are small, tilted and partly blurred (part 1 is 478×850 portrait, part 2
> is 848×478 landscape). Screen text was read from frames sampled every 5 s. The audio is mostly
> Hindi, recorded off laptop speakers. It was machine transcribed and translated (§9), but the
> transcript is patchy, so **almost everything below comes from what was on screen**. Values
> marked `~` were only partly legible.

---

## 0. The short version

**Shivaizer** ("Shivaizer ERP" in its own footer) is a **campus / tech-park security
and visitor-management console**. It runs one multi-tenant office campus (here *Shivit
Noida Tech Park, Sector 62, Noida*). Its domain objects are:

```
Campus → Towers (buildings) → Floors (each with a QR + geofence checkpoint) → Tenant companies (suites)
                                   ↑
Guards (outsourced from agencies) → assigned to tower + floors + gates + shift + duty types
Visitors / contractors / material → gate passes & work permits, approved by the host tenant
Daily floor inspection            → 8-question checklist per floor, QR + GPS + photo proof
```

It is a different product from GuardWatch AI. GuardWatch AI serves the **security agency** that
employs guards across many client sites. Shivaizer serves the **facility / property side**:
one campus, its gates, its tenants, and the visitors and contractors who come through. Guards
appear in Shivaizer as a deployed resource with an agency name attached, not as payroll staff.

**Implementation maturity: a clickable front-end prototype, not a shipped product.** The
evidence:
- The browser URL is a **local file**:
  `file:///Users/macbook/Downloads/visitor-management%20test%20…html`. It is a single HTML
  file opened from Downloads, with no server or domain.
- Every form has **"Fill Sample"**, **"Reset/Clear Form"** and **"Auto-Gen"** helpers, and
  every list holds exactly 4 neat demo rows.
- The signed-in user is **"Suresh (GUARD)"**, yet the session moves freely through Admin
  and Master Data screens. Either role-based access is not enforced, or the role switcher is
  mocked.
- **Hardware is faked with "Simulate" buttons.** The QR scanner has `Simulate Physical QR Scan`,
  `Simulate Floor QR Scan (1st Floor)` and `Simulate Visitor Pass Scan (VIS-9021)`. The GPS step
  has `Simulate GPS Failure`. There is no phone app; the "guard" is the same browser tab.
- The live-photo step does open the laptop webcam (Chrome shows the camera-permission state and
  the widget goes `CONNECTING… → CAMERA OFF`), so that one is real browser code.
- State is client-side: approving a visitor flips the row and shows a toast, and the page
  forgets it on reload (not tested, inferred from the file URL).
- Opened and used live: Executive Dashboard, all Master Data screens, three Operations forms,
  the visitor approval / check-in / check-out flow (§6), the 4-step floor survey (§5), the
  watchlist, the notification centre, and the two audit ledgers with CSV export. Still
  **sidebar only**: Roles & Permission Matrix, Tower & Facility Setup, Security & Entry
  Policies, Alert & Trigger Config, System Audit Trail, User Profile & Switcher, GPS Geofence
  Validator, Live Photo Evidence Desk, Active Shift Roster, Assign Security Personnel, and
  every item under Reports. Part 3 (§6A) added the incident log and the radar / breadcrumb page.
- **Extras the prototype fakes:** the radar is a hand-placed schematic (not a map), the
  breadcrumb is a checkpoint-event table, and every incident summary is the same placeholder.

The UI is dense and fairly polished: blue sidebar, white cards, status pills, form
sections numbered 01–10 with a coloured tag on each. It reads like an AI-generated
admin prototype.

---

## 1. Information architecture (full sidebar)

The header reads `NAVIGATION MODULES · 4 CATEGORIES`: **Admin, Master Data, Operations,
Reports**. Operations is the long one and is split into three labelled groups (Visitor
Operations, Floor Inspection, Security & Patrol). Part 2 of the recording scrolled the sidebar
far enough to see the lower groups.

The top bar shows the Shivaizer logo, a live date-time stamp, a **site switcher**
(`Shivit Noida ▾`), a notification bell with a red badge (2), and the user chip
`Suresh (GUARD)`.

| Category | Item | Shown in demo? |
|---|---|---|
| **Admin** | Executive Dashboard | ✅ opened (§2) |
| | Roles & Permission Matrix | sidebar only |
| | Tower & Facility Setup | sidebar only |
| | Security & Entry Policies | sidebar only |
| | Alert & Trigger Config | sidebar only |
| | System Audit Trail | sidebar only |
| | User Profile & Switcher | sidebar only |
| **Master Data** | Tower Master (Simple) | ✅ opened (§3.1) |
| | Floor Master (QR & GPS) | ✅ opened (§3.2) |
| | Tenant Master (Companies) | ✅ opened (§3.3) |
| | Guard Master (Personnel) | ✅ opened (§4.1) |
| | Assign New Guard | ✅ opened, walked through every section (§4.2) |
| | Checkpoint & Geofence | ✅ opened (§3.4) |
| | Inspection Checklist Master | ✅ opened (§5.1) |
| | Document & Gate Pass Master | ✅ opened (§6.1) |
| **Operations** (orange "live" badge) | *Visitor operations:* | |
| | New Gate Entry Desk | ✅ opened (§6.3) |
| | Create Document / Gate Pass | ✅ opened (§6.2) |
| | Document & Pass Register | ✅ same register as §6.1 |
| | Visitor Master Register | ✅ opened (§6.5, §6.7) |
| | Tenant Approval Queue | ✅ opened (§6.6) |
| | Live Check-in Desk | ✅ the Check-In / Check-Out buttons live in the register (§6.5) |
| | Visitor Check-Out Desk | ✅ confirmation modal (§6.5) |
| | Overstay & Watchlist | ✅ opened (§6.8) |
| | *Floor inspection:* | |
| | Daily Floor Survey Wizard (red "2 DUE" badge) | ✅ ran end to end (§5.2) |
| | QR Checkpoint Scanner | ✅ opened (§5.3) |
| | GPS Geofence Validator | sidebar only (the GPS step is inside the wizard) |
| | Live Photo Evidence Desk | sidebar only (the photo step is inside the wizard) |
| | Inspection Audit Records | ✅ opened, exported (§5.4) |
| | *Security & Patrol:* | |
| | Live Guard Radar Map | ✅ opened (§6A.2) |
| | Patrol Breadcrumb Timeline | ✅ opened, same page as the radar (§6A.2) |
| | Active Shift Roster | sidebar only |
| | Assign Security Personnel | sidebar only (probably the same form as Assign New Guard) |
| | Incident & SOS Log | ✅ opened, incident filed live (§6A.1) |
| **Reports** | Operational Reports | sidebar only |
| | Daily Visitor Report | sidebar only |
| | Patrol Compliance Report | sidebar only |
| | CSV Data Export Center | sidebar only |
| | Notification & Alert Center | sidebar only |

At the very bottom of the sidebar is a role switcher, `Switch Active Role (GUARD)`. This is
why the signed-in user is "Suresh (GUARD)": the same prototype is meant to be shown as
different roles.

The top-bar bell opens a **Security Notification Center** (§6.9).

---

## 2. Executive Dashboard

**Filters:** `F.Y. 2026-27 ▾` (financial-year selector) and
`PROJECT / FACILITY: (All) Shivit Noida Tech Park ▾`.
**Header actions:** `+ Create Document / Pass` (primary), `Live Radar Map`, `Export Reports`.

### 2.1 KPI tiles (each with a coloured top border and a comparison line)
| Tile | Value | Sub-label | Comparison |
|---|---|---|---|
| Total Visitors Today | **7** | Approved + Self Approved | ↗ +59.11% vs same period yesterday |
| Pending Approvals | **0** | Gate Queue | ↘ −98.64% vs same period last week |
| Floor Inspections | **1 / 4** | Completed Shifts | ↗ 75% Patrol Compliance |
| Active Guards Online | **3 / 4** | GPS Tracked | ↗ 100% Perimeter Guarded |

### 2.2 Visitor & Patrol Inflow Trend
A smooth line chart titled "Today vs Yesterday", labelled "Hourly Inflow". The x-axis runs
08 AM to 06 PM, with **12 PM (Peak)** marked. Two series: **Current Shift** (solid, area-filled)
and **Baseline** (dotted).

### 2.3 Visitors by Tenant Facility
Donut chart of approved and checked-in visitors, **7 TOTAL VISITS** in the centre, with a
`Share` link. Split: Shivit HQ 40%, Apex Fin 30%, Regus 20%, Novus 10%.

### 2.4 On-Duty Security Personnel (`Radar Map →`)
| Guard (ID · post) | Sector | Battery | Status |
|---|---|---|---|
| Suresh Kumar (GRD-101 · 1st Floor Corridor A) | Ground & 1st Floor | 88% | ● ONLINE |
| Vikram Singh (GRD-102 · 2nd Floor Fire Exit) | 2nd & 3rd Floor | 74% | ● ONLINE |
| Ramesh Yadav (GRD-103 · Gate 1 North Booth) | Main Gate & Parking | 95% | ● ONLINE |
| Dinesh Patil (GRD-104 · Guard Room B1) | Basement & Electrical | 42% | ○ OFFLINE |

**Phone battery per guard** is a first-class column. One attendee asked about it on the call (§9).

### 2.5 Daily Inspection Compliance (`Surveys →`)
| Floor | Code | Status | Patrolled |
|---|---|---|---|
| Ground Floor | GF-MAIN | ✓ COMPLETED | Today, 09:30 AM |
| 1st Floor | 1F-SHIVIT | ⏳ PENDING APPROVAL | Yesterday, 05:45 PM |
| 2nd Floor | 2F-APEX | ⏳ PENDING APPROVAL | Yesterday, 06:10 PM |
| 3rd Floor | 3F-NOVUS | ⚠ MISSED | 2 days ago |

The four inspection states are **Completed / Pending Approval / Missed** (plus not-yet-done).
A completed survey goes to a supervisor for approval.

---

## 3. Master Data: property model

### 3.1 Tower Master (Building & Infrastructure)
Breadcrumb `MASTER DATA › INFRASTRUCTURE`. Description: *"Manage campus towers, blocks,
physical addresses, floor counts, capacity and incharge contact details."*

- **Header actions:** `Add New Tower`, `Campus Profile`, `Manage Gates (4)`, `Export JSON`.
- **Summary cards:**
  - Campus Name: *Shivit Noida Tech Park (Campus Alpha)*, Plot 42, Sector 62, Noida, UP 201309, tagged `SITE-ALPHA`.
  - Towers Registered: **4 Towers**, 4 Active.
  - Units / Suites Capacity: **86 Total Units**.
  - Security & Gates: **4 Active Gates**.
- **Tower Master Directory (4 Towers):** search box, `All Categories` and `All Statuses`
  filters, and a **grid/table view toggle**. Each card shows code, status pill, name, type,
  address, floors, capacity, incharge name and phone, a one-line description, and Edit /
  Details / Delete.
  - `TWR-A` Tower A (North Wing): Commercial IT Tower, 4 floors (~), 36 units (~), incharge Mukesh Sharma (~).
  - `TWR-B` Tower B (South Wing): Corporate & Financial Tower, 24 units (~), incharge Sunil Verma (~).
  - `TWR-C` Tower C (Executive & Co-Working): 18 units (~), incharge Deepak Tyagi (~).
  - `BSMT-01` Basement & Utility Block: 2 floors, 8 units (~).
- **"Add New Tower Master (Simple Details)" modal** (with a "New Block Form" hint banner):
  Tower/Block Name\*, Tower Code\*, Tower Address / Campus Location\*, Total Floors\*,
  Total Units / Offices Capacity\*, Tower Incharge / Contact Person, Contact Phone / Mobile,
  Tower Category / Type\* (select), Operational Status\* (default *Active & Operational*),
  Brief Description / Notes. Buttons: Cancel, `Save & Add Tower`.

### 3.2 Floor Master (QR & GPS): "Building Floor & Geofence Checkpoints"
In Shivaizer, each floor doubles as an inspection checkpoint with its own GPS fence and QR code.

| Floor | Code | Wing | Registered GPS | Radius | QR | Status |
|---|---|---|---|---|---|---|
| Ground Floor (Lobby & Parking) | GF-MAIN | North Wing | 28.5355° N, 77.3910° E | ±40 m | View QR Pass | Completed |
| 1st Floor (Shivit Tech HQ) | 1F-SHIVIT | North Wing | ~28.5356° N, 77.391x° E | ±35 m | View QR Pass | Pending Approval |
| 2nd Floor (Apex Financial) | 2F-APEX | South Wing | ~28.5355° N, 77.391x° E | ±35 m | View QR Pass | Pending Approval |
| 3rd Floor (Novus Innovations) | 3F-NOVUS | South Wing | ~28.5355° N, 77.391x° E | ±30 m | View QR Pass | Missed |

**"Add New Building Floor & Geofence Checkpoint" modal:** Floor Name\* (e.g. 4th Floor),
Floor Checkpoint Code\* (e.g. 4F-TECH), Building Wing / Tower (Master)\* (dropdown from
Tower Master), Geofence Radius (Meters) (e.g. 35), Registered Latitude (Optional, e.g. 28.5355),
Registered Longitude (Optional, e.g. 77.3914), Floor Description / Assigned Units (e.g. *AI &
Robotics Labs, Suites 401-410*). Button: `+ Save Floor Master`.

The geofence is a **circle (lat/lng + radius)**. Coordinates are typed in by hand; there is
no map picker.

### 3.3 Tenant Master (Companies): "Tenant Companies Directory"
| Tenant | Code | Floor & Unit | Contact Person | Phone & Email | Visitors Today |
|---|---|---|---|---|---|
| Shivit Technologies Pvt. Ltd. | SHIVIT-01 | 1st Floor (Suite 101-105) | Piyush Khare | +91 … / …@shivit… | 2 visitors |
| Apex Financial Services | APEX-02 | 2nd Floor (Suite 201-204) | Anita Sharma | +91 … / …@apexfin… | 2 visitors |
| Novus Innovations Corp | NOVUS-03 | 3rd Floor (Suite 301-306) | Rahul Verma | +91 … / …@novus… | 1 visitor |
| Regus Executive Suites | REGUS-04 | Ground Floor (GF Reception Desk) | Kavita Menon | +91 … / …@regus… | 2 visitors |

**"Add New Tenant Company Directory" modal** (filled in live during the demo): Tenant Company
Name\*, Tenant Code\* (e.g. TNT-05), Assigned Floor\* (dropdown from Floor Master, e.g.
*2nd Floor (Apex Financial)*), Unit / Suite Number\* (e.g. *Suite 205*), Primary Contact
Person\*, Phone Number\*, Official Email Address\*. Button: `+ Register Tenant`.

The tenant record is what visitor and gate-pass forms use to route an approval to a host
and to auto-fill the host contact.

### 3.4 Checkpoint & Geofence Master Registry (4 checkpoints)
A separate registry of named physical checkpoints, one per floor in the demo data.

| Checkpoint ID | Sector / Floor | Physical location | GPS | Radius | Action |
|---|---|---|---|---|---|
| CHK-GF-01 | Ground Floor | Main Entrance Lobby Turnstiles | 28.5355° N, 77.3910° E | ±40 m | QR Code |
| CHK-1F-02 | 1st Floor | North Wing Executive Entrance & Server Room | 28.5356° N, 77.391x° E | ±35 m | QR Code |
| CHK-2F-03 | 2nd Floor | South Wing Fire Exit Corridor | 28.5355° N, 77.391x° E | ±35 m | QR Code |
| CHK-3F-04 | 3rd Floor | Terrace & AHU Mechanical Room Entry | 28.5355° N, 77.391x° E | ±30 m | QR Code |

- **"Add New Inspection Checkpoint" modal:** Checkpoint Code\* (e.g. CHK-4F-05), Destination
  Floor (Master Dropdown)\*, Physical Checkpoint Location\* (e.g. *Server Room Rack A
  Entrance*), GPS Coordinates (Optional, e.g. `28.5355° N, 77.3914° E`), Geofence Radius
  (Optional, e.g. ±30m). Button: `+ Add Checkpoint`.
- **"Floor Physical Barcode QR" modal:** shows `Floor Identifier: CHK-GF-01` and a QR code,
  with a caption telling the user to print it and fix it at the floor checkpoint so guards can
  scan it from the app. Close button.

The design keeps both a **Floor Master** (floor = geofence + QR) and a **Checkpoint
Master** (checkpoint → floor + GPS + QR). The two overlap.

---

## 4. Guard management

### 4.1 Guard Master (Personnel)
- **Toolbar:** a search box for name, badge ID, phone, agency and location; `Status: All
  Statuses`; `Shift: All Shifts`; a `Quick Mode` toggle; the primary button `Assign New
  Security Personnel & Guard`.
- **KPI cards:**
  - Total Guards **4** (Master)
  - Active On Duty **3** (Live)
  - Gate Duty Deployed **2** (Gate)
  - Guard Patrols & Floors **1** (Patrol)
- **"Security Guard Directory & Active Duty Allocations" (4 Personnel)** with an `Assign
  Guard` button. Columns: Guard Profile (photo, name, role), Badge ID, Mobile Phone,
  Deployment & Post, Shift & Timing, Assigned Duties, Security Agency, Duty Status, System
  Status, Actions (**Dossier**, **Edit**).
  - Example row: Suresh Kumar, GRD-101, +91 98765 43210 (~), Tower A (North Wing), 08:00 AM–02:00 PM,
    Gate Duty + Visitor Verification, *SIS India Security Services*, `ACTIVE ON DUTY`, `ONLINE`.

### 4.2 Assign New Security Personnel & Guard: a 10-section onboarding form
Breadcrumb: `Shivaizer ERP › Security Management › Assign New Security Personnel & Guard`.
**Toolbar:** `← Back to Register`, `Fill Sample`, `Reset Form`, `Expand/Collapse All`.
Sections are collapsible and numbered, each with a coloured tag on the right. This screen
got the most demo time, from roughly 08:20 to 12:30 on the Teams timer.

**01 Basic Guard Details** (`IDENTITY MASTER`)
- Guard Photo (avatar upload, JPG/PNG up to 2 MB): `Take Camera Photo` / `Select from Gallery`
- Guard Full Name\*
- Guard Code / ID (Auto-Generated)\*: `SEC-GRD-425`, with an `Auto-Gen` button
- Guard Badge ID\* (e.g. GRD-105)
- Mobile Number (10 digits)\*
- Alternate Mobile Number
- Gender
- Date of Birth
- Joining Date\*
- Blood Group
- System Status\* (Active)

**02 Address & Emergency Contact** (`RESIDENCE & KIN`)
- Address Line 1\*, Address Line 2 (Apartment / Colony / Landmark)
- City (Noida)
- State (dropdown, *Uttar Pradesh*)
- Pincode (6 digits)\*
- Country (*India*)
- *Next of Kin / Emergency Contact Person:* Emergency Contact Name\*, Relationship\*
  (Spouse, Father, Mother, Brother, Sister, Guardian, Other Contact), Emergency Contact Number\*

**03 Building & Location Assignment** (`DEPLOYMENT`)
- Building / Site\*: *Shivaizer Tech Park Campus (Main Site)*, *Tower A (North Wing) (TWR-A)*,
  *Tower B (South Wing) (TWR-B)*, *Tower C (Executive & Co-Working) (TWR-C)*, *Basement &
  Utility Block (BSMT-01)*
- Location / Campus\*: *Main Campus – Sector 62, Noida*, *North Gate Plaza & Visitor Plaza*,
  *South Service Bay & Loading Docks*, *East Perimeter & Parking Zone*
- Floor / Sector (multi-select chips, with Select All / Clear All): Ground Floor (Lobby &
  Parking), 1st Floor (Shivit Tech HQ), 2nd Floor (Apex Financial), 3rd Floor (Novus
  Innovations), Basement B1 Parking, Terrace & Solar Deck
- Gate / Post (multi-select chips): Gate No. 1 (Main Entrance), Gate No. 2 (North Visitor
  Gate), Gate No. 3 (Service & Loading Bay), Parking Entry Boom Barrier, Main Lobby Reception Desk
- Assignment Start Date\*, Assignment End Date (Optional)

**04 Shift Assignment & Master Schedule** (`SHIFT MASTER SYNCED`)
- Info banner: *"Shift Master Integration: selecting any shift from the dropdown will
  automatically fetch start time, end time, and break duration from Shift Master."*
- Shift (From Shift Master)\*:
  - Shift A – Morning (08:00 AM–02:00 PM)
  - Shift B – General Day (09:00 AM–06:00 PM)
  - Shift C – Evening (02:00 PM–10:00 PM)
  - Shift D – Night Patrol (10:00 PM–06:00 AM)
  - Custom Shift
- Shift Type (*Fixed Shift*)
- Shift Start Time\*, Shift End Time\*
- Weekly Off (*Sunday*)
- Break Duration (*30 / 45 / 60 Minutes*)
- Picking a shift shows the toast *"Shift timings loaded from Shift Master: 09:00 AM –
  06:00 PM"*. This was demonstrated live.

**05 Duty Assignment (Multi-Select Roles)** (`MULTI-DUTY ACTIVE`)
Checkbox cards, each with a one-line description:
- Gate Duty
- Inspection Duty
- Visitor Verification
- Vehicle Entry / Exit Monitoring
- Material Entry / Exit Monitoring
- Fire & Safety Inspection
- Night Patrolling
- CCTV Monitoring
- Emergency Response
- Other Special Duty

Ticking a duty reveals a conditional configuration section (06).

**06 Conditional Gate Duty Configuration** (appears when Gate Duty is ticked)
- Assigned Gate\*: Gate No. 1 (Main Entrance)
- Gate Duty Type\*: *Entry & Exit Management*
- Vehicle Checking: *Yes – Mandatory Vehicle Inspection*
- Visitor Verification: *Yes – Govt ID & QR Verification*
- Material Checking: *Yes – Inward/Outward Slip Scanning*

**07 Employment & Security Agency Details** (`AGENCY / VENDOR`)
- Employment Type\*: *Security Agency (Outsourced Partner)*, presumably alongside an in-house option
- Security Agency\* (dropdown):
  - SIS India Security Services Pvt Ltd
  - G4S Secure Solutions India
  - Peregrine Guarding
  - two other agencies (~)
- Agency Employee ID (e.g. SIS-EMP-8821)
- Supervisor Name (e.g. *Inspector Ramesh Sharma*)
- Supervisor Mobile
- Contract Start Date, Contract End Date

**08 Documents & Background Verifications** (`COMPLIANCE`)
Each row has a title, a sub-caption, a status pill, the uploaded filename and a `Replace` /
`Attach` button. Rows:
- Government Photo ID Proof: *Uploaded & Verified*
- Address Proof: *Uploaded & Verified*
- Police Verification Certificate: *Uploaded & Verified*
- Security & Fire Training Certificate: *Uploaded & Verified*
- Security Agency Official ID Card: *Uploaded & Verified* (`SIS_Official_Card_2026.pdf`)
- Medical & Physical Fitness Certificate: *Uploaded & Verified*
- Other Document / Defence Ex-Serviceman Certificate: *Pending Upload*, "No file selected"

**09 Additional Information & Service History**
- Total Experience (Years) (e.g. 5)
- Previous Employer (e.g. *DLF CyberCity Commercial Security*)
- Operational Remarks / Special Certifications (free text, e.g. *"Certified First Aider and
  Fire Marshal. Top rated for visitor management hospitality and alert gate checking."*)

**10 Access & System Details** (`SYSTEM ACCESS`)
- Assignment Status\*: *Assigned* / *Unassigned (Reserve)*. A **reserve-pool** concept.
- Access Card Status\*: *Active* / *Inactive*. Physical access card.
- Biometric Enrolled\*: *Yes (Enrolled)* / *No*
- Mobile App Access\*: *Yes (Enabled)* / *No*. A guard app login exists, or is planned.

Footer: *"Shivaizer ERP: All mandatory fields marked with \* will be validated prior to
system onboarding."* Buttons: `Cancel`, `Save as Draft`, `✓ Save & Assign Guard`.
The presenter opened each dropdown in section 10 on screen.

---

## 5. Floor inspection (daily survey)

### 5.1 Inspection Checklist Master: "Daily Inspection Checklist Master Criteria" (8 criteria)
Columns: Code, Category (coloured tag), Inspection Question, Response Options, Mandatory.
`+ Add Checklist Item` button.

| Code | Category | Question | Response options | Mandatory |
|---|---|---|---|---|
| CHK-01 | CLEANLINESS | Floor and lobby floor cleanliness & dust control | OK / Not OK | REQUIRED |
| CHK-02 | COMMON AREA | Corridors, signage, and passage clear of debris | OK / Not OK | REQUIRED |
| CHK-03 | FIRE SAFETY | Fire exit doors unlocked and unblocked | Clear / Blocked | REQUIRED |
| CHK-04 | EMERGENCY ASSETS | Fire extinguishers pressure gauge in green zone | Operational / Due | REQUIRED |
| CHK-05 | ELECTRICAL | Electrical distribution boards locked and secure | Locked / Open | REQUIRED |
| CHK-06 | LIGHTING | Corridor & emergency exit lights functional | 100% OK / Faulty | REQUIRED |
| CHK-07 | INFRASTRUCTURE | Water leakage / plumbing damage inspection | None / Detected | REQUIRED |
| CHK-08 | SECURITY | Unattended baggage or suspicious perimeter alerts | None / Alert | REQUIRED |

Every question is a **binary pass/fail with domain-specific labels**. That makes it a
facility-management checklist (housekeeping, fire, electrical, plumbing), not just a
security one.

### 5.2 Daily Floor Survey & Security Patrol Schedule (demonstrated in part 2)
Sidebar item `Daily Floor Survey Wizard`, with a red `2 DUE` badge. The page opens with a
protocol banner: *every floor survey needs strict 4-step completion: (1) physical QR code scan
at the floor checkpoint, (2) GPS geofence radius validation, (3) live tagged photo snapshot
watermarked with the guard ID, (4) the infrastructure & safety checklist.*

**Floor cards**, one per floor, in a grid. Each shows the floor name and a status pill
(Completed / Pending Approval / Missed), Registered GPS, Geo-Fence Radius, Last Inspection,
and Assigned Inspector (*Suresh Kumar*). Button: `Start 4-Step Inspection Wizard`, or
`Re-Inspect Floor` once completed.

**The wizard** is a modal titled `Floor Survey: 1st Floor (Shivit Tech HQ)` with the subtitle
`Step N of 4 • Inspector: Suresh Kumar` and a four-dot stepper (QR Scan → GPS Radius → Live
Photo → Checklist). Walked through live by the presenter:
1. **Scan floor barcode / QR checkpoint.** A dark camera viewport with a scan line and a
   dashed target box labelled `Align with checkpoint QR 1F-SHIVIT`. Button `Simulate Physical
   QR Scan`. Success toast: *"QR Code Scanned: Floor 1F-SHIVIT verified!"*
2. **Geofence & GPS location validation.** A small table: Floor Registered GPS, Guard Current
   Device GPS, Maximum Allowed Radius (±35 m for this floor), Computed Geodesic Distance
   (~12 m), Geofence Verification (`PENDING CHECK`, then pass). Buttons `✓ Validate Location
   (Pass)` and `Simulate GPS Failure`.
3. **Live photo** with the same webcam widget as the visitor desk. Toast: *"Live photo
   captured with security watermark!"*
4. **Infrastructure & Safety Checklist.** The 8 criteria from §5.1 as numbered dropdowns, each
   defaulting to the good answer (OK / Clear / Operational / Locked / 100% OK / None / None).
   The presenter flipped answers to the bad value of each (`Not OK`, `Blocked`, `Due`, `Open`,
   `Faulty`, `Detected`, `Alert Raised`). A free-text **Patrol Remarks / Observations** box
   (sample: *"All emergency exits verified clear. Electrical DB panels secured."*). Green
   button `✓ Complete & Submit Floor Inspection Survey`.

After submit the card flips to **COMPLETED**, with *Last Inspection: Today, hh:mm* and the
button changes to Re-Inspect. Nothing in the demo showed a failed answer blocking submission,
forcing a photo, raising an alert or creating a task.

The dashboard's "Floor Inspections 1/4 · 75% Patrol Compliance" and the per-floor status table
(§2.5) are the outputs of this flow.

### 5.3 QR Checkpoint Scanner
A standalone page, `Enterprise QR Checkpoint Scanner`: the same dark viewport with the caption
`Point camera at Floor Barcode or Visitor Badge`. Two buttons: `Simulate Floor QR Scan (1st
Floor)` and `Simulate Visitor Pass Scan (VIS-9021)`. So **one scanner handles both floor
checkpoints and visitor badges**.

### 5.4 Inspection Audit Records: "Comprehensive Floor Inspection & Supervisor Sign-Off Ledger"
- **KPI tiles:** Total Inspections Logged **6** (across all towers & floors) · 100% Passed &
  Verified **5** (zero safety infractions) · Issues Flagged / Resolved **1** (remediated by
  facility ops) · Compliance Rate **83%** · Avg Patrol Duration **34 Mins** (100% GPS
  geofence verified).
- **Filters:** search (inspector, badge, tower, area), All Dates, All Statuses, All Towers,
  All Agencies, `Reset`, `Print`, `Export Inspection CSV`.
- **Columns:** Audit ID & Date (`INS-8861`…), Inspector Profile (name, badge, agency, mobile),
  Tower / Floor & Area, Check-In / Start Time, Check-Out / Complete, Checkpoints & Score
  (e.g. `8/8 OK`), plus GPS verification and sign-off status.
- **Export:** opened in WPS Office as a multi-sheet workbook. Sheet 1 is the ledger (Inspector
  Badge ID, Security Agency, Inspector Mobile Phone, Check-In/Start, Check-Out/Finish, Total
  Duration, Checkpoints Scanned, Compliance, GPS Verified…). A second sheet is a lookup list of
  towers, floors, specific areas covered and **inspection types**: *Daily Morning Safety &
  Infrastructure Survey*, *Routine Evening Patrol & Basement Hand Check*, *Deep Infrastructure
  & Plumbing Inspection*, *Comprehensive Night Shift Security Audit*, *High Voltage Electrical
  & Power Generator Check*. The same workbook has an inspector drop-down (names `~`Suresh
  Kumar, Vikram Singh, Dinesh Patil, Ramesh Yadav). The inspection types are not selectable in
  the wizard we saw, so this sheet looks like master data for a future feature.
- The ledger and export column lists above are `~` partly legible; the column names are
  reconstructed from a blurred spreadsheet.

---

## 6. Visitor, contractor & material management

### 6.1 Document & Gate Pass Master / Register
- **Toolbar:** search by ID, holder, company, tenant or title; `Doc Type: All Document Types`;
  `Status: All Statuses`; `+ Create New Document / Pass`.
- **KPI cards:**
  - Total Security Documents **4** (Master)
  - Active Work Permits **1** (Contractor)
  - Material Gate Passes **1**
  - VIP & Visitor Passes **1**
- **"Security Documents & Clearance Passes" (4 records)**, with `+ Create Document` and
  `Export CSV`. Columns: Doc Reference (with issue date and time), Document Subject & Type,
  Holder / Contractor (name, firm, phone), Host Tenant & Floor, Validity Window, Status,
  Actions (`View Slip`, a green action button ~"Check-out/Verify", a red delete).

| Ref | Subject | Type tag | Holder | Host tenant | Validity | Status |
|---|---|---|---|---|---|---|
| GP-9021 | HVAC Air Conditioning Duct Servicing & Filter Replacement | CONTRACTOR WORK PERMIT | Rajesh Verma | Shivit Technologies HQ | Today 09:00 AM → | ACTIVE |
| GP-9022 | Dell Server Rack & Cisco Network Switch Delivery Challan | MATERIAL MOVEMENT GATE PASS | Arun Prakash | Apex Financial Services | Today 10:00 AM → | ACTIVE |
| GP-9023 | Board of Directors Audit & Financial Due Diligence Pass | VIP / VISITOR SECURITY PASS | Vikramaditya Singhania | Apex Financial Services | Today 11:00 AM → | ACTIVE |
| GP-9019 | Defective Projector & Display Monitor Repair Outward Slip | OUTWARD / RETURNABLE (~) | Sanjay Gupta | Novus Innovations | Yesterday 03:00 PM | CLOSED (~) |

So four pass types are modelled: contractor work permit, inward material challan, VIP/visitor
pass, and an outward returnable material slip.

### 6.2 Official Security Clearance Pass & Gate Permit (the "View Slip" modal)
A printable pass:
- **Header:** Shivaizer · **SHIVIT NOIDA TECH PARK** · *Campus Security & Access Management
  Division* · `● ACTIVE PERMIT` badge with the issue time.
- **Type and title:** `CONTRACTOR WORK PERMIT` · *HVAC Air Conditioning Duct Servicing & Filter
  Replacement*, ref `GP-9021`.
- **Fields:**
  - Issued To / Holder: Rajesh Verma
  - Contractor Firm: CoolBreeze HVAC Services Ltd (~)
  - Mobile Contact
  - Govt ID Proof: Aadhaar Card (masked)
  - Host Tenant Company: Shivit Technologies HQ
  - Authorized Zone / Floor: 1st Floor – Suite 101-105
  - Authorized Entry Gates: Gate 1 (Main Entrance) & Service Lift (~)
  - Permitted Validity: Today 09:00 to 18:00 (~)
- **QR code** on the right, labelled for scanning at the gate.
- **Footer fields:** Materials / Tools Carried (e.g. *ladder, vacuum, …*), Security Deposit /
  Badge Issued (e.g. *₹1,000 refundable, badge #…*), Scope of Work.
- **Three signature blocks:** Issued Gate Security Officer, Host Tenant / Approver, Security Head.

### 6.3 Create New Security Document & Gate Pass
- **Toolbar:** `Clear Form`, `Fill Sample`, `Back to Register`. A banner says the form
  connects to master data (tenant, floor, gate).
- **Fields:**
  - Document / Pass Type\* (e.g. *Visitor VIP Security Pass*)
  - Document / Reference Number\* (e.g. GP-9025, with `Auto-Gen`)
  - Document Subject / Title\*
  - Holder / Contractor Full Name\*
  - Company / Contractor Name\*
  - Contact Mobile Number\*
  - Govt ID Proof Type\*, Govt ID Proof Number\*
  - Host Tenant Company (Master Dropdown)\*
  - Destination Floor & Sector (Master Dropdown)\*
  - Apartment / Unit / Suite No.\*
  - Permitted Gate(s)\*
  - Security Deposit / Badge Info
  - Valid From (`Select Today` shortcut), Valid To / Expiry\*
  - Authorising Officer (auto-filled with the signed-in user, `Suresh (GUARD)`)
  - Attachment / Document / Verification File
  - Tools, Materials & Inventory Carried
  - Detailed Purpose & Scope of Work
  - Security & Safety Remarks
- **Buttons:** `Cancel`, `Clear All`, `Add Document & Issue Pass`.
- Native browser validation ("Please fill in this field") appeared during the demo, so the
  required-field checks are just HTML `required` attributes.

### 6.4 New Visitor Gate Entry & Security Pass (Operations › New Gate Entry Desk)
- **Toolbar:** `Clear Form`, `Fill Sample`, `Visitors List`.
- **Fields:**
  - Visitor Full Name\*
  - Mobile Number\*
  - Company / Organization\*
  - Visitor Type\*: Client / Meeting, Vendor / Partner, Contractor / Tech Support, Interview
    Candidate, Delivery / Courier, Personal Guest
  - Government ID Type\* (e.g. *Aadhaar Card*)
  - ID Number / Reference\*
  - Vehicle Registration Number
  - Gate of Entry\* (default *Gate No. 1 (Main Entrance)*)
- **Sub-section "Host Tenant & Destination Location (Master Data)"**, tagged as auto-routed:
  - Host Tenant Company (Master Dropdown)\*
  - Destination Floor (Master Dropdown)\*
  - Apartment / Unit / Flat / Suite No.\*
  - Host Contact Person & Phone (auto-populated from Tenant Master)
  - Purpose of Visit\*
- **Auto-sync (shown in part 2).** Picking the host tenant (*Novus Innovations Corp (3rd Floor
  • Suite 301-306)*) fills Destination Floor (*3rd Floor (Novus Innovations)*), Apartment/Unit
  (*Suite 301-306*) and Host Contact (*Rahul Verma (+91 99555 77889)*). A green confirmation
  line reads *"Floor '3rd Floor' & Apartment/Unit 'Suite 301-306' auto-set from Tenant Master:
  Novus Innovations Corp"*. The section header carries an `Auto-Sync Enabled` tag.
- **Visitor Live Photo / Webcam Capture.** A widget with a state chip (`CAMERA READY` →
  `CONNECTING…` → `CAMERA OFF`), a thumbnail and three buttons: `Open Live Camera`, `Upload`,
  `Sample`. Beneath the thumbnail: *"Guard: Suresh Kumar • Gate GPS Verified"*. After capture:
  *"Live Photo Captured, Captured: 18:50:09 • Verified Watermark"* and the toast *"Live photo
  captured with security watermark!"* The button becomes `Re-Open Camera`.
- **Remarks / Special Baggage** (e.g. *"Carrying 1x Laptop, Toolkit Box"*).
- **Buttons:** `Cancel`, `Clear All`, `Add Visitor Entry & Issue Pass`.

Piyush filled in his own details live (*Shivit Technologies Private Limited*, *Personal Guest*,
Aadhaar `4234234234`, host Novus Innovations, purpose *"Test purpose"*), took a webcam photo
and submitted. He became visitor **VIS-4617**, status *Pending Approval*.

### 6.5 Visitor Master Register (with the Check-In / Check-Out desks)
- **Toolbar:** search (visitor, company, tenant, ID, phone), `Status: All Statuses`, `Tenant: All
  Tenants`, `Floor: All Floors`, `+ New Gate Entry`, `Export Register (CSV)`. Header chip `8
  RECORDS`.
- **Columns:** Ref ID & Photo, Visitor Information (name, company, phone, vehicle), Tenant &
  Destination, Purpose & ID, Entry / Gate (gate, guard, in-time, **live stay duration** with
  an *"Active On-Premises"* tag), Status, Actions.

| Ref | Visitor | Host / Floor | Purpose | Status |
|---|---|---|---|---|
| VIS-4617 | Piyush Khare, Shivit Technologies Pvt Ltd | Novus, 3rd Floor Suite 301-306 | Test purpose (Aadhaar) | **Pending Approval** (`Approve` / `Reject`) |
| VIS-9021 | Rajesh Malhotra, Oracle India Pvt Ltd (vehicle `UP 16 BD 4501`) | Shivit, 1st Floor Suite 101-105 | ERP Implementation Review & Architecture Signoff | **Checked-In**, Gate 2 (North), in 10:15 AM, 3h 40m on premises → `Check-Out` |
| VIS-9020 | Meenakshi Iyer, KPMG Advisory Services (Driving Licence) | Apex Financial, 2nd Floor Suite 202 | Quarterly Statutory Financial Audit | **Checked-In**, Main Security Gate, 09:40 AM → `Check-Out` |
| `~`VIS-9019 | Amitabh Sengupta, Cisco Systems India | Shivit | Server Rack Fiber Maintenance & Switch Upgrade | Checked-Out, `View Slip` |
| VIS-9018 | Sunil Rao, Dell Global Logistics | Novus | Secure Commercial Laptop Delivery | Checked-Out, `View Slip` |
| VIS-9017 | Deepak Chawla, TeleDirect Financial Sales | Apex | Unsolicited Financial Services Pitch | **Rejected** (denied by tenant) |
| VIS-9016 | Shweta Agarwal (candidate, self) | Shivit | Final Technical Round – Principal Software Engineer | Checked-Out, `View Slip` |
| VIS-9015 | Manoj Tiwari, Voltas Electro-Mechanical | Regus | HVAC Chiller & AHU Quarterly Servicing | Checked-Out, `View Slip` |

Status vocabulary: **Pending Approval → Approved → Checked-In → Checked-Out**, with **Rejected**
as a terminal branch. After the presenter approved VIS-4617 the row showed `APPROVED` and a
blue `Check-In` button. He then opened the check-out flow for the same visitor:
**"Visitor Check-Out Confirmation"**, *"Confirm departure for Piyush Khare (Shivit Technologies
Private Limited)?"*, an **Exit Remarks** field, `Cancel` / `Confirm Check-Out`.

### 6.6 Live Tenant Visitor Approval Queue (Tenant Approval Queue)
- **Header:** `Live Tenant Visitor Approval Queue` with a yellow `1 ACTIONABLE REQUESTS` tag; a
  `Host Tenant` filter (*All Tenants (1 Pending)*); three counters `PENDING`, `CLEARED`,
  `DENIED`; buttons `+ Pre-Authorize Guest` and `View Full Register →`.
- **Request card:** photo, name, visitor-type tag (`PERSONAL GUEST`), company, phone, ID,
  *Host: Novus Innovations Corp (3rd Floor • Suite 301-306)*, purpose, gate, *Arrived: Today,
  Just now*. Buttons: `Pass Details`, red `Deny Entry`, green `Approve & Authorize`.
- **Pass Details modal:** `Digital Security Pass #VIS-4617`: photo, name, company, status chip
  (`PENDING APPROVAL`), Tenant, Floor & Unit, Purpose, ID Proof, Vehicle, Total Duration, Entry
  Gate, Duty Guard.
- **After `Approve & Authorize`:** toast *"Visitor Piyush Khare APPROVED! Guard can now
  Check-In"*, counters update, and the empty state shows *"All Visitor Requests Cleared!"* with
  `+ Create new Gate Entry` and `Pre-Authorize Guest`.

The approver here is the **tenant's own contact**; in the demo the same user clicked it. There
is no tenant-facing login, SMS or WhatsApp prompt in the prototype; on the call the presenter
said approval would be by a **link or notification** (WhatsApp possible), with no tenant app (§9). **`Pre-Authorize Guest`** means a
host can create a visitor ahead of time, which the dashboard counts as "Self Approved".

### 6.7 Visitor Movement & Approval Log (analytics)
A second visitor page, `Comprehensive Visitor Movement & Approval Log`, `Showing 8 of 8
records`, *"Auto-synced with floor/tower checkpoints & tenant masters"*.
- **KPI tiles:** Total Registered Visitors **8** (all-time movement logs) · Currently Checked-In
  **2** (active on campus right now) · Completed Check-Outs **5** (departed with badge
  surrendered) · Host Approval Rate **88%** (approved by hosts) · Avg Stay Duration **2h 15m**
  (zero overstay violations).
- **Filters:** search (visitor, phone, company, host, pass #, vehicle), `All Dates`, `All
  Statuses`, `All Towers`, `Reset`, `Print`, `Export Visitor CSV`.
- **Columns:** Ref ID & Pass # (with `BADGE-GEN` / `PASS-STD` chips), Visitor Profile (who),
  Govt ID & Vehicle, Host & Destination (tower, floor), Approval Details (when & who),
  Check-In (who / gate). The right-hand columns were cut off in frame.
- **Excel export** (`Detailed_Visitor_Sheet` in WPS Office): Visitor Ref ID, Visitor Name,
  Mobile Phone, Email, Company, Visitor Category (Personal Guest, Vendor / Partner, Client /
  Meeting, Contractor, Delivery, Personal / Walk-in, Interview Candidate), ID Type (Aadhaar,
  Driving Licence, PAN Card, Voter ID), Masked ID Number (`XXXX-XXXX-1100`), Vehicle Number,
  Purpose, Host Tenant, Destination, **Check-In Security Guard** (name + badge), Check-In
  Date/Time, **Check-Out Gate**, **Check-Out Guard**, **Total Stay Duration** (`1h 15m`,
  `3h 40m (Active On-Premises)`, `0 mins`), Current Status. Another sheet tab follows with
  more of the same.

### 6.8 Security Watchlist & Overstay Monitoring
Red `SECURITY ALERT` tag. Columns: Visitor, Tenant, Purpose, Flag Reason, Security Action.

| Visitor | Tenant | Purpose | Flag |
|---|---|---|---|
| Rajesh Malhotra (Oracle India) | Shivit Technologies Pvt. Ltd. | ERP Implementation Review & Architecture Signoff | `STAY DURATION > 2 HOURS` |
| Meenakshi Iyer (KPMG) | Apex Financial Services | Quarterly Statutory Financial Audit | `STAY DURATION > 2 HOURS` |
| Deepak Chawla (TeleDirect) | Apex Financial Services | Unsolicited Financial Services Pitch | `DENIED ENTRY BY TENANT` |

Action for each: `Escalate Security Alert`. Two flag reasons exist: **overstay** (over a fixed 2
hours, as far as the demo showed) and **tenant-denied**. No permanent blocklist (banned
persons) was shown.

### 6.9 Security Notification Center
Opened from the bell. Title `Security Notification Center`, `Mark All Read`, unread dots.

| Event | Detail | Age |
|---|---|---|
| New Visitor Approval Request | Piyush Khare (Shivit Technologies Private Limited) arrived at Gate No. 1 (Main Entrance) for Novus Innovations Corp | Just now |
| New Gate Entry Request | Rajesh Malhotra (Oracle) waiting for Apex Financial approval | 10 mins ago |
| Floor Inspection Due | 1st Floor inspection schedule pending for shift A | 35 mins ago |
| Visitor Approved | Meenakshi Iyer was approved by Apex Financial | 1 hour ago |
| GPS Location Verified | Ground Floor lobby patrol completed successfully | 2 hours ago |

Notice that it is an **in-app inbox only**: no push, SMS, WhatsApp or email to the host tenant
was built (WhatsApp / link approval was promised verbally, §9).

### 6.10 The full visitor lifecycle (as demonstrated)
**Gate entry** (or `Pre-Authorize Guest`) with live photo → **Tenant Approval Queue**
(approve / deny, with a digital pass) → **Check-In** in the register (stay timer starts) →
**Check-Out** with exit remarks → **Overstay & Watchlist** (> 2 h, or denied) → **Visitor
Movement & Approval Log** with CSV export. A QR badge (`VIS-9021`) can be scanned at the
scanner (§5.3).

---

## 6A. Security & patrol (part 3)

### 6A.1 Incident & SOS Log: "Security Incidents & SOS Panic Alerts"
Red `3 REPORTED` tag and a `+ Log Incident` button. Columns: Incident ID, Occurrence Date/Time,
Location, Category (coloured chip), Summary, Reported By, Status.

| ID | When | Location | Category | Reported by | Status |
|---|---|---|---|---|---|
| INC-204 | Today 08:15 AM | Gate 2 Visitor Entrance | `SECURITY ALERT` | Suresh Kumar | RESOLVED |
| INC-203 | Yesterday 04:30 PM | 2nd Floor South Fire Stair | `FIRE HAZARD` | Anita Sharma | CLEARED |
| INC-202 | 01/10/2026 11:20 AM | Basement B1 Parking | `LOST PROPERTY` | Ramesh Yadav | `~`BADGE DEACTIVATED |

Every summary reads *"Incident reported at security post."* (placeholder text).

**"Log Security Incident / SOS Alert" modal** (the presenter opened it and filled it):
Incident Category\* (default *Fire Exit Obstruction / Hazard*), Location (Master Floors &
Gates)\* (a dropdown of Gate 1 Security Entrance, Gate 2 Visitor Entrance, Gate 3 Loading &
Service Bay, Basement B1 Parking, and the four floors, so **locations come from the same
masters as everything else**), Incident Summary & Action Taken\*, Reported By\* (defaults to
the signed-in guard), Severity\* (*Medium (Action Taken)* and others). Button `+ File Incident
Report`. No photo attachment, no assignee and no linkage to a floor survey were shown. The
"SOS panic" half of the title has no panic button on any screen we saw.

### 6A.2 Live Security Patrol Radar & GPS Tracking
Green `3 GUARDS ONLINE` tag and `Refresh GPS`. The "map" is a **schematic grid, not a real
map**: rounded boxes for *Tower A* and *Tower B*, a *Main Security Lobby & Gate 1* zone, and
guard pins (initials in a circle) placed inside them. Caption: *"Live coordinates sampled via
geofence GPS every 20s. Click pins to inspect guard telemetry."* Campus anchor shown as
`Shivit Noida Tech Park Campus (28.5355° N, 77.3910° E)`.

Under it, **Guard Patrol Breadcrumb History**: Guard, Date & Time, Location / Checkpoint,
Activity, GPS Status (`GPS FIXED (±4m)` style chips).

| Guard | When | Checkpoint | Activity |
|---|---|---|---|
| Suresh Kumar (GRD-101) | Today 10:14 AM | 1st Floor Corridor A Checkpoint | Floor Inspection In Progress |
| Suresh Kumar (GRD-101) | Today 09:30 AM | Ground Floor Lobby Checkpoint | Completed Inspection Survey |
| Vikram Singh (GRD-102) | Today 09:12 AM | 2nd Floor Fire Exit Checkpoint | Perimeter Patrol Scan |
| Ramesh Yadav (GRD-103) | Today 08:00 AM | Gate 1 Main Guard Post | Duty Check-In & Gate Shift Open |

So the "breadcrumb" is a **checkpoint-event log**, not a continuous GPS trail.

### 6A.3 Other things in part 3
- **Survey wizard step 3** showed the live camera view (a corridor) with the label *"Ready to
  Capture Inspection Photo"* and a `Capture Live Photo` button, under the heading *"Step 3: Live
  Photo Capture with Security Watermark"*. The floor survey page also carries a `TODAY: SHIFT A
  ACTIVE` tag.
- **A real product link.** Near 31:00 the presenter tried to open `erp.shivit.in` (then
  `erp.shivit.in/pages/login`) in a new tab. The page stayed blank/loading in frame. The
  footer on every screen says *"Powered by Shivit Technologies Pvt Ltd"* and the form
  footers say "Shivaizer ERP", so this module is probably meant to plug into Shivit's own ERP.
- The presenter then went back to the checkpoint registry and scrolled the sidebar to show the
  full menu (§1).

---

## 7. Cross-cutting features seen or implied

| Capability | Evidence |
|---|---|
| Multi-site switcher | `Shivit Noida ▾` in the top bar, plus the Project/Facility filter on the dashboard |
| Financial-year scoping | `F.Y. 2026-27` filter |
| Live map | `Live Radar Map` / `Radar Map →` buttons, "Live Guard Radar Map", "Patrol Breadcrumb Timeline" (none opened) |
| Guard phone telemetry | Battery % and online/offline status per guard |
| QR checkpoints | Printable floor QR, working scanner page (simulated), same scanner reads visitor badges |
| Circular geofences | Lat/lng + radius per floor and checkpoint; the wizard computes a geodesic distance and passes/fails against the radius |
| Photo evidence | Webcam capture with a "security watermark" in both the visitor desk and the survey wizard; camera or file upload for the guard avatar |
| Approval workflows | Tenant approval of visitors (demonstrated); supervisor approval of inspections (status exists, screen not shown) |
| Printable passes with QR | Gate pass slip; digital pass modal per visitor |
| Exports | Dashboard `Export Reports`, `Export Register (CSV)`, `Export Visitor CSV`, `Export Inspection CSV` (all open as multi-sheet spreadsheets), `Export JSON` on towers, `Print` on both ledgers |
| Bulk operations | Not built; the presenter agreed to add bulk import for tenants and floors on request (§9) |
| RBAC | "Roles & Permission Matrix" and "User Profile & Switcher" in the sidebar; not enforced in the demo |
| Audit | "System Audit Trail", "Inspection Audit Records" (the latter is real, §5.4) |
| Alerts | "Alert & Trigger Config", notification bell with a badge; in-app inbox of five event types (§6.9); `Escalate Security Alert` on the watchlist |
| Incident / SOS | "Incident & SOS Log" in the sidebar only |
| Pre-authorisation | `Pre-Authorize Guest` button on the approval queue |
| Policies | "Security & Entry Policies" (sidebar only) |
| Biometrics / access cards | Flags on the guard record only; no integration shown |

---

## 8. Shivaizer vs GuardWatch AI

| Area | Shivaizer | GuardWatch AI today |
|---|---|---|
| Customer | Facility / tech-park operator (one campus, many tenants) | Security agency (many client sites, many guards) |
| Property model | Campus → Tower → Floor → Tenant suite, plus gates | Site with a polygon fence (`sites`) |
| Guard record | Deep onboarding form: kin, deployment, shift, duty types, agency, 7 compliance docs, access card, biometrics | `guards`, KYC docs (`guard_documents`, private bucket, access logs), invites, shareable profile |
| Shifts | Shift master (A/B/C/D + custom), weekly off, break | Shift types, roster patterns, `materialize_roster`, month view |
| Attendance | Implied by "Active On Duty" and online status; not shown | Full: selfie + geofence check-in/out, exceptions, overrides, trends |
| Live tracking | Battery + online status, "Radar Map" (not opened) | Pings, presence, live map, location-state reporting |
| Patrol / inspection | Daily floor survey as a 4-step wizard (QR → GPS radius → watermarked photo → 8 pass/fail checks + remarks), supervisor approval state, audit ledger with KPIs and CSV | Patrol routes and patrols with photos; tasks with templates |
| Checklists | Yes, a master checklist with typed responses | Task templates; no structured pass/fail checklist on patrol checkpoints |
| Visitor management | Core of the product: gate entry with live photo, tenant approval queue, digital pass, check-in/out with exit remarks, overstay + denied watchlist, movement log with approval-rate and stay-time KPIs | **None** |
| Gate passes / permits | Contractor permit, material in/out, VIP pass, printable QR slip | **None** |
| Notifications to hosts | In-app inbox only (no push/SMS/WhatsApp seen) | In-app `notifications` table and preferences |
| Tenants / hosts | Tenant master with contacts and visitor counts | None (sites belong to the agency's clients, but there is no client-side tenant model) |
| Leave, scorecards, incidents, events, reports | Not seen | Yes |
| Multi-tenant SaaS, RBAC, platform console | Sidebar items only | Built: agencies lifecycle, `roles` × scope, `has_permission()` in RLS |
| Maturity | Single-file HTML prototype with sample data | Production stack (Supabase + Next.js + Android app) |

**What to take from it:**
1. **Visitor and gate-pass management is the gap.** If GuardWatch AI wants to sell to the
   *client* of the agency (the tech park, residential society or factory), the gate desk is
   where guards spend most of their shift. A visitor flow and a contractor/material pass with
   QR plus host approval would be a natural add-on module. It runs on the guards and sites
   GuardWatch AI already has.
2. **Structured checklists on patrol checkpoints.** Typed pass/fail questions (fire exits,
   extinguishers, DB boards, leaks), with a fail answer that requires a photo, are cheap to add
   on top of `patrol_routes`. They turn a patrol from proof of presence into proof of
   inspection, which a facility manager will pay for. Shivaizer's version stops short: a bad
   answer can still be submitted with no photo, alert or follow-up task. GuardWatch AI already has
   tasks and events, so *fail → auto-create task + notify* is the obvious step beyond them.
   Also steal the **sequenced proof**: scan the QR, then pass the geofence, then take the
   photo, then answer the checklist, each gated on the previous one.
3. **Duty types on a deployment.** Gate / visitor verification / vehicle / material / CCTV /
   night patrol / fire as multi-select duties per assignment. The gate-duty sub-config (vehicle
   check, ID + QR verification, material slip scanning) is a cheap way to make a post
   description machine-readable.
4. **Reserve pool and agency fields.** "Unassigned (Reserve)" status, plus agency employee ID,
   supervisor and contract dates. These matter if GuardWatch AI ever handles sub-contracted
   manpower.
5. **Battery on the live board.** The attendees asked about it straight away. GuardWatch AI
   already collects device state; showing battery % next to the online dot is a small change.

---

## 9. Audio: what was said (Q&A from the call)

The audio is Hindi mixed with English UI terms, recorded off laptop speakers. Machine
translation (faster-whisper) is rough, so these are **paraphrases of what the attendees asked
and what the presenter committed to**, with timestamps on the Teams call timer where known.
Parts 1 and 2 are transcribed (part 1 to ~13:00, part 2 to ~6:30 of its own length); part 3's
audio had not finished transcribing when this was written and is **not merged**.

**Part 1**
- **~01:55, battery question.** Piyush asked what happens if a guard's phone battery goes very
  low or the phone switches off, and whether the shift still counts. The answer was not
  intelligible. On screen at that moment: Dinesh Patil at 42% / OFFLINE. *Open question; the
  demo had no offline or missed-heartbeat handling.*
- **~02:35, towers.** Presenter: first create the Tower Master (the building), and as many
  towers as needed; every form shown is simple (name, address, total floors).
- **~03:30, checkpoints.** The point of floor checkpoints is that guards walk to each floor
  and update their photos there; checkpoints are named building-wise.
- **~04:00, geofencing Q&A.** Piyush asked whether he must get the exact lat/long of the QR
  location. Answer: yes, enter coordinates and a radius per checkpoint; **on scan, the system
  checks that the guard's coordinates are within that radius, and if they mismatch the
  inspection is rejected** (this was then shown in the survey wizard, §5.2). QR codes are
  printed and fixed at the checkpoint.
- **~05:30, printing.** Attendee: how do I print the QR code? Presenter: **no print option
  yet; it will be added**, with label-printer support.
- **~06:30, bulk import.** Attendee: adding tenants one by one is cumbersome, can we upload
  all at once? Presenter: **yes, bulk import can be added**, also for the floor master.
- **~07:20 onward, guard form.** Walkthrough of Assign New Guard: photo from file or camera,
  phone, address, emergency contact, then location assignment by tower and floor (a guard can
  be given access to all floors), documents, extra info. The attendee asked to add a field to
  the form (e.g. a custom one); **presenter agreed fields can be added**.
- **~11:00, biometrics / access card.** Attendee did not understand the "Access & System
  Details" section (card and biometric flags). Not clearly answered.
- **~11:30, checklist.** Presenter: the checklist goes to the guards, who fill it daily
  (cleanliness, fire safety, blocked exits, lighting faults) during their survey; the report
  updates from it.
- **~12:50, gates.** Attendee asked whether "gate" is for tenants or guests. Answer: **for
  visitors**.

**Part 2**
- **~00:50, how does the tenant see it?** Attendee: how do these details reach the tenant,
  since nothing is given to the tenants? Do tenants get the portal or an app? Presenter:
  approvals are a separate user access; the tenant approves. Attendee: do tenants need to
  download an app, can it be done on **WhatsApp**? Presenter: **yes, both options**: tenants
  can approve through a **link** (no app) or via a **notification** that opens the approval
  form directly.
- **~02:45, approval semantics.** Tenant approves or denies. On approval the guard's screen
  shows a **Check-In** button and the check-in time is captured automatically; a rejected
  visitor is **blocked and cannot be checked in**. At check-in the guard can enter a **badge
  number**. At check-out the guard can add a remark.
- **~04:00, visitor report.** The register is also a report of who visited, with phone,
  company and personal details.
- **~05:00, recap.** Presenter: this was gate entry and visitor management; the other modules
  (check-in, check-out, daily survey) are reached from the same sidebar.
- **~06:00, overstay.** Attendee asked what happens if security is alerted. Presenter:
  visitors who have checked in but not checked out are what the overstay list shows.

**Part 3.** Audio not merged. If the transcript completes it will be at
`/tmp/drive-video3/transcript_en.txt`.

### Commitments / feature requests that came out of the call
| # | Ask | Who asked | Presenter's answer |
|---|---|---|---|
| 1 | QR print option (label printers) | attendee | will add |
| 2 | Bulk import for tenants and floors | attendee | will add |
| 3 | Custom fields on the guard form | attendee | can add |
| 4 | Tenant approval without installing an app (WhatsApp / link) | attendee | both link and notification supported |
| 5 | Behaviour on guard phone battery-out / switch-off | Piyush | unanswered |
| 6 | Explain biometric / access card section | attendee | unclear |
