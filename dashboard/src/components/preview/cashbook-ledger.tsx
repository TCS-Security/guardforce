"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Section } from "@/components/gf/section";
import { StatTile } from "@/components/gf/stat-tile";
import { StatusPill } from "@/components/gf/status-pill";
import { Mono } from "@/components/gf/mono";
import { fmtDate } from "@/lib/domain/format";
import { fmtINR } from "@/lib/preview/crew";
import { CASH_CATEGORIES, ledger, signed, spendByCategory, type CashCategory, type CashEntry } from "@/lib/preview/cashbook";
import { cn } from "cn";

type Filter = "all" | "in" | "out";

export function CashbookLedger({ opening, initial, sites, today, recorder }: { opening: number; initial: CashEntry[]; sites: string[]; today: string; recorder: string }) {
  const [entries, setEntries] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const rows = useMemo(() => ledger(entries, opening), [entries, opening]);
  const balance = rows[0]?.balance ?? opening;
  const month = today.slice(0, 7);
  const thisMonth = entries.filter((e) => e.date.startsWith(month));
  const moneyIn = thisMonth.filter((e) => signed(e) > 0).reduce((n, e) => n + e.amount, 0);
  const moneyOut = thisMonth.filter((e) => signed(e) < 0).reduce((n, e) => n + e.amount, 0);
  const advances = entries.filter((e) => e.category === "salary_advance").reduce((n, e) => n + e.amount, 0)
    - entries.filter((e) => e.category === "advance_recovery").reduce((n, e) => n + e.amount, 0);
  const spend = spendByCategory(thisMonth);
  const maxSpend = spend[0]?.total ?? 1;
  const shown = rows.filter((r) => filter === "all" || CASH_CATEGORIES[r.category].direction === filter);

  function add(entry: CashEntry) {
    setEntries((xs) => [...xs, entry]);
    toast.success(`${CASH_CATEGORIES[entry.category].label} of ${fmtINR(entry.amount)} added`, { description: "Preview only — not saved." });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile label="Cash in hand" value={fmtINR(balance)} tone="olive" hint={`opened the period at ${fmtINR(opening)}`} style={{ ["--i" as string]: 1 }} />
        <StatTile label="In this month" value={fmtINR(moneyIn)} tone="present" hint="collections and recoveries" style={{ ["--i" as string]: 2 }} />
        <StatTile label="Out this month" value={fmtINR(moneyOut)} hint={`${thisMonth.filter((e) => signed(e) < 0).length} payments`} style={{ ["--i" as string]: 3 }} />
        <StatTile label="Advances outstanding" value={fmtINR(advances)} tone={advances > 0 ? "half-day" : "neutral"} hint="recovered from next payroll" style={{ ["--i" as string]: 4 }} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <Section
          title="Ledger"
          description="Newest first, with the balance after each entry"
          bodyClassName="p-0"
          actions={
            <>
              <ToggleGroup value={[filter]} onValueChange={(v) => v[0] && setFilter(v[0] as Filter)} size="sm" variant="outline" aria-label="Filter entries">
                <ToggleGroupItem value="all">All</ToggleGroupItem>
                <ToggleGroupItem value="in">In</ToggleGroupItem>
                <ToggleGroupItem value="out">Out</ToggleGroupItem>
              </ToggleGroup>
              <AddEntryDialog sites={sites} today={today} recorder={recorder} onAdd={add} />
            </>
          }
          style={{ ["--i" as string]: 5 }}
        >
          <div className="max-h-[640px] overflow-auto">
            <table className="w-full text-sm" aria-label="Cashbook ledger">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="eyebrow border-b text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                  <th>Date</th>
                  <th className="min-w-[220px]">Entry</th>
                  <th>Mode</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((r) => {
                  const inflow = signed(r) > 0;
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-muted/50">
                      <td className="px-4 py-2.5 whitespace-nowrap"><Mono className="text-xs">{fmtDate(`${r.date}T12:00:00+05:30`, undefined, "d MMM")}</Mono></td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full", inflow ? "bg-present/12 text-present" : "bg-muted text-muted-foreground")}>
                            {inflow ? <ArrowDownLeft className="size-3" /> : <ArrowUpRight className="size-3" />}
                          </span>
                          <span className="font-medium">{CASH_CATEGORIES[r.category].label}</span>
                          <span className="truncate text-muted-foreground">· {r.party}</span>
                        </div>
                        <div className="mt-0.5 pl-7 text-xs text-muted-foreground">{r.note}{r.site_name ? ` · ${r.site_name}` : ""}</div>
                      </td>
                      <td className="px-4 py-2.5"><StatusPill tone="neutral" dot={false} size="xs">{r.mode.toUpperCase()}</StatusPill></td>
                      <td className={cn("px-4 py-2.5 text-right whitespace-nowrap", inflow && "text-present")}><Mono>{inflow ? "+" : "−"}{r.amount.toLocaleString("en-IN")}</Mono></td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap"><Mono className="text-muted-foreground">{r.balance.toLocaleString("en-IN")}</Mono></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Where the cash went" description="Money out this month, by category" style={{ ["--i" as string]: 6 }} className="xl:self-start">
          <ul className="flex flex-col gap-3">
            {spend.map(({ category, total }) => (
              <li key={category} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span>{CASH_CATEGORIES[category].label}</span>
                  <Mono className="text-xs">{fmtINR(total)}</Mono>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(total / maxSpend) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}

function AddEntryDialog({ sites, today, recorder, onAdd }: { sites: string[]; today: string; recorder: string; onAdd: (e: CashEntry) => void }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<CashCategory>("salary_advance");
  const [error, setError] = useState<string | null>(null);

  function submit(form: FormData) {
    const amount = Number(form.get("amount"));
    const party = String(form.get("party") ?? "").trim();
    if (!Number.isFinite(amount) || amount <= 0) return setError("Enter an amount above zero.");
    if (!party) return setError("Say who the money went to or came from.");
    const site = String(form.get("site") ?? "");
    onAdd({
      id: `cb-new-${Date.now()}`,
      date: String(form.get("date") || today),
      category,
      amount: Math.round(amount),
      note: String(form.get("note") ?? "").trim() || CASH_CATEGORIES[category].label,
      party,
      site_name: site && site !== "none" ? site : null,
      mode: (String(form.get("mode")) as CashEntry["mode"]) || "cash",
      recorded_by: recorder,
    });
    setError(null);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm"><Plus data-icon="inline-start" /> Add entry</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a cashbook entry</DialogTitle>
          <DialogDescription>Record cash paid out or received. Salary advances are recovered from the guard’s next payslip.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <Field>
            <Label htmlFor="cb-cat">Category</Label>
            <Select value={category} onValueChange={(v) => v && setCategory(v as CashCategory)}>
              <SelectTrigger id="cb-cat" className="w-full" aria-label="Category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CASH_CATEGORIES) as CashCategory[]).map((c) => (
                  <SelectItem key={c} value={c}>{CASH_CATEGORIES[c].direction === "in" ? "In · " : "Out · "}{CASH_CATEGORIES[c].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label htmlFor="cb-amount">Amount (₹)</Label>
              <Input id="cb-amount" name="amount" type="number" min={1} inputMode="numeric" required />
            </Field>
            <Field>
              <Label htmlFor="cb-date">Date</Label>
              <Input id="cb-date" name="date" type="date" defaultValue={today} max={today} />
            </Field>
          </div>
          <Field>
            <Label htmlFor="cb-party">Paid to / received from</Label>
            <Input id="cb-party" name="party" placeholder="Guard, client or vendor" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label htmlFor="cb-mode">Mode</Label>
              <Select name="mode" defaultValue="cash">
                <SelectTrigger id="cb-mode" className="w-full" aria-label="Mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Label htmlFor="cb-site">Site</Label>
              <Select name="site" defaultValue="none">
                <SelectTrigger id="cb-site" className="w-full" aria-label="Site"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No site</SelectItem>
                  {sites.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field>
            <Label htmlFor="cb-note">Note</Label>
            <Input id="cb-note" name="note" placeholder="What it was for" />
          </Field>
          {error && <p role="alert" className="rounded-md border border-absent/30 bg-absent/8 px-3 py-2 text-sm text-absent">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Add entry</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
