import { chromium } from "@playwright/test";
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const paths = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const msgs = [];
page.on("console", (m) => { if (m.type() === "error") msgs.push("console: " + m.text().slice(0, 300)); });
page.on("pageerror", (e) => msgs.push("pageerror: " + e.message.slice(0, 300)));
await page.goto(BASE + "/login");
await page.getByLabel("Email").fill("owner@sentinel.test");
await page.getByLabel("Password").fill("guardforce");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL(new RegExp(BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/(?!login)"));
for (const p of paths) {
  msgs.length = 0;
  await page.goto(BASE + p, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  console.log(`${p}: ${msgs.length ? "\n  " + msgs.join("\n  ") : "clean"}`);
}
await browser.close();
