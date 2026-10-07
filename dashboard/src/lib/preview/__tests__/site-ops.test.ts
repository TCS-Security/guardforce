import { describe, expect, it } from "vitest";
import { ackProgress, generateHandovers, generatePostOrders, publishRevision } from "../site-ops";
import { crew } from "./fixtures";

describe("post orders", () => {
  it("gives every site the gate and visitor orders", () => {
    const orders = generatePostOrders(crew);
    for (const s of crew.sites) {
      const kinds = orders.filter((o) => o.site_id === s.id).map((o) => o.kind);
      expect(kinds).toEqual(expect.arrayContaining(["gate", "visitor"]));
    }
  });

  it("counts only acknowledgements of the current version", () => {
    const order = generatePostOrders(crew)[0]!;
    const p = ackProgress(order);
    expect(p.total).toBe(crew.guards.filter((g) => g.site_id === order.site_id).length);
    expect(p.read).toBe(order.acks.filter((a) => a.version === order.version).length);
  });

  it("drops everyone back to unread when a new version is published", () => {
    const order = generatePostOrders(crew)[0]!;
    const next = publishRevision(order, ["New step"], "Owner", "2026-10-08T05:00:00Z");
    expect(next.version).toBe(order.version + 1);
    expect(ackProgress(next).read).toBe(0);
  });
});

describe("handovers", () => {
  it("never hands over to the same guard and keeps newest first", () => {
    const list = generateHandovers(crew);
    expect(list.length).toBeGreaterThan(0);
    for (const h of list) expect(h.to?.id).not.toBe(h.from.id);
    expect(list.map((h) => h.at)).toEqual([...list.map((h) => h.at)].sort().reverse());
  });

  it("marks only today's handovers as possibly unread", () => {
    for (const h of generateHandovers(crew)) if (!h.read_at) expect(h.at >= "2026-10-07T18:30:00.000Z").toBe(true);
  });
});
