import { describe, expect, it } from "vitest";
import { absenteeList, alertText, buildBotAlerts, classify, fmtWaPhone, type GuardWatch } from "../bot";

const now = new Date("2026-10-08T09:30:00Z");
const ago = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();
const watch = (over: Partial<GuardWatch>): GuardWatch => ({ guard_id: "g", name: "Ramesh Kumar", phone: "919900000001", site: "Prestige", shift: "Day", on_shift: true, last_seen_at: ago(1), in_fence: true, ...over });

describe("classify", () => {
  it("leaves a guard on post alone", () => {
    expect(classify(watch({}), now).state).toBe("ok");
    expect(classify(watch({ on_shift: false, last_seen_at: null }), now).state).toBe("ok");
  });

  it("calls a guard missing when the phone has been quiet too long, or they are far outside", () => {
    expect(classify(watch({ last_seen_at: ago(42) }), now)).toMatchObject({ state: "missing", minutes: 42 });
    expect(classify(watch({ last_seen_at: null }), now).reason).toBe("never seen this shift");
    expect(classify(watch({ in_fence: false, outside_m: 160 }), now)).toMatchObject({ state: "missing", reason: "160 m outside the fence" });
    expect(classify(watch({ in_fence: false, outside_m: 60 }), now).state).toBe("ok");
  });

  it("flags a break longer than allowed, but missing outranks it", () => {
    expect(classify(watch({ break_started_at: ago(48) }), now)).toMatchObject({ state: "long_break", minutes: 48 });
    expect(classify(watch({ break_started_at: ago(20) }), now).state).toBe("ok");
    expect(classify(watch({ break_started_at: ago(48), last_seen_at: ago(40) }), now).state).toBe("missing");
  });
});

describe("absent roll-call", () => {
  it("numbers the guards on one line with tappable numbers, since WhatsApp forbids newlines in a value", () => {
    const s = absenteeList([{ name: "Ramesh Kumar", phone: "919900000001" }, { name: "Mohan Das", phone: null }]);
    expect(s).toBe("1) Ramesh Kumar · +91 99000 00001 | 2) Mohan Das · no phone on file");
    expect(s).not.toMatch(/\n/);
    expect(fmtWaPhone("+91 98450-23456")).toBe("+91 98450 23456");
  });
});

describe("buildBotAlerts", () => {
  const sup = [{ name: "Priya Nair", phone: "919845023456", sites: ["Prestige"] }, { name: "Arun Kumar", phone: null, sites: ["Metro"] }];

  it("routes each alert to the supervisor scoped to that site", () => {
    const a = buildBotAlerts({
      now, supervisors: sup, watches: [],
      absences: [{ site: "Metro", shift: "Night", date: "2026-10-07", guards: [{ name: "Gopal", phone: "919900000012" }] }],
      incidents: [],
    });
    const roll = a.find((x) => x.kind === "absent_rollcall")!;
    expect(roll.recipients[0]!.name).toBe("Arun Kumar");
    expect(roll.source).toBe("live");
    expect(alertText(roll)).toContain("Gopal · +91 99000 00012");
  });

  it("follows a serious incident with a photo report, not a minor one", () => {
    const base = { title: "t", description: "d", site: "Prestige", occurred_at: ago(30), reporter: "Ramesh", reporter_phone: null };
    const a = buildBotAlerts({ now, supervisors: sup, absences: [], watches: [], incidents: [{ ...base, id: "1", type: "theft", severity: "high" }, { ...base, id: "2", type: "trespass", severity: "low" }] });
    expect(a.filter((x) => x.kind === "incident")).toHaveLength(2);
    const reports = a.filter((x) => x.kind === "incident_report");
    expect(reports.map((r) => r.id)).toEqual(["rp-1"]);
    expect(reports[0]!.image).toMatch(/^data:image\/svg\+xml/);
  });

  it("fills every kind with a sample when live data has none, and marks it so", () => {
    const a = buildBotAlerts({ now, supervisors: sup, absences: [], incidents: [], watches: [] });
    expect(new Set(a.map((x) => x.kind))).toEqual(new Set(["absent_rollcall", "incident", "incident_report", "missing", "long_break"]));
    expect(a.every((x) => x.source === "sample")).toBe(true);
  });

  it("keeps a live missing guard and only samples the long break", () => {
    const a = buildBotAlerts({ now, supervisors: sup, absences: [], incidents: [], watches: [watch({ guard_id: "live", last_seen_at: ago(50) })] });
    const missing = a.filter((x) => x.kind === "missing");
    expect(missing.map((m) => m.source)).toEqual(["live"]);
    expect(a.find((x) => x.kind === "long_break")!.source).toBe("sample");
  });
});
