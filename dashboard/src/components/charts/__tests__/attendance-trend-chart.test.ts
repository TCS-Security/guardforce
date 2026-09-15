import { describe, expect, it } from "vitest";
import { trendHref } from "../attendance-trend-chart";

/**
 * The link a bar leads to. These `?status=` values have to match what the attendance
 * day view filters on, otherwise a drill-down lands on an empty list.
 */
describe("trendHref", () => {
  it("opens the day view for the bar's own date", () => {
    expect(trendHref("2026-09-04")).toBe("/attendance?date=2026-09-04");
  });

  it("filters to the segment that was clicked", () => {
    expect(trendHref("2026-09-04", "absent")).toBe("/attendance?date=2026-09-04&status=absent");
    expect(trendHref("2026-09-04", "present")).toBe("/attendance?date=2026-09-04&status=present");
    expect(trendHref("2026-09-04", "half_day")).toBe("/attendance?date=2026-09-04&status=half_day");
    expect(trendHref("2026-09-04", "on_leave")).toBe("/attendance?date=2026-09-04&status=on_leave");
  });

  it("carries the site filter through, so a report drill-down stays scoped", () => {
    expect(trendHref("2026-09-04", "absent", "site-1")).toBe("/attendance?date=2026-09-04&status=absent&site=site-1");
    // No site on the overview, and null must not become the string "null".
    expect(trendHref("2026-09-04", "absent", null)).not.toContain("site=");
  });
});
