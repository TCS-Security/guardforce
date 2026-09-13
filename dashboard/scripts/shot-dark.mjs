import { chromium } from "@playwright/test";
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE + "/login");
await page.getByLabel("Email").fill("owner@sentinel.test");
await page.getByLabel("Password").fill("guardforce");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL((url) => !url.pathname.startsWith("/login"));
await page.evaluate(() => { document.documentElement.classList.add("dark"); localStorage.setItem("gf-theme", "dark"); });
for (const p of process.argv.slice(2)) {
  await page.goto(BASE + p, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const name = p === "/" ? "overview" : p.replace(/\W+/g, "-").replace(/^-|-$/g, "");
  await page.screenshot({ path: `/tmp/shot-dark-${name}.png`, fullPage: true });
  console.log("dark shot", name);
}
await browser.close();
