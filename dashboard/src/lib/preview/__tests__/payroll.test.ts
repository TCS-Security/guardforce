import { describe, expect, it } from "vitest";
import { computePayslip, generatePayroll, payMonth, payrollTotals, DEFAULT_PAY_POLICY } from "../payroll";
import { overtimeMinutes, overtimePay, generateOvertime, weeklyOvertime } from "../overtime";
import { fmtINR } from "../crew";
import { crew } from "./fixtures";

const base = { monthly_wage: 18200, days_present: 26, half_days: 0, paid_leave: 0, ot_minutes: 0, advance: 0, uniform: 0 };

describe("computePayslip", () => {
  it("pays the full wage for a full month", () => {
    const s = computePayslip(base);
    expect(s.payable_days).toBe(26);
    expect(s.basic).toBe(18200);
    expect(s.gross).toBe(18200);
  });

  it("counts a half day as half and caps payable days at the month", () => {
    expect(computePayslip({ ...base, days_present: 20, half_days: 2 }).payable_days).toBe(21);
    expect(computePayslip({ ...base, days_present: 26, paid_leave: 3 }).payable_days).toBe(26);
  });

  it("charges PF on basic up to the ceiling only", () => {
    expect(computePayslip(base).pf).toBe(Math.round(15000 * 0.12));
    expect(computePayslip({ ...base, monthly_wage: 13000 }).pf).toBe(Math.round(13000 * 0.12));
  });

  it("drops ESI once gross crosses the limit", () => {
    expect(computePayslip(base).esi).toBe(Math.ceil(18200 * 0.0075));
    expect(computePayslip({ ...base, monthly_wage: 24000 }).esi).toBe(0);
  });

  it("pays overtime at twice the hourly rate of an 8-hour day", () => {
    const s = computePayslip({ ...base, monthly_wage: 20800, ot_minutes: 120 });
    expect(s.ot_pay).toBe(400); // 20800/26 = 800/day, 100/h, ×2 × 2h
    expect(overtimePay(120, 20800)).toBe(400);
  });

  it("nets out advances and uniform deductions", () => {
    const s = computePayslip({ ...base, advance: 2000, uniform: 450 });
    expect(s.net).toBe(s.gross - s.pf - s.esi - s.pt - 2450);
  });

  it("applies professional tax from the threshold", () => {
    expect(computePayslip(base).pt).toBe(0);
    expect(computePayslip({ ...base, monthly_wage: 26000 }).pt).toBe(DEFAULT_PAY_POLICY.pt_amount);
  });
});

describe("payroll register", () => {
  it("pays for the previous month", () => {
    expect(payMonth("2026-10-08")).toBe("2026-09");
    expect(payMonth("2026-01-04")).toBe("2025-12");
  });

  it("is deterministic and holds guards without an employee code", () => {
    const a = generatePayroll(crew, "2026-09");
    expect(generatePayroll(crew, "2026-09")).toEqual(a);
    expect(a.find((r) => r.guard.id === "g0")?.hold).toBe("No employee code");
  });

  it("leaves held guards out of the net total", () => {
    const rows = generatePayroll(crew, "2026-09");
    const t = payrollTotals(rows);
    const paid = rows.filter((r) => !r.hold).reduce((n, r) => n + r.slip.net, 0);
    expect(t.net).toBe(paid);
    expect(t.held).toBe(rows.filter((r) => r.hold).length);
  });
});

describe("overtime", () => {
  it("ignores minutes inside the grace window", () => {
    expect(overtimeMinutes("2026-10-08T14:30:00Z", "2026-10-08T14:40:00Z")).toBe(0);
    expect(overtimeMinutes("2026-10-08T14:30:00Z", "2026-10-08T15:30:00Z")).toBe(60);
  });

  it("keeps the last three days pending and flags entries with no reason", () => {
    const entries = generateOvertime(crew);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      if (e.date >= "2026-10-06") expect(e.status).toBe("pending");
      if (!e.reason) expect(e.flag).toBe("no_reason");
    }
  });

  it("sums the last seven days and skips declined entries", () => {
    const entries = generateOvertime(crew);
    const weekly = weeklyOvertime(entries, crew.today);
    for (const [id, mins] of weekly) {
      const expected = entries
        .filter((e) => e.guard.id === id && e.status !== "declined" && e.date >= "2026-10-02")
        .reduce((n, e) => n + e.minutes, 0);
      expect(mins).toBe(expected);
    }
  });
});

describe("fmtINR", () => {
  it("groups digits the Indian way", () => {
    expect(fmtINR(1234567)).toBe("₹12,34,567");
    expect(fmtINR(-450)).toBe("−₹450");
  });
});
