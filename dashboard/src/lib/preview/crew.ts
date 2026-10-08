/**
 * The real people and places a preview module builds its sample rows around. Loaded
 * from Supabase under RLS (see `loadPreviewCrew`), so sample data stays inside the
 * signed-in user's site scope and every guard name links to a real profile.
 */
export type CrewGuard = {
  id: string;
  full_name: string;
  employee_code: string | null;
  phone: string;
  site_id: string | null;
  site_name: string | null;
  /** Masked to the last four digits; enough to reconcile a payout to a payslip. */
  bank_account_masked: string | null;
  bank_ifsc: string | null;
};

export type CrewSite = {
  id: string;
  name: string;
  client_name: string | null;
  city: string | null;
  guards_required: number;
};

/** Office staff names, so sample rows are signed by this tenant's people, not another's. */
export type Crew = { guards: CrewGuard[]; sites: CrewSite[]; staff: string[]; today: string };

/**
 * What kind of place a site is, inferred from its name and client. Standing orders,
 * handovers and gate rules differ far more by this than by anything else: a jewellery
 * showroom cares about the strong room and a two-person opening, a consulate about the
 * visa queue, a cable plant about copper leaving on a gate pass.
 *
 * Keyword matching on a name is crude, and `corporate` is the deliberate fallback — a
 * generic office order is wrong for nobody, where a factory order on a bank branch is
 * obviously wrong to the person reading it.
 */
export type SiteKind =
  | "jewellery" | "diplomatic" | "hospital" | "mall" | "hotel" | "factory"
  | "warehouse" | "bank" | "school" | "export" | "residential" | "corporate";

export function siteKind(site: Pick<CrewSite, "name" | "client_name">): SiteKind {
  const s = `${site.name} ${site.client_name ?? ""}`.toLowerCase();
  if (/jewell|goldsmith|bullion/.test(s)) return "jewellery";
  if (/consulate|embassy of|high commission|deputy high/.test(s)) return "diplomatic";
  if (/hospital|clinic|nursing home|medical cent/.test(s)) return "hospital";
  if (/\bmall\b|marketcity|shopping cent|uptown/.test(s)) return "mall";
  if (/hotel|holiday inn|resort|marriott|hyatt|residency inn/.test(s)) return "hotel";
  if (/fulfil|fulfill|warehouse|distribution cent|logistics park/.test(s)) return "warehouse";
  if (/plant|factory|manufactur|industries|machinery|\bworks\b|refinery/.test(s)) return "factory";
  if (/\bbank\b|\batm\b|credit union/.test(s)) return "bank";
  if (/school|academy|college|vidya|university|campus trust/.test(s)) return "school";
  if (/export|garment|apparel|textile/.test(s)) return "export";
  if (/apartment|township|residenc|enclave|metropolis|meadows|greens\b/.test(s)) return "residential";
  return "corporate";
}

/** Add whole days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** An instant at a local IST wall-clock time on a YYYY-MM-DD date. */
export function istInstant(date: string, hh: number, mm = 0): string {
  const d = new Date(`${date}T00:00:00+05:30`);
  d.setUTCMinutes(d.getUTCMinutes() + hh * 60 + mm);
  return d.toISOString();
}

/** ₹1,23,456 — Indian digit grouping, no paise. */
export function fmtINR(amount: number): string {
  const sign = amount < 0 ? "−" : "";
  return `${sign}₹${Math.round(Math.abs(amount)).toLocaleString("en-IN")}`;
}
