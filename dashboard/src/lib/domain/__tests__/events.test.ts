import { describe, expect, it } from "vitest";
import { parseEventFilters, typesInGroup } from "@/lib/data/events";

describe("parseEventFilters", () => {
  const today = "2026-09-14";

  it("defaults to today and no filters", () => {
    expect(parseEventFilters({}, today)).toEqual({
      siteId: null, guardId: null, group: null, type: null, severity: null,
      from: today, to: today, ack: "all", page: 1,
    });
  });

  it("reads filters from the query string", () => {
    const f = parseEventFilters({ site: "s1", guard: "g1", group: "patrol", severity: "warn", from: "2026-09-01", to: "2026-09-10", ack: "open", page: "3" }, today);
    expect(f).toMatchObject({ siteId: "s1", guardId: "g1", group: "patrol", severity: "warn", from: "2026-09-01", to: "2026-09-10", ack: "open", page: 3 });
  });

  it("ignores empty values, an unknown ack and a bad page", () => {
    const f = parseEventFilters({ site: "", ack: "nonsense", page: "abc" }, today);
    expect(f.siteId).toBeNull();
    expect(f.ack).toBe("all");
    expect(f.page).toBe(1);
  });

  it("never returns a page below 1", () => {
    expect(parseEventFilters({ page: "-4" }, today).page).toBe(1);
  });
});

describe("typesInGroup", () => {
  it("collects the event types of a group", () => {
    expect(typesInGroup("patrol").sort()).toEqual(["PATROL_COMPLETED", "PATROL_LATE", "PATROL_MISSED", "PATROL_STARTED"]);
    expect(typesInGroup("leave").sort()).toEqual(["LEAVE_DECIDED", "LEAVE_REQUESTED"]);
  });
  it("is empty for an unknown group", () => {
    expect(typesInGroup("nope")).toEqual([]);
  });
});
