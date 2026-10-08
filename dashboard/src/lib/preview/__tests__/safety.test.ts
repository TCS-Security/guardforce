import { describe, expect, it } from "vitest";
import { DEFAULT_ALERTNESS_POLICY, checkStatus, generateAlertness, median, nightlySummary, repeatOffenders } from "../alertness";
import { ackSeconds, generateSos } from "../sos";
import { crew } from "./fixtures";

describe("alertness checks", () => {
  it("grades a response against the window and the escalation limit", () => {
    expect(checkStatus(60)).toBe("on_time");
    expect(checkStatus(300)).toBe("on_time");
    expect(checkStatus(301)).toBe("late");
    expect(checkStatus(601)).toBe("missed");
    expect(checkStatus(null)).toBe("missed");
  });

  it("escalates every missed check and only missed checks", () => {
    for (const c of generateAlertness(crew)) {
      expect(c.escalated_to != null).toBe(c.status === "missed");
      expect(c.responded_at == null).toBe(c.response_s == null);
    }
  });

  it("summarises nights oldest first with every check counted once", () => {
    const checks = generateAlertness(crew);
    const nights = nightlySummary(checks);
    expect(nights.map((n) => n.night)).toEqual([...nights.map((n) => n.night)].sort());
    expect(nights.reduce((n, s) => n + s.on_time + s.late + s.missed, 0)).toBe(checks.length);
  });

  it("ranks the worst sleepers first", () => {
    const worst = repeatOffenders(generateAlertness(crew));
    for (let i = 1; i < worst.length; i++) expect(worst[i - 1]!.missed).toBeGreaterThanOrEqual(worst[i]!.missed);
  });

  it("takes a median", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(3);
  });

  it("gives the guard a reminder before anyone is called", () => {
    const p = DEFAULT_ALERTNESS_POLICY;
    // The nudge must land before the escalation, or it can never fire.
    expect(p.remind_after_s).toBeLessThan(p.escalate_after_s);
    // A guard who was simply away from the phone for a few minutes is not "missed".
    expect(checkStatus(3 * 60)).toBe("on_time");
    expect(checkStatus(6 * 60)).toBe("late");
    expect(checkStatus(11 * 60)).toBe("missed");
    expect(checkStatus(null)).toBe("missed");
  });
});

describe("sos", () => {
  const now = new Date("2026-10-08T10:00:00Z");

  it("always has one live, unacknowledged alert to show", () => {
    const { alerts } = generateSos(crew, now);
    expect(alerts.filter((a) => a.status === "active")).toHaveLength(1);
    expect(ackSeconds(alerts[0]!)).toBeNull();
    expect(alerts.filter((a) => a.status === "resolved").every((a) => (ackSeconds(a) ?? 0) > 0)).toBe(true);
  });
});
