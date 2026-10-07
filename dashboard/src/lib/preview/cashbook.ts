import { rng } from "./rng";
import { addDays, type Crew } from "./crew";

export type CashDirection = "in" | "out";

export type CashCategory =
  | "client_payment" | "advance_recovery" | "other_in"
  | "salary_advance" | "uniform" | "fuel" | "site_expense" | "office" | "other_out";

export const CASH_CATEGORIES: Record<CashCategory, { label: string; direction: CashDirection }> = {
  client_payment: { label: "Client payment", direction: "in" },
  advance_recovery: { label: "Advance recovered", direction: "in" },
  other_in: { label: "Other income", direction: "in" },
  salary_advance: { label: "Salary advance", direction: "out" },
  uniform: { label: "Uniforms & kit", direction: "out" },
  fuel: { label: "Fuel & travel", direction: "out" },
  site_expense: { label: "Site expense", direction: "out" },
  office: { label: "Office", direction: "out" },
  other_out: { label: "Other expense", direction: "out" },
};

export type CashEntry = {
  id: string;
  date: string;
  category: CashCategory;
  amount: number;
  note: string;
  /** Who the money went to or came from: a guard, a client, a vendor. */
  party: string;
  site_name: string | null;
  mode: "cash" | "upi" | "bank";
  recorded_by: string;
};

export type LedgerRow = CashEntry & { balance: number };

const NOTES: Record<CashCategory, string[]> = {
  client_payment: ["Invoice settled", "Part payment against invoice", "Monthly service charges"],
  advance_recovery: ["Recovered from salary"],
  other_in: ["Scrap sale", "Training fee"],
  salary_advance: ["Advance — family emergency", "Advance — festival", "Advance — rent"],
  uniform: ["2 shirts, 1 trouser", "Winter jackets", "Lathi and whistle", "Shoes"],
  fuel: ["Supervisor rounds", "Night patrol bike", "Auto to site"],
  site_expense: ["Torch batteries", "Register books", "Gate lock replaced", "Rain coats"],
  office: ["Printer toner", "Tea and snacks", "Courier"],
  other_out: ["Police verification fee", "Bank charges"],
};

/** Signed amount: positive for money in, negative for money out. */
export function signed(e: Pick<CashEntry, "category" | "amount">): number {
  return CASH_CATEGORIES[e.category].direction === "in" ? e.amount : -e.amount;
}

/** Oldest-first running balance from an opening figure, returned newest first for display. */
export function ledger(entries: CashEntry[], opening: number): LedgerRow[] {
  const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let balance = opening;
  const rows = ordered.map((e) => ({ ...e, balance: (balance += signed(e)) }));
  return rows.reverse();
}

/** Money out per category, largest first. */
export function spendByCategory(entries: CashEntry[]): { category: CashCategory; total: number }[] {
  const totals = new Map<CashCategory, number>();
  for (const e of entries) {
    if (CASH_CATEGORIES[e.category].direction !== "out") continue;
    totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
  }
  return [...totals.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}

/** About a month of petty-cash and collections traffic. */
export function generateCashbook(crew: Crew, ownerName: string): { opening: number; entries: CashEntry[] } {
  const r = rng(`cash:${crew.today.slice(0, 7)}`);
  const entries: CashEntry[] = [];
  const outs: CashCategory[] = ["salary_advance", "salary_advance", "uniform", "fuel", "fuel", "site_expense", "site_expense", "office", "other_out"];
  for (let back = 30; back >= 0; back--) {
    const date = addDays(crew.today, -back);
    const n = r.int(0, 3);
    for (let i = 0; i < n; i++) {
      const category = r.chance(0.15) ? r.pick<CashCategory>(["client_payment", "client_payment", "advance_recovery", "other_in"]) : r.pick(outs);
      const site = crew.sites.length ? r.pick(crew.sites) : null;
      const guard = crew.guards.length ? r.pick(crew.guards) : null;
      const amount =
        category === "client_payment" ? r.int(4, 30) * 5000
        : category === "salary_advance" ? r.pick([1000, 1500, 2000, 3000, 5000])
        : category === "advance_recovery" ? r.pick([1000, 2000])
        : category === "uniform" ? r.int(3, 18) * 150
        : r.int(2, 30) * 50;
      const party =
        category === "client_payment" ? site?.client_name ?? site?.name ?? "Client"
        : category === "salary_advance" || category === "advance_recovery" || category === "uniform" ? guard?.full_name ?? "Guard"
        : category === "fuel" ? "Supervisor"
        : r.pick(["Local vendor", "Stationery shop", "Hardware store"]);
      entries.push({
        id: `cb-${date}-${i}`,
        date,
        category,
        amount,
        note: r.pick(NOTES[category]),
        party,
        site_name: category === "office" ? null : site?.name ?? null,
        mode: category === "client_payment" ? r.pick(["bank", "upi"] as const) : r.pick(["cash", "cash", "upi"] as const),
        recorded_by: r.chance(0.6) ? ownerName : "Office cashier",
      });
    }
  }
  return { opening: 85000, entries };
}
