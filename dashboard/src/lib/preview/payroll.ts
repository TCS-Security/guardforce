import { rng } from "./rng";
import { DEFAULT_OT_POLICY, type OtPolicy } from "./overtime";
import type { Crew, CrewGuard } from "./crew";

/** Statutory and house rules a payroll run applies. Rates are the central defaults. */
export type PayPolicy = {
  /** Paid days in a month the wage is divided by. */
  working_days: number;
  pf_rate: number;
  /** PF is charged on basic up to this ceiling. */
  pf_wage_ceiling: number;
  esi_rate: number;
  /** ESI applies only while gross is at or under this. */
  esi_gross_limit: number;
  /** Professional tax, flat, once gross reaches `pt_threshold`. */
  pt_amount: number;
  pt_threshold: number;
  ot: OtPolicy;
};

/**
 * Karnataka's security-guard minimum wage, as revised on 22 May 2026: the Bengaluru
 * (Zone 1) floor for an unskilled guard went from Rs 18,997 to Rs 25,714 a month, with
 * semi-skilled at Rs 28,285. Two consequences fall out of the arithmetic and are worth
 * saying out loud in a demo: every guard is now above the Rs 21,000 ESI ceiling, so ESI
 * stops applying, and every guard is above Rs 25,000, so professional tax starts.
 */
export const MIN_WAGE_2026 = {
  /** Zone 1 unskilled floor. No guard may be generated below this. */
  guard_floor: 25714,
  guard_bands: [25714, 26500, 27400, 28285],
  /** Ex-servicemen gunmen carry an arms licence and price at roughly 1.3x the floor. */
  gunman_bands: [33000, 33428, 34500],
  supervisor_bands: [30000, 32000, 34000],
} as const;

export const DEFAULT_PAY_POLICY: PayPolicy = {
  working_days: 26,
  pf_rate: 0.12,
  pf_wage_ceiling: 15000,
  esi_rate: 0.0075,
  esi_gross_limit: 21000,
  pt_amount: 200,
  pt_threshold: 25000,
  ot: DEFAULT_OT_POLICY,
};

export type PayInputs = {
  monthly_wage: number;
  days_present: number;
  half_days: number;
  paid_leave: number;
  ot_minutes: number;
  advance: number;
  uniform: number;
};

export type Payslip = PayInputs & {
  payable_days: number;
  basic: number;
  ot_pay: number;
  gross: number;
  pf: number;
  esi: number;
  pt: number;
  deductions: number;
  net: number;
};

/** One guard's pay for the month. Everything rounds to whole rupees. */
export function computePayslip(input: PayInputs, policy: PayPolicy = DEFAULT_PAY_POLICY): Payslip {
  const payable_days = Math.min(policy.working_days, input.days_present + input.half_days * 0.5 + input.paid_leave);
  const daily = input.monthly_wage / policy.working_days;
  const basic = Math.round(daily * payable_days);
  const ot_pay = Math.round((input.ot_minutes / 60) * (daily / 8) * policy.ot.multiplier);
  const gross = basic + ot_pay;
  const pf = Math.round(Math.min(basic, policy.pf_wage_ceiling) * policy.pf_rate);
  const esi = gross <= policy.esi_gross_limit ? Math.ceil(gross * policy.esi_rate) : 0;
  const pt = gross >= policy.pt_threshold ? policy.pt_amount : 0;
  const deductions = pf + esi + pt + input.advance + input.uniform;
  return { ...input, payable_days, basic, ot_pay, gross, pf, esi, pt, deductions, net: gross - deductions };
}

export type PayrollRow = { guard: CrewGuard; slip: Payslip; hold: string | null };

export type PayrollStage = "draft" | "review" | "approved" | "paid";

export const PAYROLL_STAGES: { key: PayrollStage; label: string; hint: string }[] = [
  { key: "draft", label: "Attendance locked", hint: "Muster frozen for the month" },
  { key: "review", label: "Review", hint: "Check holds and deductions" },
  { key: "approved", label: "Approved", hint: "Bank file and payslips ready" },
  { key: "paid", label: "Paid", hint: "Salaries credited" },
];

/** The month before `today`'s, as YYYY-MM: the month a run on `today` pays for. */
export function payMonth(today: string): string {
  const [y, m] = today.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

/** Sample register for `month`: attendance-shaped inputs per guard, computed with `policy`. */
export function generatePayroll(crew: Crew, month: string, policy: PayPolicy = DEFAULT_PAY_POLICY): PayrollRow[] {
  return crew.guards.map((guard) => {
    const r = rng(`pay:${guard.id}:${month}`);
    const supervisor = /supervisor/i.test(guard.full_name) || r.chance(0.1);
    const gunman = !supervisor && (/gunman/i.test(guard.full_name) || r.chance(0.08));
    const monthly_wage = supervisor
      ? r.pick([...MIN_WAGE_2026.supervisor_bands])
      : gunman
        ? r.pick([...MIN_WAGE_2026.gunman_bands])
        : r.pick([...MIN_WAGE_2026.guard_bands]);
    const absent = r.int(0, 4);
    const half_days = r.int(0, 3);
    const paid_leave = r.int(0, 2);
    const days_present = Math.max(0, policy.working_days - absent - half_days - paid_leave);
    const ot_minutes = r.chance(0.55) ? r.int(2, 36) * 30 : 0;
    const advance = r.chance(0.25) ? r.pick([1000, 2000, 2500, 3000, 5000]) : 0;
    const uniform = r.chance(0.12) ? 450 : 0;
    const slip = computePayslip({ monthly_wage, days_present, half_days, paid_leave, ot_minutes, advance, uniform }, policy);
    const hold = !guard.employee_code ? "No employee code" : r.chance(0.06) ? "Bank account not verified" : null;
    return { guard, slip, hold };
  });
}

export type PayrollTotals = { guards: number; gross: number; net: number; pf: number; esi: number; ot_pay: number; held: number };

/** Column totals for the register; held rows are counted but not paid. */
export function payrollTotals(rows: PayrollRow[]): PayrollTotals {
  const t: PayrollTotals = { guards: rows.length, gross: 0, net: 0, pf: 0, esi: 0, ot_pay: 0, held: 0 };
  for (const { slip, hold } of rows) {
    t.gross += slip.gross;
    t.pf += slip.pf;
    t.esi += slip.esi;
    t.ot_pay += slip.ot_pay;
    if (hold) t.held += 1;
    else t.net += slip.net;
  }
  return t;
}
