import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmptyState } from "@/components/gf/empty-state";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { Mono } from "@/components/gf/mono";
import { StatusPill } from "@/components/gf/status-pill";
import { DOCUMENT_TYPES, DOCUMENT_STATUS } from "@/lib/domain/status";
import { fmtDate, fmtPct, fmtMinutes } from "@/lib/domain/format";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Verified guard profile" };
export const dynamic = "force-dynamic";

type ShareDoc = { type: string; status: string; number_masked: string | null; verified_at: string | null; issued_on: string | null; file_path?: string | null };
type Resolved = {
  error?: "NOT_FOUND" | "REVOKED" | "EXPIRED";
  share?: { id: string; expires_at: string; label: string | null; include_documents: boolean; created_at: string };
  agency?: { name: string; city: string | null; logo_path: string | null };
  guard?: {
    id: string; full_name: string; employee_code: string | null; designation: string | null; phone_masked: string;
    joined_at: string | null; status: string; registration_selfie_path: string | null; phone_verified: boolean;
    kyc_complete: boolean; site: string | null; languages: string[];
  };
  documents?: ShareDoc[];
  scorecard?: Record<string, number | null>;
};

export default async function SharePage({ params }: PageProps<"/share/[token]">) {
  const { token } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("resolve_profile_share", { p_token: token });
  const result = (data ?? { error: "NOT_FOUND" }) as Resolved;

  if (error || result.error) {
    return <SharePageError reason={result.error ?? "NOT_FOUND"} />;
  }

  const { share, agency, guard, documents, scorecard } = result as Required<Resolved>;

  let selfieUrl: string | null = null;
  if (guard.registration_selfie_path) {
    const { data: signed } = await admin.storage.from("selfies").createSignedUrl(guard.registration_selfie_path, 600);
    selfieUrl = signed?.signedUrl ?? null;
  }

  const docThumbs = new Map<string, string>();
  if (share.include_documents) {
    for (const d of documents) {
      if (d.file_path) {
        const { data: signed } = await admin.storage.from("kyc-docs").createSignedUrl(d.file_path, 600);
        if (signed?.signedUrl) docThumbs.set(d.type, signed.signedUrl);
      }
    }
  }
  const byType = new Map(documents.map((d) => [d.type, d]));

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-6 py-10 print:max-w-full print:gap-4 print:px-0 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <div className="eyebrow">Verified guard profile · {agency.name}</div>
        <PrintButton />
      </div>

      <header className="flex items-center gap-4 border-b pb-5">
        <GuardAvatar name={guard.full_name} src={selfieUrl} size="xl" />
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{guard.full_name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <Mono>{guard.employee_code ?? "—"}</Mono>
            <span>{guard.designation ?? "—"}</span>
            <span>·</span>
            <span>{guard.site ?? "Unassigned"}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <StatusPill tone={guard.kyc_complete ? "present" : "signal"} size="xs">
              {guard.kyc_complete ? "KYC complete" : "KYC incomplete"}
            </StatusPill>
            <StatusPill tone={guard.phone_verified ? "present" : "neutral"} size="xs" dot={false}>
              Phone {guard.phone_verified ? "verified" : "unverified"} · {guard.phone_masked}
            </StatusPill>
          </div>
        </div>
      </header>

      <section>
        <h2 className="mb-2 font-display text-sm font-semibold">Documents</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {DOCUMENT_TYPES.map((slot) => {
            const doc = byType.get(slot.type);
            const thumb = docThumbs.get(slot.type);
            return (
              <div key={slot.type} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{slot.label}</span>
                  {doc ? (
                    <StatusPill tone={DOCUMENT_STATUS[doc.status as keyof typeof DOCUMENT_STATUS].tone} size="xs">
                      {DOCUMENT_STATUS[doc.status as keyof typeof DOCUMENT_STATUS].label}
                    </StatusPill>
                  ) : (
                    <StatusPill tone={slot.required ? "signal" : "neutral"} size="xs">Missing</StatusPill>
                  )}
                </div>
                {doc?.number_masked && <Mono className="text-muted-foreground">{doc.number_masked}</Mono>}
                {doc?.issued_on && <span className="text-xs text-muted-foreground">Issued {fmtDate(doc.issued_on)}</span>}
                {thumb && (
                  <div className="relative mt-1 overflow-hidden rounded-md border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb} alt={`${slot.label} scan`} className="h-32 w-full object-cover" />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="rotate-[-24deg] text-xs font-semibold tracking-wide text-background/90 opacity-70 mix-blend-difference select-none">
                        Shared via {agency.name}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-display text-sm font-semibold">Scorecard, last 90 days</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Shifts", scorecard.shifts ?? 0],
            ["Punctuality", fmtPct(scorecard.punctuality_pct)],
            ["Worked hours", scorecard.worked_hours ?? 0],
            ["Avg away", fmtMinutes(scorecard.avg_away_min)],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-lg border p-3">
              <div className="eyebrow">{label}</div>
              <div className="font-display text-xl font-semibold tabular">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-6 border-t pt-4 text-xs text-muted-foreground print:mt-4">
        Shared via {agency.name} · expires {fmtDate(share.expires_at)}
        {guard.joined_at && <> · joined {fmtDate(guard.joined_at)}</>}
      </footer>
    </div>
  );
}

function SharePageError({ reason }: { reason: "NOT_FOUND" | "REVOKED" | "EXPIRED" }) {
  const copy = {
    NOT_FOUND: { title: "Link not found", description: "This share link doesn't exist. Ask the agency for a new one." },
    REVOKED: { title: "Link revoked", description: "This share link has been revoked by the agency and is no longer valid." },
    EXPIRED: { title: "Link expired", description: "This share link has expired. Ask the agency to generate a new one." },
  }[reason];
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-6">
      <EmptyState title={copy.title} description={copy.description} />
    </div>
  );
}
