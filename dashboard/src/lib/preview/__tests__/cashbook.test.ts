import { describe, expect, it } from "vitest";
import { generateCashbook, ledger, signed, spendByCategory, type CashEntry } from "../cashbook";
import { crew } from "./fixtures";

const e = (id: string, date: string, category: CashEntry["category"], amount: number): CashEntry =>
  ({ id, date, category, amount, note: "", party: "", site_name: null, mode: "cash", recorded_by: "" });

describe("cashbook", () => {
  it("signs money in as positive and money out as negative", () => {
    expect(signed(e("a", "2026-10-01", "client_payment", 500))).toBe(500);
    expect(signed(e("a", "2026-10-01", "fuel", 500))).toBe(-500);
  });

  it("runs the balance oldest first and shows newest first", () => {
    const rows = ledger([e("b", "2026-10-02", "fuel", 200), e("a", "2026-10-01", "client_payment", 1000)], 100);
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
    expect(rows.map((r) => r.balance)).toEqual([900, 1100]);
  });

  it("totals spend by category, ignoring money in", () => {
    const totals = spendByCategory([e("a", "x", "fuel", 100), e("b", "x", "fuel", 50), e("c", "x", "uniform", 400), e("d", "x", "client_payment", 9999)]);
    expect(totals).toEqual([{ category: "uniform", total: 400 }, { category: "fuel", total: 150 }]);
  });

  it("generates the same month every time", () => {
    expect(generateCashbook(crew, "Owner")).toEqual(generateCashbook(crew, "Owner"));
  });
});
