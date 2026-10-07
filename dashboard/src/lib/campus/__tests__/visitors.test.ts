import { describe, expect, it } from "vitest";
import { approve, checkIn, checkOut, decodeApprovalCard, deny, encodeApprovalCard, maskId, nextRef, stayMinutes, validateVisitor, visitorStats, watchlist } from "../visitors";
import type { Visitor } from "../types";

const at = new Date("2026-10-08T06:00:00Z");
const base: Visitor = {
  id: "v1", ref: "VIS-1001", name: "Karan Mehta", phone: "9876543210", company: "Zephyr", type: "vendor", id_type: "aadhaar", id_last4: "1234",
  vehicle: null, tenant_id: "t1", purpose: "Meeting", gate_id: "g1", status: "pending", pre_authorised: false, arrived_at: at.toISOString(),
  approved_at: null, approved_by: null, approval_via: null, checked_in_at: null, checked_in_by: null, badge_no: null, checked_out_at: null,
  checked_out_by: null, exit_gate_id: null, exit_remarks: null, baggage: null, photo_hue: 0,
};

function ok(r: ReturnType<typeof approve>) {
  if (!r.ok) throw new Error(r.error);
  return r.visitor;
}

describe("visitor lifecycle", () => {
  it("walks pending → approved → on premises → checked out", () => {
    const a = ok(approve(base, "Anjali", "whatsapp", at));
    expect(a).toMatchObject({ status: "approved", approved_by: "Anjali", approval_via: "whatsapp" });
    const i = ok(checkIn(a, "Ramesh", " b-12 ", at));
    expect(i).toMatchObject({ status: "checked_in", badge_no: "B-12", checked_in_by: "Ramesh" });
    const o = ok(checkOut(i, "Suresh", "g2", "Badge returned", new Date(at.getTime() + 75 * 60_000)));
    expect(o).toMatchObject({ status: "checked_out", exit_gate_id: "g2", exit_remarks: "Badge returned" });
    expect(stayMinutes(o, new Date())).toBe(75);
  });

  it("blocks a denied visitor at check-in", () => {
    const d = ok(deny(base, "Anjali", "link", at));
    const r = checkIn(d, "Ramesh", "B-1", at);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/denied/);
  });

  it("will not check in before the host answers, or without a badge", () => {
    expect(checkIn(base, "Ramesh", "B-1", at).ok).toBe(false);
    expect(checkIn(ok(approve(base, "A", "desk", at)), "Ramesh", "  ", at).ok).toBe(false);
  });

  it("lets a pre-authorised (expected) visitor straight in", () => {
    expect(checkIn({ ...base, status: "expected", pre_authorised: true }, "Ramesh", "B-2", at).ok).toBe(true);
  });

  it("refuses to approve twice or check out someone not inside", () => {
    expect(approve(ok(approve(base, "A", "desk", at)), "A", "desk", at).ok).toBe(false);
    expect(checkOut(base, "S", "g1", "", at).ok).toBe(false);
  });
});

describe("watchlist", () => {
  it("flags overstays past the limit and today's denials, longest stay first", () => {
    const now = new Date(at.getTime() + 200 * 60_000);
    const inside = (id: string, mins: number): Visitor => ({ ...base, id, status: "checked_in", checked_in_at: new Date(now.getTime() - mins * 60_000).toISOString() });
    const flags = watchlist([inside("a", 130), inside("b", 45), inside("c", 190), { ...base, id: "d", status: "rejected" }], now);
    expect(flags.map((f) => [f.visitor.id, f.reason])).toEqual([["c", "overstay"], ["a", "overstay"], ["d", "denied"]]);
  });
});

describe("visitorStats", () => {
  it("counts approval rate only over host decisions, not pre-authorisations", () => {
    const now = at;
    const s = visitorStats([
      { ...base, id: "1", status: "approved", approved_at: at.toISOString() },
      { ...base, id: "2", status: "rejected", approved_at: at.toISOString() },
      { ...base, id: "3", status: "expected", pre_authorised: true, approved_at: at.toISOString() },
      { ...base, id: "4", status: "pending" },
    ], now);
    expect(s.approvalRate).toBe(50);
    expect(s.pending).toBe(1);
    expect(s.expected).toBe(1);
  });
});

describe("helpers", () => {
  it("numbers the next ref after the highest in use", () => {
    expect(nextRef("VIS", ["VIS-4630", "VIS-4631", "VIS-4620"])).toBe("VIS-4632");
    expect(nextRef("GP", [])).toBe("GP-1001");
  });

  it("never shows an Aadhaar number whole", () => {
    expect(maskId("aadhaar", "1100")).toBe("XXXX-XXXX-1100");
    expect(maskId("dl", "9921")).toBe("••••9921");
  });

  it("validates the gate entry form field by field", () => {
    const e = validateVisitor({ name: "K", phone: "12345", company: "", type: "", id_type: "aadhaar", id_number: "1234", tenant_id: "", purpose: "" });
    expect(Object.keys(e).sort()).toEqual(["company", "id_number", "name", "phone", "purpose", "tenant_id", "type"]);
    expect(validateVisitor({ name: "Karan Mehta", phone: "+91 98765 43210", company: "Self", type: "guest", id_type: "aadhaar", id_number: "4234 2342 3412", tenant_id: "t1", purpose: "Lunch" })).toEqual({});
  });
});

describe("approval card", () => {
  it("round-trips a desk walk-in, including non-Latin names", () => {
    const v = { ...base, name: "प्रिया शर्मा", ref: "VIS-4632" };
    expect(decodeApprovalCard(encodeApprovalCard(v))).toMatchObject({ ref: "VIS-4632", name: "प्रिया शर्मा", tenant_id: "t1", type: "vendor" });
  });

  it("rejects anything tampered or malformed", () => {
    expect(decodeApprovalCard("not-base64!!")).toBeNull();
    expect(decodeApprovalCard(btoa(JSON.stringify(["VIS-1", "x"])))).toBeNull();
    const bad = encodeApprovalCard({ ...base, type: "hacker" as never });
    expect(decodeApprovalCard(bad)).toBeNull();
  });
});
