import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { PageHeader } from "@/components/gf/page-header";
import { NewTenantForm } from "@/components/platform/new-tenant-form";

export const metadata: Metadata = { title: "New tenant · Platform" };

export default async function NewTenantPage() {
  await requirePlatformAdmin();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        eyebrow="Tenants"
        title="Onboard an agency"
        description="Creates the agency with its built-in roles and the first owner login. You hand the owner their one-time password."
      />
      <NewTenantForm />
    </div>
  );
}
