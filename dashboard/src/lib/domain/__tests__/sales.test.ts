import { describe, expect, it } from "vitest";
import {
  LOOKUP_MONTHLY_CAP, assessLead, estimateGuards, fmtRupeesShort, guardsFromSize, lookupGate, nearReason, nearestSite,
  pitchLines, sortNumbers, stageAfterCall, telHref, whatsappHref,
} from "../sales";

const TODAY = new Date("2026-10-08T06:00:00Z");

describe("guards from size", () => {
  it("turns flats, beds and tender figures into a rough guard count", () => {
    expect(guardsFromSize({ segment: "apartment", size_value: 640, size_unit: "flats" })).toBe(14);
    expect(guardsFromSize({ segment: "hospital", size_value: 240, size_unit: "beds" })).toBe(20);
    expect(guardsFromSize({ segment: "govt", tender_guards: 22 })).toBe(22);
    expect(guardsFromSize({ segment: "govt", tender_value_inr: 3_600_000 })).toBe(10);
  });

  it("falls back to the segment's typical figure when nothing is known, and says so", () => {
    expect(estimateGuards({ segment: "factory" })).toEqual({ guards: 12, estimated: true, known: false });
  });
});

describe("Hot / Warm / Cold", () => {
  it("is Hot for a big apartment handed over recently", () => {
    const a = assessLead({ segment: "apartment", size_value: 640, size_unit: "flats", completion_on: "2026-06-15", source: "rera" }, TODAY);
    expect(a.label).toBe("hot");
    expect(a.reasons[0]!.kind).toBe("handover");
    expect(a.reasons[0]!.source).toBe("RERA");
    expect(a.reasons.find((r) => r.kind === "size")!.text).toContain("about 14 guards");
  });

  it("is Hot for a big site whose agency has no app", () => {
    const a = assessLead({ segment: "hospital", size_value: 300, size_unit: "beds", incumbent_agency: "Shield Force", incumbent_software: "none" }, TODAY);
    expect(a.label).toBe("hot");
    expect(a.reasons.some((r) => r.text.includes("No app seen"))).toBe(true);
  });

  it("is Cold when the incumbent runs strong software and nothing forces a switch", () => {
    const a = assessLead({ segment: "it_park", size_value: 60, size_unit: "guards", incumbent_agency: "SIS", incumbent_software: "national" }, TODAY);
    expect(a.label).toBe("cold");
  });

  it("lets a timing trigger beat strong software", () => {
    const a = assessLead({ segment: "govt", tender_guards: 20, tender_closes_on: "2026-10-20", incumbent_agency: "G4S", incumbent_software: "national" }, TODAY);
    expect(a.label).toBe("hot");
  });

  it("is Cold for a small site", () => {
    expect(assessLead({ segment: "office", size_value: 2, size_unit: "guards" }, TODAY).label).toBe("cold");
  });

  it("keeps an unknown, mid-size lead Warm rather than Cold", () => {
    const a = assessLead({ segment: "factory" }, TODAY);
    expect(a.label).toBe("warm");
    expect(a.reasons).toHaveLength(0);
  });

  it("does not count a handover from years ago", () => {
    const a = assessLead({ segment: "apartment", size_value: 400, size_unit: "flats", completion_on: "2021-01-01" }, TODAY);
    expect(a.timing).toBe(false);
    expect(a.label).toBe("warm");
  });

  it("treats a jeweller with a weak agency as Hot despite few guards", () => {
    expect(assessLead({ segment: "jeweller", incumbent_agency: "X", incumbent_software: "none" }, TODAY).label).toBe("hot");
  });
});

describe("near your sites", () => {
  const sites = [
    { id: "a", name: "Brigade Metropolis", lat: 12.99098, lng: 77.70254 },
    { id: "b", name: "UB Tower", lat: 12.97186, lng: 77.59567 },
  ];
  it("names the closest site within 3 km", () => {
    const near = nearestSite({ lat: 12.9985, lng: 77.7155 }, sites);
    expect(near!.site.id).toBe("a");
    expect(nearReason(near)!.text).toMatch(/km from your site at Brigade Metropolis/);
  });
  it("says nothing when the nearest site is far, or the lead has no location", () => {
    expect(nearReason(nearestSite({ lat: 13.2, lng: 77.3 }, sites))).toBeNull();
    expect(nearestSite({ lat: null, lng: null }, sites)).toBeNull();
  });
});

describe("paid lookup gate", () => {
  const top = { label: "hot" as const, guards: 20, guardsKnown: true, incumbentSoftware: "none" as const, timing: false, hasMobile: false, usedThisMonth: 3 };
  it("shows and allows on a top lead with no mobile", () => {
    expect(lookupGate(top)).toMatchObject({ show: true, allowed: true });
  });
  it("hides on anything less than a top lead", () => {
    expect(lookupGate({ ...top, label: "warm" }).show).toBe(false);
    expect(lookupGate({ ...top, guards: 8 }).show).toBe(false);
    expect(lookupGate({ ...top, guardsKnown: false }).show).toBe(false);
    expect(lookupGate({ ...top, incumbentSoftware: "strong" }).show).toBe(false);
    expect(lookupGate({ ...top, hasMobile: true }).show).toBe(false);
  });
  it("stops at the monthly cap", () => {
    expect(lookupGate({ ...top, usedThisMonth: LOOKUP_MONTHLY_CAP })).toMatchObject({ show: true, allowed: false });
  });
});

describe("numbers and calls", () => {
  it("puts working mobiles first and wrong numbers last", () => {
    const sorted = sortNumbers([
      { id: 1, kind: "office" as const, status: "unknown" as const },
      { id: 2, kind: "mobile" as const, status: "wrong" as const },
      { id: 3, kind: "mobile" as const, status: "worked" as const },
      { id: 4, kind: "email" as const, status: "unknown" as const },
    ]);
    expect(sorted.map((n) => n.id)).toEqual([3, 1, 4, 2]);
  });
  it("builds tap-to-call and WhatsApp links for Indian numbers", () => {
    expect(telHref("098450 12345")).toBe("tel:+919845012345");
    expect(telHref("080 4123 4567")).toBe("tel:+918041234567");
    expect(whatsappHref("98450 12345")).toBe("https://wa.me/919845012345");
    expect(whatsappHref("12345")).toBeNull();
  });
  it("moves only New leads to Called after a call", () => {
    expect(stageAfterCall("new")).toBe("called");
    expect(stageAfterCall("proposal")).toBe("proposal");
  });
});

describe("words", () => {
  it("formats money the Indian way", () => {
    expect(fmtRupeesShort(420_000)).toBe("₹4.2 lakh");
    expect(fmtRupeesShort(30_000)).toBe("₹30k");
  });
  it("suggests an opening line from the top reasons", () => {
    const lines = pitchLines([{ kind: "handover", text: "", source: "RERA" }], "apartment");
    expect(lines[0]).toMatch(/residents run security/);
    expect(lines).toHaveLength(2);
  });
});
