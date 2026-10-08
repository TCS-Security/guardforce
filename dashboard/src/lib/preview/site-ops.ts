import { rng } from "./rng";
import { addDays, istInstant, siteKind, type Crew, type CrewGuard, type CrewSite, type SiteKind } from "./crew";

/* ── Post orders ─────────────────────────────────────────────────────────── */

export type PostOrderKind = "gate" | "patrol" | "visitor" | "emergency" | "general";

export const POST_ORDER_KIND: Record<PostOrderKind, string> = {
  gate: "Gate & access",
  patrol: "Patrol",
  visitor: "Visitors & vehicles",
  emergency: "Emergency",
  general: "General conduct",
};

export type PostOrder = {
  id: string;
  site_id: string;
  kind: PostOrderKind;
  title: string;
  steps: string[];
  version: number;
  updated_at: string;
  updated_by: string;
  /** Guards at the site and the version each one last acknowledged, if any. */
  acks: { guard: CrewGuard; version: number | null; at: string | null }[];
};

type Template = { kind: PostOrderKind; title: string; steps: string[] };

/**
 * Standing orders worth reading. The first set is what every post gets; the rest are
 * written for the kind of place the post actually is, because a jewellery showroom and
 * a cable plant share almost nothing operationally and a guard can tell at a glance
 * when an order was written for somewhere else.
 */
const COMMON: Template[] = [
  { kind: "emergency", title: "Fire and medical emergency", steps: [
    "Raise SOS in the app first — it reaches the control room and your field officer at once — then call 101 for fire or 108 for an ambulance.",
    "Open the main gate fully and keep the approach clear for the vehicle.",
    "Send someone to the road to wave the ambulance in; minutes are lost looking for the gate.",
    "Do not leave your post until your relief or the field officer arrives.",
  ] },
  { kind: "general", title: "Conduct on post", steps: [
    "Full uniform, cap and ID card for the whole shift. The phone is for the app, nothing else.",
    "No sleeping, no personal visitors, no leaving the post without a relief standing on it.",
    "Hand over keys, radio, registers and any pending matter face to face, and record it.",
    "Any complaint about you goes to the field officer, not to an argument with the client's staff.",
  ] },
];

const BY_KIND: Record<SiteKind, Template[]> = {
  jewellery: [
    { kind: "gate", title: "Opening and closing the showroom", steps: [
      "Opening is two-person: the manager and the head guard together. Neither opens the shutter alone.",
      "Check every seal on the strong-room door before the alarm is disarmed; photograph the seal numbers.",
      "At closing, confirm the strong room is locked and the alarm armed, then record both names in the register.",
      "The armed guard stays on the door until the last staff member has left the building.",
    ] },
    { kind: "visitor", title: "Customers and the door", steps: [
      "One customer group through the door interlock at a time. Helmets and full-face covers come off before entry.",
      "Watch for anyone photographing camera positions, the shutter, or the strong-room side of the floor.",
      "Note the registration of any two-wheeler that circles or idles outside, and tell the manager.",
      "Never discuss stock, movement timings or the valuer's visits with anyone, including regulars.",
    ] },
    { kind: "patrol", title: "Floor and strong-room checks", steps: [
      "Walk the floor, rear exit and the ATM lobby once an hour; scan each checkpoint in the app.",
      "Check the strong-room door seal and the rear shutter lock on every round; photograph both.",
      "Report any camera showing a blank or frozen feed to the manager immediately, in writing.",
    ] },
  ],
  diplomatic: [
    { kind: "visitor", title: "Visa window queue", steps: [
      "Queue forms outside the building line, never across the pavement or the entrance bay.",
      "Check the appointment slip and photo ID before anyone enters; no appointment, no entry, no exceptions.",
      "Bags are searched at the door. Phones and cameras stay in the locker — issue a numbered token.",
      "Windows are 08:30–12:00 and 14:00–17:00. Nobody is admitted outside those hours without the mission's written instruction.",
    ] },
    { kind: "gate", title: "Access to the consular floor", steps: [
      "Mission staff by badge only; a forgotten badge is a call to the office, not a wave-through.",
      "Contractors need a work order and an escort for the whole visit.",
      "Outer security is the police's. Do not argue with or instruct them — report to the mission's security officer.",
    ] },
    { kind: "patrol", title: "Hourly floor and exit check", steps: [
      "Check the visa hall, lift lobby, fire exits and the locker room every hour, on the clock.",
      "Every entry in the log is timestamped. The mission audits this register monthly.",
      "Any unattended bag: clear the area first, then report. Do not touch or move it.",
    ] },
  ],
  hospital: [
    { kind: "visitor", title: "OPD and ward visiting", steps: [
      "One attender per patient during ward hours; issue a numbered attender pass and collect it on exit.",
      "Keep the ambulance bay and the casualty approach clear at all times, including of staff cars.",
      "De-escalate at the OPD counter: call the duty manager rather than arguing with an attender.",
      "Never physically restrain a patient or an attender. Call the duty manager and the nursing in-charge.",
    ] },
    { kind: "patrol", title: "Ward and pharmacy round", steps: [
      "Ward corridors, pharmacy shutter, records room and the duty-doctor room, twice a shift.",
      "Check that fire exits and oxygen manifold access are clear and unlocked from inside.",
      "Note anyone loitering near the pharmacy or the newborn ward and inform the duty manager.",
    ] },
    { kind: "gate", title: "Material and body movement", steps: [
      "No equipment leaves without a gate pass signed by the department head.",
      "Body release only against the discharge and clearance papers; log the time and the vehicle.",
    ] },
  ],
  mall: [
    { kind: "visitor", title: "Entry frisking", steps: [
      "Every visitor through the door frame; hand-held scan for anyone the frame flags.",
      "Separate queues for men and women; a woman is searched only by a lady searcher.",
      "Prohibited: weapons, outside food in sealed packs, pets, large bags over the stated size.",
      "Be quick and polite at peak. A queue at the door is a complaint to the mall office.",
    ] },
    { kind: "patrol", title: "Concourse and back-of-house", steps: [
      "Concourse rounds every ninety minutes; back-of-house corridors and the waste yard twice a shift.",
      "Fire exits must be clear and unlocked. A stacked exit is photographed and raised the same hour.",
      "Check the fire lane on every round and have anything parked in it moved.",
    ] },
    { kind: "gate", title: "Loading dock and closing", steps: [
      "Deliveries only through the dock, against a delivery note. No stock through the public entrance.",
      "Closing sweep after the last show: all floors, washrooms, service corridors, then shutters down.",
      "Count the shutters locked and record the time; the mall office checks this against the alarm log.",
    ] },
  ],
  hotel: [
    { kind: "visitor", title: "Lobby and guest privacy", steps: [
      "Never confirm whether a person is staying, or give out a room number, to anyone at all.",
      "Visitors to rooms are announced from the desk, not sent up.",
      "At the lobby, security stands by and the duty manager speaks. Do not argue with a guest.",
    ] },
    { kind: "gate", title: "Staff entry and key control", steps: [
      "Staff in and out through the back entry only, with bag check on exit, recorded.",
      "Master keys are signed in and out by name and time. An unreturned key is reported before you go off duty.",
      "Contractors need a work order, a pass and an escort above the lobby floor.",
    ] },
    { kind: "patrol", title: "Floor and back-of-house round", steps: [
      "Guest floors, fire exits, laundry, kitchen and the terrace door, twice a shift.",
      "Quiet in the corridors — no radio chatter past 22:00 on guest floors.",
      "Report a door left ajar or a fire door propped to the duty manager at once.",
    ] },
  ],
  factory: [
    { kind: "gate", title: "Material gate and gate passes", steps: [
      "Nothing leaves without a gate pass signed by stores, marked returnable or non-returnable.",
      "Weigh the vehicle in and out. The weighbridge ticket must match the pass; if it does not, hold the vehicle and call stores.",
      "Check the seal on every outbound container and record the seal number.",
      "Scrap and high-value metal move only in daylight, with the shift engineer informed.",
    ] },
    { kind: "patrol", title: "Perimeter and stores", steps: [
      "Fence line, the stores, the despatch dock and the DG room, once an hour through the night.",
      "Photograph any cut, gap or ladder left against the fence and raise it the same round.",
      "Check that the ETP and the transformer yard gates are locked.",
    ] },
    { kind: "visitor", title: "Contractor and visitor entry", steps: [
      "Contractor labour enters on the day's approved list only; no name, no entry.",
      "Safety shoes and helmet inside the plant area. Turn away anyone without them.",
      "Every visitor is escorted; nobody walks the shop floor alone.",
    ] },
  ],
  warehouse: [
    { kind: "gate", title: "Dock and vehicle control", steps: [
      "Every inbound and outbound vehicle is logged with its number, driver name and seal number.",
      "Check the seal before the dock door opens; a broken or mismatched seal stops the unload and is reported.",
      "Drivers stay in the driver rest area. Nobody from a vehicle walks into the storage floor.",
    ] },
    { kind: "patrol", title: "Yard and fence line", steps: [
      "Trailer yard, fence line, the baler and the waste area, once an hour at night.",
      "Check the baler and compactor are off and cool at the end of each shift.",
      "Any pallet stacked against the fence is moved and recorded; it is a ladder.",
    ] },
    { kind: "general", title: "Exit search", steps: [
      "Bag check on every person leaving the floor, staff and contractor alike, on every shift.",
      "A lady searcher checks women; never otherwise.",
      "A recovery goes in the register and to the shift manager the same hour, not at the end of the day.",
    ] },
  ],
  bank: [
    { kind: "gate", title: "Branch opening and closing", steps: [
      "Opening with the branch manager or the authorised officer present. Never alone.",
      "Check the shutter, grille, strong-room door and the alarm panel before staff enter; report anything disturbed before anyone goes in.",
      "At closing, confirm the strong room is locked, the alarm armed and the shutter down, with the officer present.",
    ] },
    { kind: "visitor", title: "Customers and the ATM lobby", steps: [
      "Helmets and full-face covers come off at the door.",
      "Only one person at the ATM at a time; nobody waits inside the lobby after banking hours.",
      "Watch for anyone fitting a device to the card slot or the keypad, or loitering with a phone camera.",
    ] },
    { kind: "patrol", title: "Cash movement", steps: [
      "When the cash van arrives, hold the lobby, keep the path clear and face outward.",
      "Never touch or carry the cash boxes. Your job is the approach, not the cash.",
      "Log the van number, crew names and the in and out times.",
    ] },
  ],
  school: [
    { kind: "gate", title: "Arrival and dispatch", steps: [
      "A child leaves only with a parent or a named guardian on the authorisation card. No card, no release — call the office.",
      "Bus bay is cleared of parked cars fifteen minutes before the buses arrive.",
      "Gates are locked between dispatch and the next scheduled opening.",
    ] },
    { kind: "visitor", title: "Visitors on campus", steps: [
      "Every visitor signs in at the gate, gets a badge and is escorted to the office. Nobody walks the campus unescorted.",
      "Contractors and deliveries come only outside class hours.",
      "Report any adult photographing children or waiting outside the fence, with the vehicle number.",
    ] },
    { kind: "patrol", title: "Campus round", steps: [
      "Academic blocks, playground, water tanks, back gate and the terrace doors, twice a shift.",
      "Check the back gate lock on every round; a cut chain is reported immediately, not at handover.",
      "After hours, confirm every classroom and lab is locked and the lights are off.",
    ] },
  ],
  export: [
    { kind: "general", title: "Exit frisking", steps: [
      "Every worker is searched on exit, every shift, without exception for seniority.",
      "Women are searched only by a lady searcher, in the screened area.",
      "A recovery is booked back into finishing the same evening and handed to HR with a written note.",
      "Buyer audits check that a same-sex searcher was on every shift. The roster must show it.",
    ] },
    { kind: "gate", title: "Goods and sample movement", steps: [
      "Finished goods leave only against a packing list and a signed gate pass.",
      "Samples out need the merchandiser's signature; log the piece count.",
      "Check the seal on every export container and photograph it with the container number.",
    ] },
    { kind: "patrol", title: "Floor and fire check", steps: [
      "Cutting, stitching and finishing floors twice a shift; check fire exits are clear of bundles.",
      "Confirm the fire extinguishers at the exits are in place and in date.",
    ] },
  ],
  residential: [
    { kind: "visitor", title: "Residents and visitors", steps: [
      "Call the flat before any visitor goes up. If nobody answers, the visitor waits at the gate.",
      "Log every delivery rider and cab with the flat number; they do not go above the lobby.",
      "Domestic help and drivers enter on their society card only.",
      "Be courteous to residents. A dispute goes to the association's secretary through the field officer, never into an argument at the gate.",
    ] },
    { kind: "patrol", title: "Block and basement round", steps: [
      "All blocks, both basements, the clubhouse, the pump room and the terrace doors, every two hours at night.",
      "Check the basement cycle and two-wheeler stands; note anything being removed after 22:00.",
      "Confirm the rear service gate is locked on every round and photograph the lock.",
    ] },
    { kind: "gate", title: "Vehicles and material", steps: [
      "Residents' stickers are checked, not assumed. A visitor car parks in the visitor bay only.",
      "No furniture or appliance leaves without a gate pass signed by the secretary, even with the resident present.",
      "Shifting in or out is allowed only in the hours the association has set.",
    ] },
  ],
  corporate: [
    { kind: "gate", title: "Main gate and access", steps: [
      "Employees by access card. A forgotten card means a temporary pass from reception, not a wave-through.",
      "Every goods vehicle is checked in the boot and the cabin; note the seal number in the register.",
      "No laptop or equipment leaves without a gate pass matched to the asset tag.",
    ] },
    { kind: "visitor", title: "Visitor entry", steps: [
      "Photo ID and the name of the person being met; call the host before issuing a badge.",
      "Issue a numbered badge and record it. A badge not returned by 20:00 goes to the supervisor.",
      "Watch for tailgating at the turnstile — one badge, one person.",
    ] },
    { kind: "patrol", title: "Floor and parking round", steps: [
      "Lobbies, both basements, the fire exits and the terrace doors, twice a shift.",
      "Check that fire exits are clear and the extinguishers are in place and in date.",
      "Note any vehicle in the fire lane and have it moved.",
    ] },
  ],
};

/** Three to five standing orders per site; some revised recently and not yet read by everyone. */
export function generatePostOrders(crew: Crew): PostOrder[] {
  const out: PostOrder[] = [];
  for (const site of crew.sites) {
    const r = rng(`po:${site.id}`);
    const guards = crew.guards.filter((g) => g.site_id === site.id);
    const specific = BY_KIND[siteKind(site)];
    const picks = [...specific, ...COMMON].filter((_, i) => i < 3 || r.chance(0.7));
    for (const t of picks) {
      const version = r.int(1, 4);
      const ageDays = r.int(0, 40);
      const updated_at = istInstant(addDays(crew.today, -ageDays), r.int(9, 18), r.int(0, 59));
      const acks = guards.map((guard) => {
        const read = ageDays > 7 ? r.chance(0.95) : r.chance(0.55);
        return read
          ? { guard, version, at: istInstant(addDays(crew.today, -Math.max(0, ageDays - r.int(0, Math.min(ageDays, 3)))), r.int(7, 22)) }
          : { guard, version: version > 1 && r.chance(0.6) ? version - 1 : null, at: null };
      });
      out.push({ id: `po-${site.id}-${t.kind}`, site_id: site.id, kind: t.kind, title: t.title, steps: t.steps, version, updated_at, updated_by: crew.staff.length ? r.pick(crew.staff) : "Operations", acks });
    }
  }
  return out;
}

/** Guards who have read the current version, out of everyone posted at the site. */
export function ackProgress(order: Pick<PostOrder, "version" | "acks">): { read: number; total: number } {
  return { read: order.acks.filter((a) => a.version === order.version).length, total: order.acks.length };
}

/** A new version clears every acknowledgement of the old one. */
export function publishRevision(order: PostOrder, steps: string[], by: string, at: string): PostOrder {
  return { ...order, steps, version: order.version + 1, updated_at: at, updated_by: by };
}

/* ── Handover (pass-down) ────────────────────────────────────────────────── */

export type HandoverPriority = "routine" | "watch" | "urgent";

export type Handover = {
  id: string;
  site: CrewSite;
  from: CrewGuard;
  to: CrewGuard | null;
  at: string;
  priority: HandoverPriority;
  note: string;
  /** What physically changed hands. */
  items: string[];
  read_at: string | null;
};

const NOTES: { priority: HandoverPriority; text: string }[] = [
  { priority: "routine", text: "All quiet. Register written up to 07:55. Two courier parcels kept in the cabin for B-wing." },
  { priority: "routine", text: "Water tanker came at 05:30, 12 kL, slip in the register." },
  { priority: "watch", text: "Car KA-05-MX-2231 parked in visitor bay since evening, owner not traced. Keep an eye on it." },
  { priority: "watch", text: "Basement light near pillar 14 is not working. Maintenance informed, ticket #4471." },
  { priority: "urgent", text: "Back gate latch is broken — tied with chain for now. Do not leave the back gate unattended." },
  { priority: "routine", text: "Facility manager will come at 10:00 with the fire audit team. Keep the fire register ready." },
  { priority: "watch", text: "Ex-employee (Ravi, housekeeping) tried to enter at 22:10, turned back. Do not allow without HR call." },
  { priority: "urgent", text: "CCTV DVR showing no signal on camera 3 and 4 since 03:00. Informed the client's IT." },
];

const ITEMS = ["Gate keys ×3", "Radio", "Visitor register", "Torch", "Vehicle register", "Lathi", "Key box key"];

/** Two handovers a day per site over the last five days; today's not all read yet. With `now`, nothing after it. */
export function generateHandovers(crew: Crew, now?: Date): Handover[] {
  const out: Handover[] = [];
  for (const site of crew.sites) {
    const guards = crew.guards.filter((g) => g.site_id === site.id);
    if (guards.length === 0) continue;
    const r = rng(`ho:${site.id}:${crew.today}`);
    for (let back = 0; back < 5; back++) {
      const date = addDays(crew.today, -back);
      for (const hour of [8, 20]) {
        if (back === 0 && hour === 20) continue;
        const n = r.pick(NOTES);
        const from = r.pick(guards);
        const to = guards.length > 1 ? r.pick(guards.filter((g) => g.id !== from.id)) : null;
        const at = istInstant(date, hour, r.int(-8, 6));
        out.push({
          id: `ho-${site.id}-${date}-${hour}`,
          site, from, to, at,
          priority: n.priority,
          note: n.text,
          items: ITEMS.filter(() => r.chance(0.45)).slice(0, 4),
          read_at: back === 0 && r.chance(0.5) ? null : new Date(new Date(at).getTime() + r.int(2, 15) * 60000).toISOString(),
        });
      }
    }
  }
  const cutoff = now?.toISOString();
  return out
    .filter((h) => !cutoff || h.at <= cutoff)
    .map((h) => (cutoff && h.read_at && h.read_at > cutoff ? { ...h, read_at: null } : h))
    .sort((a, b) => b.at.localeCompare(a.at));
}
