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
