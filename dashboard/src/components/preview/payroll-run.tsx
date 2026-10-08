"use client";

import { useState } from "react";
import { Check, Download, FileSpreadsheet, Landmark, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Section } from "@/components/gf/section";
import { StatTile } from "@/components/gf/stat-tile";
import { StatusPill } from "@/components/gf/status-pill";
import { Mono } from "@/components/gf/mono";
import { DataTable, type DataTableColumn } from "@/components/gf/data-table";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { fmtMinutes } from "@/lib/domain/format";
import { fmtINR } from "@/lib/preview/crew";
import { DEFAULT_PAY_POLICY, PAYROLL_STAGES, payrollTotals, type PayrollRow, type PayrollStage } from "@/lib/preview/payroll";
import { cn } from "cn";

const NEXT_ACTION: Record<PayrollStage, { label: string; icon: typeof Check } | null> = {
  draft: { label: "Start review", icon: Check },
  review: { label: "Approve payroll", icon: Check },
  approved: { label: "Mark as paid", icon: Landmark },
  paid: null,
};

const money = (n: number) => <Mono>{n === 0 ? <span className="text-muted-foreground">0</span> : n.toLocaleString("en-IN")}</Mono>;

export function PayrollRun({ rows, month }: { rows: PayrollRow[]; month: string }) {
  const [stage, setStage] = useState<PayrollStage>("review");
  const [open, setOpen] = useState<PayrollRow | null>(null);
  const t = payrollTotals(rows);
  const stageIndex = PAYROLL_STAGES.findIndex((s) => s.key === stage);
  const next = NEXT_ACTION[stage];


  /**
   * The NEFT bulk file an agency uploads to its bank to pay everyone at once. A button
   * that only raised a toast was the weakest thing on this screen: the whole argument of
   * the payroll module is that verified attendance becomes a payment without re-keying,
   * and that argument is only credible if the file actually comes out.
   *
   * Account numbers are masked here exactly as they are stored. A live run would join the
   * full number from the bank mandate at the point of upload.
   */
  function downloadBankFile() {
    const header = ["Employee code", "Beneficiary name", "Account (masked)", "IFSC", "Amount (INR)", "Narration"];
    const paid = rows.filter((r) => !r.hold);
    const lines = paid.map((r) => [
      r.guard.employee_code ?? "",
      r.guard.full_name,
      r.guard.bank_account_masked ?? "NOT ON FILE",
      r.guard.bank_ifsc ?? "NOT ON FILE",
      String(r.slip.net),
      `SALARY ${month}`,
    ]);
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = [header, ...lines].map((row) => row.map(esc).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `neft-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    const held = rows.length - paid.length;
    toast.success(`NEFT file for ${month}`, {
      description: `${paid.length} beneficiaries, ${fmtINR(paid.reduce((n, r) => n + r.slip.net, 0))}` +
        (held ? ` · ${held} held back and not in the file` : ""),
    });
  }

  function advance() {
    const to = PAYROLL_STAGES[stageIndex + 1];
    if (!to) return;
    setStage(to.key);
    toast.success(`Payroll moved to “${to.label}”`, { description: "Preview only — not saved." });
  }

  const columns: DataTableColumn<PayrollRow>[] = [
    {
      key: "guard", header: "Guard", pin: true, width: 220,
      cell: (r) => (
        <button type="button" onClick={() => setOpen(r)} className="flex items-center gap-2 text-left hover:underline">
          <GuardAvatar name={r.guard.full_name} size="xs" />
          <span className="truncate font-medium">{r.guard.full_name}</span>
        </button>
      ),
    },
    { key: "code", header: "Code", width: 90, cell: (r) => <Mono className="text-xs">{r.guard.employee_code ?? "—"}</Mono> },
    { key: "days", header: "Paid days", align: "right", cell: (r) => <Mono>{r.slip.payable_days}</Mono> },
    { key: "ot", header: "OT", align: "right", cell: (r) => <Mono className="text-xs">{r.slip.ot_minutes ? fmtMinutes(r.slip.ot_minutes) : "—"}</Mono> },
    { key: "basic", header: "Basic", align: "right", cell: (r) => money(r.slip.basic) },
    { key: "otpay", header: "OT pay", align: "right", cell: (r) => money(r.slip.ot_pay) },
    { key: "gross", header: "Gross", align: "right", cell: (r) => <span className="font-medium">{money(r.slip.gross)}</span> },
    { key: "pf", header: "PF", align: "right", cell: (r) => money(r.slip.pf) },
    { key: "esi", header: "ESI", align: "right", cell: (r) => money(r.slip.esi) },
    { key: "pt", header: "PT", align: "right", cell: (r) => money(r.slip.pt) },
    { key: "adv", header: "Advance", align: "right", cell: (r) => money(r.slip.advance + r.slip.uniform) },
    { key: "net", header: "Net pay", align: "right", cell: (r) => <span className="font-semibold">{money(r.slip.net)}</span> },
    {
      key: "status", header: "Status",
      cell: (r) => r.hold
        ? <StatusPill tone="half-day" size="xs"><TriangleAlert className="size-3" /> {r.hold}</StatusPill>
        : <StatusPill tone={stage === "paid" ? "present" : "neutral"} size="xs">{stage === "paid" ? "Paid" : "Ready"}</StatusPill>,
    },
  ];

  return (
    <>
      <Section style={{ ["--i" as string]: 1 }} bodyClassName="p-0">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-2" aria-label="Payroll stages">
            {PAYROLL_STAGES.map((s, i) => {
              const done = i < stageIndex, current = i === stageIndex;
              return (
                <li key={s.key} className="flex items-center gap-2" aria-current={current ? "step" : undefined}>
                  {i > 0 && <span className={cn("h-px w-6", done || current ? "bg-primary" : "bg-border")} />}
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full border font-mono text-[11px]",
                      done && "border-primary bg-primary text-primary-foreground",
                      current && "border-primary text-primary ring-3 ring-primary/15",
                      !done && !current && "text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span className="leading-tight">
                    <span className={cn("block text-sm", current ? "font-semibold" : "text-muted-foreground")}>{s.label}</span>
                    <span className="hidden text-[11px] text-muted-foreground lg:block">{s.hint}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadBankFile}>
              <FileSpreadsheet data-icon="inline-start" /> Bank file
            </Button>
            {next && (
              <Button onClick={advance}>
                <next.icon data-icon="inline-start" /> {next.label}
              </Button>
            )}
          </div>
        </div>
      </Section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatTile label="Guards on payroll" value={t.guards} hint={t.held ? `${t.held} on hold` : "none on hold"} tone={t.held ? "half-day" : "neutral"} style={{ ["--i" as string]: 2 }} />
        <StatTile label="Gross" value={fmtINR(t.gross)} hint={`${fmtINR(t.ot_pay)} of it overtime`} style={{ ["--i" as string]: 3 }} />
        <StatTile label="Net to bank" value={fmtINR(t.net)} tone="olive" hint="held guards excluded" style={{ ["--i" as string]: 4 }} />
        <StatTile label="PF" value={fmtINR(t.pf)} hint={`${DEFAULT_PAY_POLICY.pf_rate * 100}% employee share`} style={{ ["--i" as string]: 5 }} />
        <StatTile label="ESI" value={fmtINR(t.esi)} hint={`${DEFAULT_PAY_POLICY.esi_rate * 100}% up to ${fmtINR(DEFAULT_PAY_POLICY.esi_gross_limit)} gross`} style={{ ["--i" as string]: 6 }} />
      </div>

      <Section
        title="Salary register"
        description="Click a guard for the payslip. Amounts in ₹."
        bodyClassName="p-0"
        actions={
          <Button size="sm" variant="ghost" onClick={() => toast("Salary register", { description: "XLSX export — preview only." })}>
            <Download data-icon="inline-start" /> Export
          </Button>
        }
        style={{ ["--i" as string]: 7 }}
      >
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.guard.id} ariaLabel="Salary register" />
      </Section>

      <Sheet open={open != null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {open && <Payslip row={open} month={month} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Payslip({ row, month }: { row: PayrollRow; month: string }) {
  const s = row.slip;
  const line = (k: string, v: number, sub?: string) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <span>{k}{sub && <span className="ml-1.5 text-xs text-muted-foreground">{sub}</span>}</span>
      <Mono>{fmtINR(v)}</Mono>
    </div>
  );
  return (
    <>
      <SheetHeader>
        <div className="eyebrow">Payslip · {month}</div>
        <SheetTitle className="font-display text-xl">{row.guard.full_name}</SheetTitle>
        <SheetDescription>
          {row.guard.employee_code ?? "No employee code"} · {row.guard.site_name ?? "No site"}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-6">
        <div className="grid grid-cols-4 gap-2 rounded-lg border p-3 text-center">
          {[["Present", s.days_present], ["Half", s.half_days], ["Leave", s.paid_leave], ["Paid", s.payable_days]].map(([k, v]) => (
            <div key={k}>
              <div className="font-display text-xl font-semibold tabular">{v}</div>
              <div className="eyebrow">{k}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="eyebrow mb-1">Earnings</div>
          <div className="divide-y">
            {line("Basic + DA", s.basic, `${fmtINR(s.monthly_wage)}/month`)}
            {line("Overtime", s.ot_pay, s.ot_minutes ? fmtMinutes(s.ot_minutes) : undefined)}
          </div>
          <div className="mt-1 flex justify-between border-t pt-2 text-sm font-semibold"><span>Gross</span><Mono>{fmtINR(s.gross)}</Mono></div>
        </div>
        <div>
          <div className="eyebrow mb-1">Deductions</div>
          <div className="divide-y">
            {line("Provident fund", s.pf, "12%")}
            {line("ESI", s.esi, s.esi ? "0.75%" : "not applicable")}
            {line("Professional tax", s.pt)}
            {line("Salary advance", s.advance)}
            {line("Uniform", s.uniform)}
          </div>
        </div>
        <div className="flex items-end justify-between rounded-lg bg-primary/8 p-4">
          <span className="eyebrow text-primary">Net pay</span>
          <span className="font-display text-3xl font-semibold tabular text-primary">{fmtINR(s.net)}</span>
        </div>
        {row.hold && (
          <p className="flex items-center gap-2 text-sm text-half-day-foreground dark:text-half-day">
            <TriangleAlert className="size-4" /> On hold: {row.hold}
          </p>
        )}
      </div>
    </>
  );
}
