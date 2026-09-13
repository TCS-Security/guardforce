import { chromium } from "@playwright/test";
const [,, ...paths] = process.argv;
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE + "/login");
await page.screenshot({ path: "/tmp/shot-login.png" });
await page.getByLabel("Email").fill("owner@sentinel.test");
await page.getByLabel("Password").fill("guardforce");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL(new RegExp(BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/(?!login)"), { timeout: 60000 });
for (const p of paths.length ? paths : ["/"]) {
  await page.goto(BASE + p, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(1800);
  const name = p === "/" ? "overview" : p.replace(/\W+/g, "-").replace(/^-|-$/g, "");
  await page.screenshot({ path: `/tmp/shot-${name}.png`, fullPage: true });
  console.log("shot", name);
}
await browser.close();
