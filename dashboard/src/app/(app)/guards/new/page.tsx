import type { Metadata } from "next";
import { loadGuardFormOptions } from "@/lib/data/guards";
import { PageHeader } from "@/components/gf/page-header";
import { Section } from "@/components/gf/section";
import { NewGuardForm } from "./new-guard-form";

export const metadata: Metadata = { title: "Add guard" };

export default async function NewGuardPage() {
  const { sites, supervisors, suggestedCode } = await loadGuardFormOptions();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader
        eyebrow="Roster · Add guard"
        title="Add a guard"
        description="Creates an invited profile and an install link for the guard app. KYC documents are collected on the guard's profile page."
      />
      <Section>
        <NewGuardForm sites={sites} supervisors={supervisors} suggestedCode={suggestedCode} />
      </Section>
    </div>
  );
}
