import { describe, expect, it } from "vitest";
import { assignmentProgress, dueState, rollupStatus } from "../tasks";

const now = new Date("2026-09-14T10:00:00Z");

describe("dueState (F7)", () => {
  it("is overdue once the due time has passed", () => {
    expect(dueState({ due_at: "2026-09-14T09:59:00Z", status: "pending" }, now)).toBe("overdue");
  });
  it("warns inside the soon window", () => {
    expect(dueState({ due_at: "2026-09-14T11:30:00Z", status: "pending" }, now)).toBe("due_soon");
    expect(dueState({ due_at: "2026-09-14T13:00:00Z", status: "pending" }, now)).toBe("upcoming");
  });
  it("never nags about a closed task", () => {
    expect(dueState({ due_at: "2026-09-13T10:00:00Z", status: "done" }, now)).toBe("closed");
    expect(dueState({ due_at: "2026-09-13T10:00:00Z", status: "missed" }, now)).toBe("closed");
  });
  it("handles a task with no due time", () => {
    expect(dueState({ due_at: null, status: "pending" }, now)).toBe("no_due");
  });
});

describe("assignmentProgress", () => {
  it("reports done, missed and percentage", () => {
    expect(assignmentProgress([{ status: "done" }, { status: "pending" }, { status: "missed" }, { status: "done" }])).toEqual({
      done: 2, missed: 1, total: 4, pct: 50,
    });
  });
  it("is empty-safe", () => {
    expect(assignmentProgress([])).toEqual({ done: 0, missed: 0, total: 0, pct: 0 });
  });
});

describe("rollupStatus", () => {
  it("is done only when everyone finished", () => {
    expect(rollupStatus([{ status: "done" }, { status: "done" }], "pending")).toBe("done");
    expect(rollupStatus([{ status: "done" }, { status: "pending" }], "pending")).toBe("in_progress");
  });
  it("is missed when nobody did it", () => {
    expect(rollupStatus([{ status: "missed" }, { status: "missed" }], "pending")).toBe("missed");
  });
  it("keeps the current status with no assignees", () => {
    expect(rollupStatus([], "pending")).toBe("pending");
  });
});
