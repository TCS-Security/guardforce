import { rng } from "./rng";
import { addDays, istInstant, type Crew, type CrewGuard, type CrewSite } from "./crew";

/**
 * Daily Activity Reports: one branded summary per client, emailed every morning,
 * covering the previous day at each of the client's sites. The client never has to
 * ask "were the guards there?" again.
 */
export type ClientAccount = {
  key: string;
  name: string;
  sites: CrewSite[];
  recipients: string[];
  send_at: string;
  enabled: boolean;
};

export type DeliveryStatus = "opened" | "delivered" | "bounced";

export type SentReport = { id: string; client: string; date: string; sent_at: string; status: DeliveryStatus; opened_at: string | null; recipients: number };

export type DarSite = {
  site: CrewSite;
  posts: number;
  present: number;
  late: number;
  absent: number;
  covered_pct: number;
  patrols_done: number;
  patrols_due: number;
  checks_on_time: number;
  checks_total: number;
  incidents: { at: string; title: string }[];
  guards: { guard: CrewGuard; in: string; out: string }[];
};

/** Clients are the distinct `client_name`s on sites; a site without one is its own client. */
export function clientAccounts(crew: Crew): ClientAccount[] {
  const by = new Map<string, CrewSite[]>();
  for (const s of crew.sites) {
    const key = s.client_name?.trim() || s.name;
    by.set(key, [...(by.get(key) ?? []), s]);
  }
  return [...by.entries()].map(([name, sites], i) => {
    const r = rng(`client:${name}`);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 14) || "client";
    return {
      // The slug alone can collide (long or non-Latin names); the index keeps keys unique.
      key: `${i}-${slug}`,
      name,
      sites,
      recipients: [`facility@${slug}.in`, ...(r.chance(0.6) ? [`security.head@${slug}.in`] : [])],
      send_at: r.pick(["07:30", "08:00", "09:00"]),
      enabled: r.chance(0.85),
    };
  });
}

/** A week of sends ending today; with `now`, sends and opens after it are left out. */
export function sentLog(accounts: ClientAccount[], today: string, now?: Date): SentReport[] {
  const out: SentReport[] = [];
  for (const a of accounts) {
    if (!a.enabled) continue;
    const r = rng(`sent:${a.key}:${today}`);
    for (let back = 0; back < 7; back++) {
      const date = addDays(today, -back - 1);
      const [hh, mm] = a.send_at.split(":").map(Number) as [number, number];
      const sent_at = istInstant(addDays(date, 1), hh, mm);
      const status: DeliveryStatus = r.chance(0.04) ? "bounced" : r.chance(0.7) ? "opened" : "delivered";
      out.push({
        id: `dar-${a.key}-${date}`, client: a.name, date, sent_at, status,
        opened_at: status === "opened" ? new Date(new Date(sent_at).getTime() + r.int(4, 300) * 60000).toISOString() : null,
        recipients: a.recipients.length,
      });
    }
  }
  const cutoff = now?.toISOString();
  return out
    .filter((s) => !cutoff || s.sent_at <= cutoff)
    .map((s) => (cutoff && s.opened_at && s.opened_at > cutoff ? { ...s, status: "delivered" as const, opened_at: null } : s))
    .sort((a, b) => b.sent_at.localeCompare(a.sent_at));
}

const INCIDENTS = ["Unknown person loitering near back gate, sent away", "Water leakage in basement reported to maintenance", "Delivery van without pass stopped at gate", "Street dog bit a visitor, first aid given"];

/** The report body for one client and day, site by site. */
export function buildDar(account: ClientAccount, crew: Crew, date: string): DarSite[] {
  return account.sites.map((site) => {
    const r = rng(`dar:${site.id}:${date}`);
    const atSite = crew.guards.filter((g) => g.site_id === site.id);
    const posts = Math.max(site.guards_required, 1) * 2; // day and night
    const absent = r.chance(0.7) ? 0 : r.int(1, 2);
    const present = Math.max(0, posts - absent);
    const late = r.int(0, Math.min(2, present));
    const patrols_due = 6 * Math.max(1, site.guards_required);
    const patrols_done = patrols_due - r.int(0, 2);
    const checks_total = r.int(3, 9);
    return {
      site, posts, present, late, absent,
      covered_pct: Math.round((100 * present) / posts),
      patrols_done, patrols_due,
      checks_on_time: checks_total - r.int(0, 1),
      checks_total,
      incidents: r.chance(0.35) ? [{ at: istInstant(date, r.int(9, 23), r.int(0, 59)), title: r.pick(INCIDENTS) }] : [],
      guards: atSite.slice(0, posts).map((guard, i) => {
        const day = i % 2 === 0;
        return { guard, in: istInstant(date, day ? 7 : 19, 50 + r.int(0, 15)), out: istInstant(day ? date : addDays(date, 1), day ? 20 : 8, r.int(0, 10)) };
      }),
    };
  });
}
