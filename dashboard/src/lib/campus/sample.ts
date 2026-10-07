import { rng } from "./random";
import { offsetM } from "./geo";
import type {
  Breadcrumb, CampusData, CampusGuard, ChecklistItem, Deployment, Duty, Floor, FloorInspection, Gate, GatePass, ShiftMaster,
  Tenant, Tower, Visitor, VisitorStatus,
} from "./types";

/**
 * Sample property data for the gate & campus preview, generated around one real site and the
 * real guards in the user's scope. Deterministic per site and day, so a reload mid-demo shows
 * the same rows. Nothing here is persisted; the screens hold edits in local state.
 */

export type SiteInput = { id: string; name: string; client_name: string | null; address: string | null; city: string | null; lat: number | null; lng: number | null };
export type PresenceInput = { guard_id: string; battery_pct: number | null; last_seen_at: string | null; shift_id: string | null };

const MIN = 60_000;

export const SHIFTS: ShiftMaster[] = [
  { id: "sh-a", code: "A", name: "Shift A · Morning", start: "06:00", end: "14:00", break_min: 30 },
  { id: "sh-b", code: "B", name: "Shift B · General", start: "09:00", end: "18:00", break_min: 45 },
  { id: "sh-c", code: "C", name: "Shift C · Evening", start: "14:00", end: "22:00", break_min: 30 },
  { id: "sh-d", code: "D", name: "Shift D · Night patrol", start: "22:00", end: "06:00", break_min: 30 },
];

export const CHECKLIST: ChecklistItem[] = [
  { id: "ck-01", code: "CHK-01", category: "Cleanliness", question: "Lobby and floor clean, no dust or spills", ok_label: "OK", fail_label: "Not OK", required: true, photo_on_fail: true, owner: "housekeeping" },
  { id: "ck-02", code: "CHK-02", category: "Common area", question: "Corridors and signage clear of debris", ok_label: "Clear", fail_label: "Obstructed", required: true, photo_on_fail: true, owner: "housekeeping" },
  { id: "ck-03", code: "CHK-03", category: "Fire safety", question: "Fire exit doors unlocked and unblocked", ok_label: "Clear", fail_label: "Blocked", required: true, photo_on_fail: true, owner: "security" },
  { id: "ck-04", code: "CHK-04", category: "Emergency assets", question: "Extinguisher gauges in the green zone", ok_label: "Operational", fail_label: "Refill due", required: true, photo_on_fail: true, owner: "facility" },
  { id: "ck-05", code: "CHK-05", category: "Electrical", question: "Distribution boards locked and secure", ok_label: "Locked", fail_label: "Open", required: true, photo_on_fail: true, owner: "electrical" },
  { id: "ck-06", code: "CHK-06", category: "Lighting", question: "Corridor and emergency exit lights working", ok_label: "All working", fail_label: "Faulty", required: true, photo_on_fail: false, owner: "electrical" },
  { id: "ck-07", code: "CHK-07", category: "Infrastructure", question: "No water leakage or plumbing damage", ok_label: "None", fail_label: "Leak found", required: true, photo_on_fail: true, owner: "facility" },
  { id: "ck-08", code: "CHK-08", category: "Security", question: "No unattended baggage or suspicious activity", ok_label: "None", fail_label: "Alert", required: true, photo_on_fail: true, owner: "security" },
];

export const DUTIES: Record<Duty, { label: string; hint: string }> = {
  gate: { label: "Gate duty", hint: "Entry and exit control at an assigned gate" },
  inspection: { label: "Floor inspection", hint: "Daily QR + geofence + photo survey of floors" },
  visitor: { label: "Visitor verification", hint: "ID check, host approval, badge issue" },
  vehicle: { label: "Vehicle entry / exit", hint: "Log plates, check boots, boom barrier" },
  material: { label: "Material in / out", hint: "Match challans and outward slips to goods" },
  fire: { label: "Fire & safety rounds", hint: "Extinguishers, exits, panels" },
  night_patrol: { label: "Night patrolling", hint: "Perimeter and basement rounds after hours" },
  cctv: { label: "CCTV monitoring", hint: "Control-room screens and incident clips" },
  emergency: { label: "Emergency response", hint: "First responder for SOS and evacuations" },
  other: { label: "Other special duty", hint: "VIP escort, event, anything not listed" },
};

export const AGENCIES = ["Your agency (direct)", "SIS India Security Services", "G4S Secure Solutions India", "Peregrine Guarding", "Checkmate Services"];

const TENANT_SEED = [
  { name: "Kaveri Analytics Pvt Ltd", code: "KAVERI-01", unit: "Suites 101–105", contact: "Anjali Rao", email: "anjali.rao@kaverianalytics.in", channel: "link" as const },
  { name: "Northwind Fintech Services", code: "NWFIN-02", unit: "Suites 201–204", contact: "Vikram Shetty", email: "vikram@northwindfin.in", channel: "whatsapp" as const },
  { name: "Lumen Robotics Labs", code: "LUMEN-03", unit: "Suites 301–306", contact: "Farah Siddiqui", email: "farah@lumenrobotics.ai", channel: "whatsapp" as const },
  { name: "Workbay Co-working", code: "WRKBY-04", unit: "Reception, Ground floor", contact: "Kavya Menon", email: "frontdesk@workbay.co", channel: "desk" as const },
  { name: "Saffron Health Clinics", code: "SAFFR-05", unit: "Suite 207", contact: "Dr. Rohan Iyer", email: "rohan@saffronhealth.in", channel: "whatsapp" as const },
];

const VISITOR_SEED: { name: string; company: string; type: Visitor["type"]; purpose: string; vehicle?: string; id: Visitor["id_type"]; baggage?: string }[] = [
  { name: "Karan Mehta", company: "Zephyr Logistics", type: "vendor", purpose: "Courier contract renewal", id: "aadhaar" },
  { name: "Sneha Kulkarni", company: "Self", type: "interview", purpose: "Final round — data engineer", id: "dl" },
  { name: "Rajat Malhotra", company: "Oracle India", type: "client", purpose: "ERP implementation review", vehicle: "KA 03 MN 4501", id: "aadhaar", baggage: "1 laptop" },
  { name: "Meenakshi Iyer", company: "KPMG Advisory", type: "client", purpose: "Quarterly statutory audit", id: "dl", baggage: "2 laptops, 1 file box" },
  { name: "Imran Qureshi", company: "CoolBreeze HVAC", type: "contractor", purpose: "AHU filter replacement", vehicle: "KA 51 AB 2290", id: "aadhaar", baggage: "Toolkit, ladder" },
  { name: "Deepak Chawla", company: "TeleDirect Sales", type: "vendor", purpose: "Unsolicited insurance pitch", id: "pan" },
  { name: "Ananya Bose", company: "Self", type: "guest", purpose: "Lunch with a colleague", id: "aadhaar" },
  { name: "Sunil Rao", company: "Dell Logistics", type: "delivery", purpose: "Laptop consignment, 12 units", vehicle: "KA 05 HC 7781", id: "dl", baggage: "3 cartons" },
  { name: "Priyanka Desai", company: "Accenture", type: "client", purpose: "Partnership kick-off", id: "passport" },
  { name: "Manoj Tiwari", company: "Voltas Electro-Mech", type: "contractor", purpose: "Chiller quarterly service", id: "voter", baggage: "Gauge set" },
  { name: "Rahul Verma", company: "Self", type: "interview", purpose: "HR round — analyst", id: "aadhaar" },
  { name: "Fatima Sheikh", company: "Swiggy Genie", type: "delivery", purpose: "Document pickup", id: "dl" },
];

const PHONE = (r: ReturnType<typeof rng>) => `9${r.int(100000000, 999999999)}`;

export function buildCampus(site: SiteInput, guards: CampusGuard[], presence: PresenceInput[], now: Date, today: string): CampusData {
  const r = rng(`${site.id}:${today}`);
  const anchor = { lat: site.lat ?? 12.9354, lng: site.lng ?? 77.6925 };
  const code = site.name.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).map((w) => w[0]!.toUpperCase()).join("").slice(0, 4) || "SITE";
  const ago = (min: number) => new Date(now.getTime() - min * MIN).toISOString();
  const ahead = (min: number) => new Date(now.getTime() + min * MIN).toISOString();

  const towers: Tower[] = [
    { id: "tw-a", code: "TWR-A", name: "Tower A (North wing)", category: "commercial", floors: 8, units: 36, incharge: "Mukesh Sharma", incharge_phone: PHONE(r), status: "active", description: "IT offices, ground-floor food court" },
    { id: "tw-b", code: "TWR-B", name: "Tower B (South wing)", category: "corporate", floors: 6, units: 24, incharge: "Sunita Verma", incharge_phone: PHONE(r), status: "active", description: "Finance and healthcare tenants" },
    { id: "tw-c", code: "TWR-C", name: "Tower C (Co-working)", category: "coworking", floors: 4, units: 18, incharge: "Deepak Tyagi", incharge_phone: PHONE(r), status: "active", description: "Managed desks, meeting rooms" },
    { id: "tw-u", code: "BSMT-01", name: "Basement & utility block", category: "utility", floors: 2, units: 8, incharge: "Lokesh Gowda", incharge_phone: PHONE(r), status: "maintenance", description: "Parking, DG sets, STP, electrical room" },
  ];

  const floorSeed: [string, string, string, number, string, number, number][] = [
    ["fl-gf", "GF-MAIN", "Ground floor (Lobby)", 40, "tw-a", 0, 0],
    ["fl-1f", "1F-KAVR", "1st floor (Kaveri)", 35, "tw-a", 12, -18],
    ["fl-2f", "2F-NWFN", "2nd floor (Northwind)", 35, "tw-b", -22, 30],
    ["fl-3f", "3F-LUMN", "3rd floor (Lumen)", 30, "tw-b", -26, 36],
    ["fl-b1", "B1-PARK", "Basement B1 (Parking)", 45, "tw-u", 8, 55],
  ];
  const floors: Floor[] = floorSeed.map(([id, c, name, radius, tower, n, e]) => ({
    id, code: c, name, tower_id: tower, radius_m: radius, units: name.split("(")[1]?.replace(")", "") ?? "", ...offsetM(anchor, n, e),
  }));

  const checkpoints = floors.map((f, i) => ({
    id: `cp-${i + 1}`,
    code: `CHK-${f.code.split("-")[0]}-0${i + 1}`,
    floor_id: f.id,
    location: ["Main entrance turnstiles", "Server room & north exit", "South fire-exit corridor", "Terrace & AHU room entry", "DG set & electrical room"][i]!,
    radius_m: f.radius_m,
    lat: f.lat, lng: f.lng,
  }));

  const gates: Gate[] = [
    { id: "gt-1", code: "G1", name: "Gate 1 · Main entrance", kind: "main", open_hours: "24 × 7" },
    { id: "gt-2", code: "G2", name: "Gate 2 · Visitor gate", kind: "visitor", open_hours: "08:00–21:00" },
    { id: "gt-3", code: "G3", name: "Gate 3 · Service & loading bay", kind: "service", open_hours: "07:00–19:00" },
    { id: "gt-4", code: "PK", name: "Parking boom barrier", kind: "parking", open_hours: "24 × 7" },
  ];

  const tenantFloors = ["fl-1f", "fl-2f", "fl-3f", "fl-gf", "fl-2f"];
  const tenants: Tenant[] = TENANT_SEED.map((t, i) => ({
    id: `tn-${i + 1}`, code: t.code, name: t.name, floor_id: tenantFloors[i]!, unit: t.unit,
    contact_name: t.contact, contact_phone: PHONE(r), contact_email: t.email, approval_channel: t.channel,
  }));

  // ---- Guards on this campus: the site's own first, topped up from the rest of the scope.
  const crew = guards.slice(0, 8);
  const pres = new Map(presence.map((p) => [p.guard_id, p]));
  const guardName = (i: number) => crew[i % Math.max(1, crew.length)]?.full_name ?? "Gate guard";
  const gateGuard = guardName(0);

  // ---- Visitors.
  type Plan = { status: VisitorStatus; arrived: number; inFor?: number; outAfter?: number; pre?: boolean; via?: Visitor["approval_via"]; tenant: number; gate: string; escalated?: boolean };
  const plans: Plan[] = [
    { status: "pending", arrived: 2, tenant: 2, gate: "gt-2" },
    { status: "pending", arrived: 7, tenant: 0, gate: "gt-1" },
    { status: "expected", arrived: -45, pre: true, tenant: 0, gate: "gt-2" },
    { status: "checked_in", arrived: 230, inFor: 222, via: "whatsapp", tenant: 1, gate: "gt-2" },
    { status: "checked_in", arrived: 150, inFor: 141, via: "desk", tenant: 1, gate: "gt-1" },
    { status: "rejected", arrived: 95, via: "whatsapp", tenant: 1, gate: "gt-2" },
    { status: "approved", arrived: 4, via: "whatsapp", tenant: 4, gate: "gt-2" },
    { status: "checked_out", arrived: 300, inFor: 290, outAfter: 75, via: "link", tenant: 3, gate: "gt-3" },
    { status: "checked_in", arrived: 52, inFor: 45, pre: true, tenant: 2, gate: "gt-2" },
    { status: "checked_out", arrived: 260, inFor: 250, outAfter: 130, via: "whatsapp", tenant: 2, gate: "gt-3" },
    { status: "expected", arrived: -120, pre: true, tenant: 3, gate: "gt-2" },
    { status: "checked_out", arrived: 70, inFor: 66, outAfter: 9, via: "desk", tenant: 3, gate: "gt-1" },
  ];
  const visitors: Visitor[] = plans.map((p, i) => {
    const s = VISITOR_SEED[i]!;
    const tenant = tenants[p.tenant]!;
    const inAt = p.inFor != null ? ago(p.inFor) : null;
    const outAt = p.outAfter != null && inAt ? new Date(new Date(inAt).getTime() + p.outAfter * MIN).toISOString() : null;
    const decided = p.status !== "pending" && p.status !== "expected";
    return {
      id: `vs-${i + 1}`,
      ref: `VIS-${4631 - i}`,
      name: s.name, phone: PHONE(r), company: s.company, type: s.type, id_type: s.id, id_last4: String(r.int(1000, 9999)),
      vehicle: s.vehicle ?? null, tenant_id: tenant.id, purpose: s.purpose, gate_id: p.gate, status: p.status,
      pre_authorised: !!p.pre,
      arrived_at: p.arrived >= 0 ? ago(p.arrived) : ahead(-p.arrived),
      approved_at: p.pre ? ago(24 * 60) : decided ? ago(Math.max(1, p.arrived - 3)) : null,
      approved_by: p.pre || decided ? tenant.contact_name : null,
      approval_via: p.pre ? "link" : decided ? (p.via ?? "desk") : null,
      checked_in_at: inAt, checked_in_by: inAt ? gateGuard : null, badge_no: inAt ? `B-${r.int(10, 99)}` : null,
      checked_out_at: outAt, checked_out_by: outAt ? guardName(1) : null, exit_gate_id: outAt ? p.gate : null,
      exit_remarks: outAt ? r.pick(["Badge returned", "Badge returned, laptop checked", "Left with host"]) : null,
      baggage: s.baggage ?? null,
      photo_hue: r.int(0, 360),
      escalated: p.escalated,
    };
  });

  // ---- Gate passes.
  const day = (h: number, m = 0, offsetDays = 0) => {
    // An IST wall-clock time on `today` (± days), as an instant.
    const d = new Date(`${today}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:30`);
    return new Date(d.getTime() + offsetDays * 86_400_000).toISOString();
  };
  const passes: GatePass[] = [
    { id: "gp-1", ref: "WP-9021", type: "work_permit", title: "HVAC duct servicing & filter replacement", holder: "Imran Qureshi", firm: "CoolBreeze HVAC Services", phone: PHONE(r), id_type: "aadhaar", id_last4: "4417", tenant_id: "tn-1", floor_id: "fl-1f", unit: "Suites 101–105", gate_ids: ["gt-3"], valid_from: day(9), valid_to: day(18), issued_at: day(8, 42), issued_by: gateGuard, materials: "Ladder, vacuum, 12 filters", deposit: "₹1,000 refundable · badge C-07", scope: "Replace AHU filters on 1F; no hot work", returnable: false, status: "active" },
    { id: "gp-2", ref: "MI-9022", type: "material_in", title: "Server rack & network switch delivery", holder: "Arun Prakash", firm: "Dell Global Logistics", phone: PHONE(r), id_type: "dl", id_last4: "0915", tenant_id: "tn-2", floor_id: "fl-2f", unit: "Suite 202", gate_ids: ["gt-3"], valid_from: day(10), valid_to: day(18), issued_at: day(9, 55), issued_by: gateGuard, materials: "1 × 42U rack, 2 × switches (challan DC-55821)", deposit: "—", scope: "Deliver to server room, tenant IT to receive", returnable: false, status: "active" },
    { id: "gp-3", ref: "VP-9023", type: "vip", title: "Board audit & due diligence visit", holder: "Vikramaditya Singhania", firm: "Singhania & Co", phone: PHONE(r), id_type: "passport", id_last4: "7720", tenant_id: "tn-2", floor_id: "fl-2f", unit: "Boardroom 2B", gate_ids: ["gt-1", "gt-4"], valid_from: day(11), valid_to: day(17), issued_at: day(10, 30), issued_by: guardName(1), materials: "—", deposit: "Car parking P-01 reserved", scope: "Escort from Gate 1 to 2F boardroom", returnable: false, status: "active" },
    { id: "gp-4", ref: "MO-9019", type: "material_out", title: "Projector & monitor sent for repair", holder: "Sanjay Gupta", firm: "Lumen Robotics Labs", phone: PHONE(r), id_type: "aadhaar", id_last4: "3308", tenant_id: "tn-3", floor_id: "fl-3f", unit: "Suite 304", gate_ids: ["gt-3"], valid_from: day(15, 0, -1), valid_to: day(18, 0, -1), issued_at: day(14, 40, -1), issued_by: guardName(2), materials: "1 × Epson projector (SN EP-7712), 1 × 27\" monitor", deposit: "—", scope: "Returnable within 10 days", returnable: true, status: "closed" },
    { id: "gp-5", ref: "WP-9018", type: "work_permit", title: "Fire alarm panel annual testing", holder: "Harpreet Singh", firm: "Siemens Fire Safety", phone: PHONE(r), id_type: "dl", id_last4: "5521", tenant_id: "tn-4", floor_id: "fl-gf", unit: "Fire control room", gate_ids: ["gt-1"], valid_from: day(7, 0, -2), valid_to: day(19, 0, -2), issued_at: day(6, 50, -2), issued_by: guardName(0), materials: "Test kit, smoke canister", deposit: "₹500 · badge C-02", scope: "Test all zones; alarms will sound 11:00–11:30", returnable: false, status: "active" },
  ];

  // ---- Floor inspections: a week of history plus today's progress.
  const inspections: FloorInspection[] = [];
  let ref = 8861;
  const answersFor = (fails: string[]) => Object.fromEntries(CHECKLIST.map((c) => [c.id, !fails.includes(c.id)]));
  for (let d = 6; d >= 1; d--) {
    floors.forEach((f, fi) => {
      if (r.chance(0.12)) return; // the occasional missed round
      const start = day(9 + fi, r.int(0, 40), -d);
      const fails = r.chance(0.18) ? [r.pick(CHECKLIST).id] : [];
      const dist = r.int(4, Math.round(f.radius_m * 0.8));
      inspections.push({
        id: `in-${ref}`, ref: `INS-${ref++}`, floor_id: f.id, inspector_id: crew[fi % Math.max(1, crew.length)]?.id ?? "",
        started_at: start, finished_at: new Date(new Date(start).getTime() + r.int(18, 46) * MIN).toISOString(),
        gps_distance_m: dist, gps_ok: true, answers: answersFor(fails), remarks: fails.length ? "Flagged to facility desk." : "All checks clear.",
        state: "completed", signed_off_by: "Supervisor",
      });
    });
  }
  const todays: [number, FloorInspection["state"], string[], number][] = [[0, "completed", [], 190], [1, "pending_approval", ["ck-04"], 70], [4, "completed", ["ck-07"], 130]];
  for (const [fi, state, fails, minsAgo] of todays) {
    const f = floors[fi]!;
    const start = ago(minsAgo + 31);
    inspections.push({
      id: `in-${ref}`, ref: `INS-${ref++}`, floor_id: f.id, inspector_id: crew[fi % Math.max(1, crew.length)]?.id ?? "",
      started_at: start, finished_at: ago(minsAgo), gps_distance_m: r.int(5, 20), gps_ok: true, answers: answersFor(fails),
      remarks: fails.length ? "Raised with facility; photo attached." : "All emergency exits clear. DB panels locked.",
      state, signed_off_by: state === "completed" ? "Supervisor" : null,
    });
  }

  // ---- Deployments.
  const dutySets: Duty[][] = [["gate", "visitor"], ["gate", "vehicle", "material"], ["inspection", "fire"], ["inspection", "visitor"], ["night_patrol", "cctv"], ["cctv", "emergency"], ["gate", "visitor"], ["inspection"]];
  const posts = ["Gate 2 · Visitor desk", "Gate 3 · Loading bay", "Tower A · Floors GF–3", "Tower B · Floors 1–6", "Basement & perimeter", "Control room", "Gate 1 · Main", "Reserve pool"];
  const deployments: Deployment[] = crew.map((g, i) => {
    const p = pres.get(g.id);
    const reserve = i === 7 || (crew.length > 3 && i === crew.length - 1 && i >= 5);
    const online = reserve ? false : p?.last_seen_at ? now.getTime() - new Date(p.last_seen_at).getTime() < 15 * MIN : i !== 4;
    const duties = dutySets[i % dutySets.length]!;
    return {
      guard: g,
      tower_id: reserve ? null : ["tw-a", "tw-a", "tw-a", "tw-b", "tw-u", "tw-a", "tw-a"][i] ?? "tw-a",
      floor_ids: reserve ? [] : duties.includes("inspection") ? (i % 2 ? ["fl-2f", "fl-3f"] : ["fl-gf", "fl-1f"]) : [],
      gate_ids: reserve ? [] : duties.includes("gate") ? [["gt-2"], ["gt-3", "gt-4"], [], [], [], [], ["gt-1"]][i] ?? ["gt-1"] : [],
      shift_id: reserve ? "sh-b" : i === 4 ? "sh-d" : i % 3 === 2 ? "sh-c" : "sh-a",
      duties: reserve ? [] : duties,
      post: reserve ? "Reserve pool" : posts[i]!,
      battery_pct: p?.battery_pct ?? (reserve ? null : r.int(i === 4 ? 9 : 28, 97)),
      online,
      last_seen_at: p?.last_seen_at ?? (online ? ago(r.int(0, 4)) : reserve ? null : ago(r.int(25, 70))),
      reserve,
      agency: i % 4 === 3 ? AGENCIES[1]! : AGENCIES[0]!,
      access_card: !reserve,
      biometric: i % 3 !== 1,
      app_access: true,
    };
  });

  const breadcrumbs: Breadcrumb[] = [];
  deployments.filter((d) => d.online).forEach((d, i) => {
    const cps = d.floor_ids.length ? checkpoints.filter((c) => d.floor_ids.includes(c.floor_id)) : [checkpoints[0]!];
    for (let k = 0; k < 3; k++) {
      const cp = cps[k % cps.length]!;
      breadcrumbs.push({
        id: `bc-${i}-${k}`, guard_id: d.guard.id, at: ago(8 + i * 11 + k * 37), checkpoint_id: cp.id,
        activity: k === 2 ? "Shift check-in at post" : d.duties.includes("inspection") ? (k === 0 ? "Floor survey in progress" : "Survey submitted") : "Checkpoint scan",
        accuracy_m: r.int(3, 14),
      });
    }
  });
  breadcrumbs.sort((a, b) => b.at.localeCompare(a.at));

  // ---- Footfall by hour, IST.
  const hourNow = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(now));
  const curve = [3, 9, 16, 22, 26, 31, 24, 19, 21, 17, 11, 6, 3];
  const hourly = curve.map((base, i) => {
    const h = 8 + i;
    return {
      hour: `${String(h).padStart(2, "0")}:00`,
      yesterday: Math.max(0, base + r.int(-3, 3)),
      today: h <= hourNow ? Math.max(0, Math.round(base * 1.12) + r.int(-2, 4)) : null,
    };
  });

  return {
    campus: { site_id: site.id, name: site.name, client_name: site.client_name, address: site.address, city: site.city, code, anchor },
    towers, floors, checkpoints, gates, tenants, shifts: SHIFTS, checklist: CHECKLIST,
    visitors, passes, inspections, deployments, breadcrumbs, hourly,
    now: now.toISOString(), today,
  };
}
