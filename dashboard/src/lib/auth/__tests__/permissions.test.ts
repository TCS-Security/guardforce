import { describe, expect, it } from "vitest";
import { PERMISSION_KEYS, PERMISSION_RESOURCES, ROUTE_PERMISSION, describePermissions, isPermissionKey, withImpliedReads, withoutResource } from "../permissions";

describe("permission catalogue", () => {
  it("lists every key exactly once in the editor rows", () => {
    const fromRows = PERMISSION_RESOURCES.flatMap((r) => [r.read, ...r.actions.map((a) => a.key)]);
    expect([...fromRows].sort()).toEqual([...PERMISSION_KEYS].sort());
    expect(new Set(fromRows).size).toBe(fromRows.length);
  });

  it("maps every nav route to a read key that exists", () => {
    for (const key of Object.values(ROUTE_PERMISSION)) expect(isPermissionKey(key)).toBe(true);
    for (const key of Object.values(ROUTE_PERMISSION)) expect(key.endsWith(":read")).toBe(true);
  });
});

describe("withImpliedReads", () => {
  it("adds the read permission for any action", () => {
    expect(withImpliedReads(["sites:write"])).toEqual(["sites:read", "sites:write"]);
    expect(withImpliedReads(["guards:kyc", "guards:share"])).toEqual(["guards:read", "guards:kyc", "guards:share"]);
  });
  it("drops unknown keys and de-duplicates", () => {
    expect(withImpliedReads(["nope:x", "live:read", "live:read"])).toEqual(["live:read"]);
  });
  it("keeps catalogue order", () => {
    expect(withImpliedReads(["audit:read", "sites:read"])).toEqual(["sites:read", "audit:read"]);
  });
});

describe("withoutResource", () => {
  it("removes the read key and every action of that resource", () => {
    expect(withoutResource(["guards:read", "guards:kyc", "sites:read"], "guards:read")).toEqual(["sites:read"]);
  });
});

describe("describePermissions", () => {
  it("names the common shapes", () => {
    expect(describePermissions(PERMISSION_KEYS)).toBe("Everything");
    expect(describePermissions(PERMISSION_KEYS.filter((k) => k.endsWith(":read")))).toBe("Read-only, everything");
    // Counts come from the catalogue, so adding an area does not break this test.
    expect(describePermissions(["sites:read", "guards:read"])).toBe(`Read-only, 2 of ${PERMISSION_RESOURCES.length} areas`);
    expect(describePermissions(["sites:read", "sites:write"])).toBe(`2 of ${PERMISSION_KEYS.length}`);
  });
});
