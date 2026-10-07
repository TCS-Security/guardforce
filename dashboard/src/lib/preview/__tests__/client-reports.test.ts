import { describe, expect, it } from "vitest";
import { buildDar, clientAccounts, sentLog } from "../client-reports";
import { crew } from "./fixtures";

describe("client daily reports", () => {
  it("groups sites by client name", () => {
    const accounts = clientAccounts({ ...crew, sites: [...crew.sites, { ...crew.sites[0]!, id: "s3", name: "Prestige Lakeside" }] });
    expect(accounts.find((a) => a.name === "Prestige Group")?.sites.map((s) => s.id)).toEqual(["s1", "s3"]);
  });

  it("logs a week of sends only for enabled clients", () => {
    const accounts = clientAccounts(crew);
    const log = sentLog(accounts, crew.today);
    expect(log.length).toBe(accounts.filter((a) => a.enabled).length * 7);
    for (const s of log) expect(s.opened_at != null).toBe(s.status === "opened");
  });

  it("never reports more guards present than posts", () => {
    const a = clientAccounts(crew)[0]!;
    for (const d of buildDar(a, crew, "2026-10-07")) {
      expect(d.present + d.absent).toBe(d.posts);
      expect(d.patrols_done).toBeLessThanOrEqual(d.patrols_due);
    }
  });
});

describe("client reports, edge cases", () => {
  it("keeps keys unique when names would slug the same", () => {
    const sites = [
      { ...crew.sites[0]!, id: "a", client_name: "Brigade Enterprises Ltd" },
      { ...crew.sites[0]!, id: "b", client_name: "Brigade Enterprises Pvt" },
      { ...crew.sites[0]!, id: "c", client_name: "स्वस्तिक" },
      { ...crew.sites[0]!, id: "d", client_name: "मंगल" },
    ];
    const keys = clientAccounts({ ...crew, sites }).map((a) => a.key);
    expect(new Set(keys).size).toBe(4);
  });

  it("shows nothing sent or opened after now", () => {
    const now = new Date("2026-10-08T00:30:00Z"); // 06:00 IST, before any send time
    const log = sentLog(clientAccounts(crew), crew.today, now);
    for (const s of log) {
      expect(s.sent_at <= now.toISOString()).toBe(true);
      if (s.opened_at) expect(s.opened_at <= now.toISOString()).toBe(true);
    }
    expect(log.some((s) => s.date === "2026-10-07")).toBe(false);
  });
});
