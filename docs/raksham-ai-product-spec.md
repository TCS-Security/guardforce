# Raksham AI — Exhaustive Product Specs & Feature List

> Full crawl of https://raksham.ai completed 2026-09-13 via sitemap.xml (Yoast index).
> Company: **NammaRaksham AI Private Limited**, Bengaluru, India.
> Positioning: *"Staff Attendance, Guard Management and Payroll Management Software"* — workforce management for field staff & security guards.

---

## 1. Crawl Inventory — All Pages on the Site

| # | URL | Title / Purpose | Status |
|---|---|---|---|
| 1 | `/` | Homepage — hero, products, features, testimonials, FAQ | Scraped |
| 2 | `/product/` | Product index — lists **4 products** (incl. Mobile Premium App) | Scraped |
| 3 | `/desktop-app/` | **Raksham Web** (admin dashboard) detail page | Scraped |
| 4 | `/staff-app/` | **Staff App** detail page | Scraped |
| 5 | `/guard-app/` | **Guard App** detail page | Scraped |
| 6 | `/premium-mobile-app/` | **Mobile Premium App** detail page (mostly template placeholder) | Scraped |
| 7 | `/pricing/` | Pricing + full feature comparison matrix | Scraped (incl. DOM icon inspection) |
| 8 | `/how-it-works/` | 4-step onboarding flow + key features | Scraped |
| 9 | `/about-us/` | Company vision/mission/values | Scraped |
| 10 | `/our-team/` | Team page (template placeholder content) | Scraped |
| 11 | `/contact/` | Contact + lead-capture form (industries, team sizes) | Scraped |
| 12 | `/blogs/` | Blog index (lists the 2 posts below) | Indexed |
| 13 | `/blogs/boost-productivity-with-smart-shift-management/` | Blog: shift scheduling automation | Scraped |
| 14 | `/blogs/optimize-employee-attendance-with-real-time-tracking/` | Blog: real-time attendance tracking | Scraped |
| 15 | `app.raksham.in/auth/login` | Web app login/signup (the actual SaaS) | Linked, not crawled |
| 16 | Google Play `com.raksham.raksham` / App Store `id6740204818` | Native mobile apps | Linked |

Also crawled: `robots.txt`, `sitemap.xml` (post/page/elementor-hf/category/author sitemaps). Only 1 blog post exists in post-sitemap (a "Hello World" stub) — the 2 real blog posts live in the page sitemap.

---

## 2. Product Suite — 4 Products

| Product | Platform | Audience | One-liner |
|---|---|---|---|
| **Raksham Web** | Web dashboard (`app.raksham.in`) | Owners/Admins/Managers | Monitor employee activity, live progress, real-time insights |
| **Staff App** | Android + iOS | Field employees | Track tasks, update progress, shifts, attendance self-service |
| **Guard App** | Android + iOS | Security guards | Shift scheduling, attendance, incident reporting, OT/leave, sleep alerts |
| **Mobile Premium App** | Android + iOS | Business owner/manager | Selfie & location-based attendance, advanced manager mode, **cashbook** |

**Onboarding flow** (from /how-it-works/): 01 Download app → 02 Register account → 03 Choose payment → 04 Use app.

**Claimed traction**: 50+ clients, 17 cities, 8,000+ staff & guards. Claimed impact: 10% error reduction, 20% efficiency boost.

---

## 3. Exhaustive Feature List (consolidated from every page)

### A. Attendance Management (17 features)
1. Real-time attendance sync
2. Track-in / track-out (punch in/punch out) time capture
3. Selfie-based attendance capture
4. Location (GPS)-based attendance verification
5. Geo-fencing — entry/exit event detection
6. Shift types: General / Night / Morning, each with start & end times
7. One-tap shift start from mobile app
8. Photo-confirmed shift end, with retake option (prevents accidental clock-outs)
9. Color-coded daily status: Present (green), Absent (red), Half Day (yellow)
10. Per-day detail: shift duration, break times, time spent outside geo-fence
11. Automated shift scheduling — create, manage, modify shifts
12. Late-start alerts; shift start/end event alerts
13. Outage detection — flags when location and/or internet is disabled (anti-tamper)
14. Supervisor bulk mode — mark attendance of all site employees from a single phone
15. Date-range attendance views with flexible filters
16. Attendance trends analysis for managers (from blog)
17. Live attendance monitoring — right person, right time, right place

### B. Live Tracking & Route Monitoring (11 features)
18. Live dashboard — real-time employee status: location, shift, contact details
19. Live map — track all employees from one place; zoom in on specific employees
20. Bird's-eye view of path traveled by employee
21. Access to historic paths traveled
22. Daily route monitoring
23. Total distance-traveled measurement (per employee, per day)
24. Time spent outside designated work zones
25. Log of all locations visited (task adherence verification)
26. Employee device battery-percentage telemetry
27. Detailed and summary views of field activity
28. Timeline of employee movement with outage markers

### C. Task Management (8 features)
29. Task assignment with deadlines
30. Real-time task progress tracking (ongoing vs finished)
31. **Mandatory photo evidence** on task completion
32. Configurable task templates
33. Staff record details of completed tasks against templates
34. Task reports by template — generation + download
35. Real-time task notifications with timestamps
36. Guard-specific preset tasks: main gate checks, shift-change briefings

### D. Guard-Specific Features (5 features)
37. **Random sleep alerts** — random checks during shift; guard confirms alertness via photo verification; reduces fatigue-related incidents
38. **Incident reporting** — real-time incident logging during shifts, documentation for workplace safety
39. OT (overtime) monitoring and approval with real-time data
40. Leave requests — track, approve, decline; real-time change notifications
41. OT/leave data integrated directly into shift scheduling

### E. Payroll (2 features)
42. Automated payroll computed from attendance + overtime
43. Labor-law compliance (India-focused)

### F. Reports & Exports (10 features)
44. Punch In Punch Out report
45. Punch report
46. Staff details report
47. Work report
48. Daily attendance report
49. Muster roll report
50. Attendance summary — present / absent / on-leave employee counts (actionable dashboard)
51. Operational dashboard — view important reports, download reports
52. CSV export across event logs, shifts, attendance, tasks
53. Advanced filters by branch, event type, user, date range

### G. Dashboards & Analytics (5 features)
54. Actionable dashboard (attendance summary)
55. Real-time stats on performance and attendance
56. Time & distance-based metric cards (Ultimate tier)
57. Daily distance-traveled reports (Ultimate tier)
58. Real-time insights into productivity and performance

### H. Organization & Admin (6 features)
59. Multi-branch / multi-site org model with branch switcher (dropdown)
60. Employee database with document storage
61. Centralized control — all tasks, schedules, timesheets in one platform
62. Event tracking system — monitor all employee activities in real time, filterable event logs
63. Manager mode (premium app) — advanced supervisory controls
64. Cashbook — business cash/ledger management inside the premium app

### I. Platform & Verification Specs (cross-cutting)
- Web dashboard + native Android & iOS apps
- Email login/signup, multi-tenant org accounts
- Photo/selfie verification at 4 moments: attendance, shift end, task completion, sleep alert
- GPS + geo-fence + battery telemetry from mobile devices
- Anti-tamper: outage flags when GPS/internet disabled
- Push notifications: shift events, geo-fence breaches, late starts, OT/leave changes, task updates

---

## 4. Pricing (per user, yearly)

| Plan | Price |
|---|---|
| **Advance** | ₹999 / user / year |
| **Ultimate** | ₹2,999 / user / year |
| Enterprise | Contact sales |

### Feature Matrix (extracted from page DOM — icons, not text)

| Feature | Advance | Ultimate |
|---|:-:|:-:|
| **Attendance Automation** | | |
| Real-time attendance sync | ✅ | ✅ |
| Track-in / track-out time of attendance | ✅ | ✅ |
| Selfie & location-based attendance | ✅ | ✅ |
| **Employee Database** | | |
| Store employee documents | ✅ | ✅ |
| **Attendance Reports** | | |
| Punch In Punch Out report | ✅ | ✅ |
| Punch report | ✅ | ✅ |
| Staff details | ✅ | ✅ |
| Work report | ✅ | ✅ |
| Daily attendance report | ✅ | ✅ |
| Muster roll report | ✅ | ✅ |
| **Actionable Dashboard** | | |
| Attendance summary (present/absent/on-leave) | ✅ | ✅ |
| **Operational Dashboard** | | |
| View important reports | ✅ | ✅ |
| Download reports | ✅ | ✅ |
| **Timeline** | | |
| Bird's-eye view of employee path | ✅ | ✅ |
| Outage alerts (location/internet disabled) | ✅ | ✅ |
| Detailed & summary field-activity view | ✅ | ✅ |
| Historic paths traveled | ✅ | ✅ |
| **Live Tracking** | | |
| Track all employees from a single place | ✅ | ✅ |
| Map zoom to specific employees | ✅ | ✅ |
| Employee battery percentage | ✅ | ✅ |
| **Dashboard (metrics)** | | |
| Time & distance-based metric cards | ❌ | ✅ |
| Daily distance-traveled reports | ❌ | ✅ |
| **Tasks** | | |
| Configure task templates | ❌ | ✅ |
| Staff record task-completion details | ❌ | ✅ |
| Download task reports by template | ❌ | ✅ |
| **Supervisor Access** | | |
| Mark attendance of all site employees from one phone | ❌ | ✅ |

**Tier logic**: Advance = attendance + tracking + reports. Ultimate = + tasks, distance metrics, supervisor bulk attendance.

---

## 5. Go-to-Market Intel (from contact page + site)

**Lead-capture form fields**: Full Name, Email, Phone, Organization Name, Organization Location, Industry, No. of Staff.

**Industries they target** (dropdown): Individual, F&B, Security, Retail, Factory, Corporate, Other.

**Team sizes targeted** (dropdown): 1-25, 25-50, 50-100, 100-250, 250-500, 500-1000, 1000+.

**Sales channels**: Book free demo, contact sales, WhatsApp deep-link (+91-8660319788), phone, email (contact@raksham.ai), LinkedIn.

**Evidence from testimonials**: hospitality (Tiddly Tavern Bar & Grill), security agencies (SRF Security, RapidMan) — multi-site, low-supervision field workforces.

---

## 6. Blog Content (SEO positioning)

**Post 1 — "Boost Productivity with Smart Shift Management"**: pitches automated shift scheduling (create/manage/modify, fewer manual errors) + real-time attendance tracking (instant monitoring, accountability, compliance).

**Post 2 — "Optimize Employee Attendance with Real-Time Tracking"**: pitches live attendance monitoring (right time/place verification, reduced absenteeism) + automated attendance reports (no manual errors, trend analysis, informed scheduling decisions).

Both follow problem → mission → solution → outcome structure. Content marketing is thin (2 posts, one stub).

---

## 7. Template Artifacts (ignore for your build — not real product)

The site is a WordPress/Elementor theme with leftover template content:

- `/our-team/` and `/about-us/` show **fake team members** (James Symes, Estelle Darcy, Pedro Fernandes, etc. — theme placeholders)
- "Trusted by 152,000+ customers worldwide" (contact/team pages) — theme placeholder, contradicts the real "50+ clients" claim
- `/premium-mobile-app/` body text is Lorem ipsum with irrelevant fintech headings ("Online payments", "Secure transactions", "Anomaly Detection", "Recurring payments") — leftover from a payments template ("Paycash")
- `/how-it-works/` step descriptions are Lorem ipsum
- Header still links raksham.ai ↔ raksham.in inconsistently; old WhatsApp number (919972263028) appears in footer of some pages

**Takeaway**: the real product surface = the 3 products + pricing matrix above; the site's polish is low, which is a competitive opening.

---

## 8. Company & Contact

- **Entity**: NammaRaksham AI Private Limited
- **Registered office**: 8 33/2/8 2nd Main Netaji Layout Vaderahalli, Yelahanka Vidhyaranyapura post, Bengaluru 560097
- **Corporate office**: Awfis Vista Pixel, 4th Floor, 8/2B and 8, 2nd C Main Rd, Jakkuru Layout, Jakkuru, Bengaluru, Karnataka 560092
- **Phone**: +91-8660319788 | **Email**: contact@raksham.ai
- **LinkedIn**: linkedin.com/company/raksham
- **Vision**: global leader in workforce management. **Mission**: simplify workforce management with intuitive tools.
- Site developed by Static Consultancy (WordPress/Elementor)

---

## 9. Build Notes for a Competing Product

- **Core wedge**: guard/field-force accountability — photo-verification + sleep-alerts are the differentiators vs generic HRMS/attendance apps.
- **The "AI" in the name is branding only** — no AI features are described anywhere on the site. Opportunity: real anomaly detection on routes/attendance, face-match on selfies, auto-scheduling.
- **Underserved surface**: cashbook + manager mode in the premium app suggests SMB owners want workforce + business ops in one tool.
- **Pricing**: ₹83–₹250/user/month equivalent — a volume play; enterprise tier is opaque ("contact sales").
- **Stack inference**: WordPress marketing site + separate web app (app.raksham.in) + native Android/iOS with background GPS tracking.
