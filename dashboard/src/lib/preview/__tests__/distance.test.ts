import { describe, expect, it } from "vitest";
import { dailyTotals, distanceDays, generateDistance } from "../distance";
import { crew } from "./fixtures";

describe("distance report", () => {
  it("covers the seven days before today, oldest first", () => {
    expect(distanceDays("2026-10-08")).toEqual(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07"]);
  });

  it("records nothing on a day off and sorts the longest walkers first", () => {
    const rows = generateDistance(crew);
    for (const r of rows) for (const d of r.days) if (!d.on_duty) expect(d.metres + d.outside_min).toBe(0);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1]!.total_m).toBeGreaterThanOrEqual(rows[i]!.total_m);
  });

  it("adds each day across guards", () => {
    const rows = generateDistance(crew);
    const totals = dailyTotals(rows);
    expect(totals.reduce((n, t) => n + t.metres, 0)).toBe(rows.reduce((n, r) => n + r.total_m, 0));
  });
});
