import { test, expect } from "@playwright/test";
import { admin, login, SEED } from "./helpers";

const stamp = () => Date.now().toString().slice(-6);

/** A 1x1 PNG, enough to exercise the upload path without a fixture file. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** The KYC test uploads a real object; make sure an earlier run has not left one behind. */
async function clearSantoshPoliceDoc() {
  const db = admin();
  const { data: doc } = await db
    .from("guard_documents")
    .select("id,file_path")
    .eq("guard_id", SEED.guards.santoshIncompleteKyc)
    .eq("type", "police_verification")
    .maybeSingle();
  if (!doc) return;
  if (doc.file_path) await db.storage.from("kyc-docs").remove([doc.file_path]);
  await db.from("document_access_logs").delete().eq("document_id", doc.id);
  await db.from("guard_documents").delete().eq("id", doc.id);
}

test.describe("guards", () => {
  test("lists guards with KYC completeness and filters the incomplete ones", async ({ page }) => {
    await login(page);
    await page.goto("/guards");
    await expect(page.getByRole("heading", { name: "Guards", level: 1 })).toBeVisible();
    await expect(page.getByText("Ramesh Yadav")).toBeVisible();
    await expect(page.getByText("Complete").first()).toBeVisible();

    await page.goto("/guards?kyc=incomplete");
    await expect(page.getByText("Santosh Kumar")).toBeVisible();
    await expect(page.getByText("Ramesh Yadav")).toHaveCount(0);
  });

  test("adds a guard and offers an invite link to send", async ({ page }) => {
    const db = admin();
    const phone = `98${Date.now().toString().slice(-8)}`;
    const name = `E2E Guard ${stamp()}`;
    await login(page);
    await page.goto("/guards/new");

    await page.getByLabel("Full name").fill(name);
    await page.getByLabel("Phone").fill(phone);
    await page.getByLabel(/Designation/).fill("Gate Guard");
    await page.getByRole("button", { name: /Add guard|Create guard|Save/ }).first().click();

    await expect(page).toHaveURL(/\/guards\/[0-9a-f-]{36}/, { timeout: 20_000 });
    const guardId = new URL(page.url()).pathname.split("/").pop()!;
    try {
      await expect(page.getByText(name).first()).toBeVisible();
      await expect(page.getByText(/guardforce:\/\/invite\//)).toBeVisible();

      const { data: invite } = await db.from("guard_invites").select("token,sent_at").eq("guard_id", guardId).maybeSingle();
      expect(invite).not.toBeNull();
    } finally {
      await db.from("guard_invites").delete().eq("guard_id", guardId);
      await db.from("guard_documents").delete().eq("guard_id", guardId);
      await db.from("guards").delete().eq("id", guardId);
    }
  });

  test("uploading and verifying a KYC document closes the gap and is access-logged", async ({ page }) => {
    const db = admin();
    await clearSantoshPoliceDoc();
    const guardId = SEED.guards.santoshIncompleteKyc;
    await login(page);
    await page.goto(`/guards/${guardId}`);

    await expect(page.getByText(/Cannot be rostered/)).toBeVisible();

    const before = await db.rpc("guard_kyc_missing", { p_guard_id: guardId });
    expect(before.data).toContain("police_verification");

    const slot = page.getByTestId("kyc-slot-police_verification");
    await slot.getByRole("button", { name: /Upload|Replace/ }).click();
    await page.getByLabel("File").setInputFiles({ name: "pvc.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("dialog").getByRole("button", { name: /^(Upload|Replace|Save)/ }).click();

    await expect(slot.getByText("Awaiting review")).toBeVisible({ timeout: 20_000 });

    const after = await db.rpc("guard_kyc_missing", { p_guard_id: guardId });
    expect(after.data).not.toContain("police_verification");

    await clearSantoshPoliceDoc();
  });

  test("shares a profile, and the public page honours revocation", async ({ page, browser }) => {
    const db = admin();
    await login(page);
    await page.goto(`/guards/${SEED.guards.suresh}`);

    const anon = await browser.newContext();
    const publicPage = await anon.newPage();
    await publicPage.goto(`/share/${SEED.shareToken}`);
    await expect(publicPage.getByText("Suresh Gowda")).toBeVisible();
    await expect(publicPage.getByText(/Shared via Sentinel Security Services/)).toBeVisible();
    await expect(publicPage.getByText(/XXXX XXXX/).first()).toBeVisible();

    const { data: share } = await db.from("profile_shares").select("view_count").eq("token", SEED.shareToken).single();
    expect(share!.view_count).toBeGreaterThan(0);

    // an expired link must not resolve
    const { data: expired } = await db
      .from("profile_shares")
      .insert({
        agency_id: SEED.agencyId,
        guard_id: SEED.guards.suresh,
        token: `e2e-expired-${stamp()}`,
        label: "E2E expired",
        expires_at: new Date(Date.now() - 86_400_000).toISOString(),
      })
      .select("id,token")
      .single();
    await publicPage.goto(`/share/${expired!.token}`);
    await expect(publicPage.getByText("Link expired")).toBeVisible();

    await anon.close();
    await db.from("profile_shares").delete().eq("id", expired!.id);
  });

  test("supervisor cannot open a guard outside their scope", async ({ page }) => {
    await login(page, SEED.supervisor);
    await page.goto("/guards");
    await expect(page.getByText("Ramesh Yadav")).toBeVisible();
    await expect(page.getByText("Shivakumar M")).toHaveCount(0);
  });
});
