import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/gf/page-header";
import { SiteForm } from "../site-form";

export const metadata: Metadata = { title: "New site" };

/** Bengaluru city centre: a sane starting pin when the agency has no sites yet. */
const FALLBACK_CENTER = { lat: 12.9716, lng: 77.5946 };

export default async function NewSitePage() {
  const session = await requireSession();
  if (!session.isOwner) notFound();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        eyebrow="Sites"
        title="New site"
        description="Capture the perimeter roughly — the leeway buffer absorbs the imprecision."
      />
      <SiteForm
        defaults={{
          ...FALLBACK_CENTER,
          radius_m: session.agency.default_radius_m,
          leeway_m: session.agency.default_leeway_m,
        }}
        submitLabel="Create site"
      />
    </div>
  );
}
