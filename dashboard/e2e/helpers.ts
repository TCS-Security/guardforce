import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export const SEED = {
  agencyId: "a0000000-0000-4000-8000-000000000001",
  owner: { email: "owner@sentinel.test", password: "guardforce", name: "Rajesh Menon" },
  supervisor: { email: "priya@sentinel.test", password: "guardforce", name: "Priya Nair" },
  supervisor2: { email: "arun@sentinel.test", password: "guardforce", name: "Arun Kumar" },
  sites: {
    prestige: "c0000000-0000-4000-8000-000000000001",
    brigade: "c0000000-0000-4000-8000-000000000002",
    metro: "c0000000-0000-4000-8000-000000000003",
    sobha: "c0000000-0000-4000-8000-000000000004",
  },
  guards: {
    ramesh: "e0000000-0000-4000-8000-000000000001",
    suresh: "e0000000-0000-4000-8000-000000000002",
    mohan: "e0000000-0000-4000-8000-000000000003",
    harish: "e0000000-0000-4000-8000-000000000013",
    santoshIncompleteKyc: "e0000000-0000-4000-8000-000000000014",
    manjunathInvited: "e0000000-0000-4000-8000-000000000015",
    rajniIncompleteKyc: "e0000000-0000-4000-8000-000000000016",
  },
  shareToken: "demo-share-suresh-gowda-7f3a9c",
};

export async function login(page: Page, user = SEED.owner) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
  await page.waitForLoadState("networkidle");
}

/** Service-role client for arranging state (simulating the guard app, resetting rows). */
export function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
    { auth: { persistSession: false } },
  );
}

/** A date in the agency's timezone (IST), which is what every page filters on. */
export function agencyDate(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
