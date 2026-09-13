import { describe, expect, it } from "vitest";
import { presenceState, staffingGap } from "../status";

describe("presenceState (LOC-2)", () => {
  const now = new Date("2026-09-13T10:00:00Z");
  it("is off_duty without a shift", () => {
    expect(presenceState({ shift_id: null, last_seen_at: null, location_enabled: true }, 15, now)).toBe("off_duty");
  });
  it("is location_off when the guard disabled location", () => {
    expect(presenceState({ shift_id: "s", last_seen_at: "2026-09-13T09:59:00Z", location_enabled: false }, 15, now)).toBe("location_off");
  });
  it("is stale after the staleness window", () => {
    expect(presenceState({ shift_id: "s", last_seen_at: "2026-09-13T09:44:00Z", location_enabled: true }, 15, now)).toBe("stale");
    expect(presenceState({ shift_id: "s", last_seen_at: "2026-09-13T09:46:00Z", location_enabled: true }, 15, now)).toBe("live");
  });
});

describe("staffingGap", () => {
  it("never goes negative", () => {
    expect(staffingGap(4, 2)).toBe(2);
    expect(staffingGap(2, 5)).toBe(0);
  });
});
