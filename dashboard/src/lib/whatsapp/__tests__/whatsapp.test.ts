import { describe, expect, it } from "vitest";
import { render, TEMPLATES, validateTemplate, variablesIn } from "../templates";
import { estimateCost, inQuietHours, playLadder, RULES, type Rung } from "../rules";
import { buildWhatsapp, deliveryStats, sessionOpen, threadFor } from "../messages";

describe("templates", () => {
  it("finds and fills positional variables", () => {
    expect(variablesIn("Hi {{1}}, {{2}} at {{1}}")).toEqual([1, 2]);
    expect(render("Hi {{1}}, shift at {{2}}", ["Ramesh"])).toBe("Hi Ramesh, shift at {{2}}");
  });

  it("catches what Meta's review would reject", () => {
    const errs = validateTemplate({ name: "Shift Reminder", body: "{{1}} your shift {{3}}", header: null, footer: null, buttons: [], samples: ["a"] });
    expect(errs.join(" ")).toMatch(/lowercase/);
    expect(errs.join(" ")).toMatch(/no gaps/);
    expect(errs.join(" ")).toMatch(/start or end with a variable/);
    expect(errs.join(" ")).toMatch(/example value/);
  });

  it("every approved built-in template passes its own validation", () => {
    for (const t of TEMPLATES.filter((x) => x.status === "approved")) expect(validateTemplate(t), t.name).toEqual([]);
  });

  it("every rule points at a template that exists", () => {
    const ids = new Set(TEMPLATES.map((t) => t.id));
    for (const r of RULES) expect(ids.has(r.template_id), r.id).toBe(true);
  });
});

describe("escalation ladder", () => {
  const ladder: Rung[] = [
    { after_min: 0, to: "guard", template_id: "t" },
    { after_min: 10, to: "supervisor", template_id: "t" },
    { after_min: 20, to: "voice_call", template_id: null },
  ];
  const states = (elapsed: number, answered: number | null) => playLadder(ladder, elapsed, answered).map((x) => x.state);

  it("waits on the guard, then climbs while nobody answers", () => {
    expect(states(3, null)).toEqual(["waiting", "queued", "queued"]);
    expect(states(12, null)).toEqual(["no_reply", "waiting", "queued"]);
    expect(states(25, null)).toEqual(["no_reply", "no_reply", "waiting"]);
  });

  it("stops at the rung that was answered and skips the rest", () => {
    expect(states(30, 4)).toEqual(["answered", "skipped", "skipped"]);
    expect(states(30, 14)).toEqual(["no_reply", "answered", "skipped"]);
  });

  it("does not count a reply that has not happened yet", () => {
    expect(states(3, 4)).toEqual(["waiting", "queued", "queued"]);
  });

  it("knows quiet hours that wrap midnight", () => {
    expect(inQuietHours("23:10", { from: "21:00", to: "08:00" })).toBe(true);
    expect(inQuietHours("07:59", { from: "21:00", to: "08:00" })).toBe(true);
    expect(inQuietHours("12:00", { from: "21:00", to: "08:00" })).toBe(false);
    expect(inQuietHours("12:00", null)).toBe(false);
  });

  it("estimates the bill per recipient", () => {
    expect(estimateCost(200, "UTILITY")).toBe(23);
  });
});

describe("delivery log", () => {
  const guards = Array.from({ length: 8 }, (_, i) => ({ id: `g${i}`, full_name: `Guard ${i} Kumar`, phone: `9190000000${i}`, site_name: "Prestige" }));
  const now = new Date("2026-10-08T07:00:00Z");
  const { contacts, messages } = buildWhatsapp(guards, [{ id: "s1", full_name: "Priya Nair", phone: null }], now, "seed");

  it("only messages contacts who opted in", () => {
    const opted = new Set(contacts.filter((c) => c.opted_in).map((c) => c.id));
    expect(messages.every((m) => opted.has(m.contact_id))).toBe(true);
    expect(contacts.some((c) => !c.opted_in)).toBe(true);
  });

  it("summarises delivery, reads and replies", () => {
    const s = deliveryStats(messages);
    expect(s.total).toBe(messages.length);
    expect(s.read).toBeLessThanOrEqual(s.delivered);
    expect(s.failed).toBe(2);
  });

  it("threads a contact's messages with their replies in time order", () => {
    const withReply = messages.find((m) => m.reply)!;
    const t = threadFor(withReply.contact_id, messages);
    expect(t.some((l) => l.from === "them")).toBe(true);
    expect(t.map((l) => l.at)).toEqual([...t.map((l) => l.at)].sort());
  });

  it("knows when free text is allowed", () => {
    expect(sessionOpen({ last_inbound_at: new Date(now.getTime() - 3_600_000).toISOString() }, now)).toBe(true);
    expect(sessionOpen({ last_inbound_at: new Date(now.getTime() - 25 * 3_600_000).toISOString() }, now)).toBe(false);
    expect(sessionOpen({ last_inbound_at: null }, now)).toBe(false);
  });
});
