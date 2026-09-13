import { describe, expect, it } from "vitest";
import { fmtMinutes, fmtSeconds, fmtDistance, initials, fmtTime, toLocalDate, maskPhone, fmtPhone, fmtPct } from "../format";

describe("format", () => {
  it("formats durations", () => {
    expect(fmtMinutes(0)).toBe("0m");
    expect(fmtMinutes(40)).toBe("40m");
    expect(fmtMinutes(60)).toBe("1h");
    expect(fmtMinutes(435)).toBe("7h 15m");
    expect(fmtMinutes(null)).toBe("—");
    expect(fmtSeconds(1500)).toBe("25m");
  });
  it("formats distances", () => {
    expect(fmtDistance(42.4)).toBe("42 m");
    expect(fmtDistance(1540)).toBe("1.5 km");
  });
  it("formats times in IST", () => {
    expect(fmtTime("2026-09-13T00:30:00Z")).toBe("06:00");
    expect(toLocalDate(new Date("2026-09-13T20:30:00Z"))).toBe("2026-09-14");
  });
  it("initials and phone masks", () => {
    expect(initials("Ramesh Yadav")).toBe("RY");
    expect(initials("Shivakumar")).toBe("S");
    expect(maskPhone("9900000001")).toBe("••••••0001");
    expect(fmtPhone("9900000001")).toBe("99000 00001");
    expect(fmtPct(66.666, 1)).toBe("66.7%");
    expect(fmtPct(null)).toBe("—");
  });
});
