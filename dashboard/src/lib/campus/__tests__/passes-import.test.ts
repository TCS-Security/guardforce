import { describe, expect, it } from "vitest";
import { effectiveStatus, validatePass, validityLabel } from "../passes";
import { FLOOR_COLUMNS, parseImport, TENANT_COLUMNS } from "../bulk-import";
import { buildCampus } from "../sample";

describe("gate passes", () => {
  const now = new Date("2026-10-08T08:00:00Z");
  const iso = (h: number) => new Date(now.getTime() + h * 3_600_000).toISOString();

  it("reads an active pass past its window as expired", () => {
    expect(effectiveStatus({ status: "active", valid_to: iso(-1) }, now)).toBe("expired");
    expect(effectiveStatus({ status: "active", valid_to: iso(1) }, now)).toBe("active");
    expect(effectiveStatus({ status: "closed", valid_to: iso(-1) }, now)).toBe("closed");
  });

  it("says how long is left, or how long ago it ended", () => {
    expect(validityLabel({ valid_from: iso(-1), valid_to: iso(3.5) }, now)).toBe("3h 30m left");
    expect(validityLabel({ valid_from: iso(-5), valid_to: iso(-0.5) }, now)).toBe("Ended 30m ago");
    expect(validityLabel({ valid_from: iso(2), valid_to: iso(4) }, now)).toBe("Starts in 2h");
  });

  it("validates the window and the gates", () => {
    const e = validatePass({ type: "vip", title: "Board visit", holder: "V S", firm: "Self", phone: "9876543210", tenant_id: "t", gate_ids: [], valid_from: iso(2), valid_to: iso(1) });
    expect(e).toEqual({ gate_ids: "At least one gate.", valid_to: "Must end after it starts." });
  });
});

describe("bulk import", () => {
  it("parses a spreadsheet paste and reports bad rows by line", () => {
    const text = [
      "Company\tCode\tFloor code\tUnit\tContact person\tPhone\tEmail",
      "Acme Ltd\tacme-06\t2F-NWFN\tSuite 210\tRavi\t9876543210\travi@acme.in",
      "Bad Co\tX\t2F-NWFN\tSuite 211\tRavi\t12345\tnot-an-email",
      "",
      "Dupe\tKAVERI-01\t1F\tSuite 1\tA\t9876543211\t",
    ].join("\n");
    const r = parseImport(text, TENANT_COLUMNS, ["KAVERI-01"]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ code: "ACME-06", phone: "9876543210" });
    expect(r.errors.map((e) => e.line)).toEqual([3, 5]);
    expect(r.errors[0]!.message).toMatch(/Code “X”.*Phone “12345”.*Email/);
    expect(r.errors[1]!.message).toMatch(/already exists/);
  });

  it("accepts quoted CSV and reports a header missing required columns", () => {
    const ok = parseImport('Floor,Code,Tower code,Radius (m)\n"4th floor, east",4F-EAST,TWR-A,35', FLOOR_COLUMNS);
    expect(ok.rows[0]).toMatchObject({ name: "4th floor, east", code: "4F-EAST", radius: "35" });
    const bad = parseImport("Floor,Code\nx,y", FLOOR_COLUMNS);
    expect(bad.errors[0]!.message).toMatch(/Tower code/);
  });
});

describe("buildCampus", () => {
  const site = { id: "c0000000-0000-4000-8000-000000000001", name: "Prestige Tech Park — Gate 3", client_name: "Prestige Group", address: null, city: "Bengaluru", lat: 12.9354, lng: 77.6925 };
  const guards = Array.from({ length: 6 }, (_, i) => ({ id: `g${i}`, full_name: `Guard ${i}`, employee_code: null, phone: null }));
  const now = new Date("2026-10-08T07:00:00Z");

  it("is deterministic for a site and day", () => {
    const a = buildCampus(site, guards, [], now, "2026-10-08");
    const b = buildCampus(site, guards, [], now, "2026-10-08");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("links every visitor and pass to a real tenant and gate, and every guard to a deployment", () => {
    const c = buildCampus(site, guards, [], now, "2026-10-08");
    const tenants = new Set(c.tenants.map((t) => t.id));
    const gates = new Set(c.gates.map((g) => g.id));
    expect(c.visitors.every((v) => tenants.has(v.tenant_id) && gates.has(v.gate_id))).toBe(true);
    expect(c.passes.every((p) => tenants.has(p.tenant_id) && p.gate_ids.every((g) => gates.has(g)))).toBe(true);
    expect(c.deployments.map((d) => d.guard.id)).toEqual(guards.map((g) => g.id));
    expect(c.visitors.some((v) => v.status === "pending")).toBe(true);
  });

  it("copes with a scope that has no guards", () => {
    expect(() => buildCampus(site, [], [], now, "2026-10-08")).not.toThrow();
  });
});
