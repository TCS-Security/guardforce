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
};

export type CrewSite = {
  id: string;
  name: string;
  client_name: string | null;
  city: string | null;
  guards_required: number;
};

export type Crew = { guards: CrewGuard[]; sites: CrewSite[]; today: string };

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
