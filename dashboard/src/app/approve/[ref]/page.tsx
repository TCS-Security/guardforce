import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCampus } from "@/lib/campus/sample";
import { decodeApprovalCard } from "@/lib/campus/visitors";
import type { Visitor } from "@/lib/campus/types";
import { demoClock } from "@/lib/data/campus";
import { toLocalDate } from "@/lib/domain/format";
import { EmptyState } from "@/components/gf/empty-state";
import { HostApproval } from "./host-approval";

export const metadata: Metadata = { title: "Visitor at the gate" };
export const dynamic = "force-dynamic";

/**
 * The link a host gets by SMS or WhatsApp when a visitor walks up: no login, no app. Preview:
 * the request is rebuilt from the same sample day the gate desk shows, and the answer is not
 * stored. In production the path carries a signed, single-use, 30-minute token, not the pass.
 */
export default async function ApprovePage({ params, searchParams }: PageProps<"/approve/[ref]">) {
  const { ref } = await params;
  const { site: siteId, v } = await searchParams;
  // Service role, as for the other public share pages: only the site's display fields.
  const { data: site } = typeof siteId === "string" && /^[0-9a-f-]{36}$/.test(siteId)
    ? await createAdminClient().from("sites").select("id,name,client_name,address,city,lat,lng").eq("id", siteId).eq("is_active", true).maybeSingle()
    : { data: null };

  const now = demoClock(new Date(), "Asia/Kolkata");
  const campus = site ? buildCampus(site, [], [], now, toLocalDate(now)) : null;
  const card = typeof v === "string" ? decodeApprovalCard(v) : null;
  const visitor: Visitor | undefined =
    campus?.visitors.find((x) => x.ref === ref.toUpperCase()) ??
    (card && card.ref === ref.toUpperCase() && campus?.tenants.some((t) => t.id === card.tenant_id)
      ? { ...campus.visitors[0]!, ...card, status: "pending", pre_authorised: false }
      : undefined);

  return (
    <main className="min-h-dvh bg-background px-4 py-8">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        {!campus || !visitor ? (
          <EmptyState title="This request has expired" description="Approval links work for 30 minutes and only once. Call the security desk if your visitor is still waiting." />
        ) : (
          <HostApproval
            campus={campus.campus.name}
            visitor={visitor}
            tenant={campus.tenants.find((t) => t.id === visitor.tenant_id)!}
            floor={campus.floors.find((f) => f.id === campus.tenants.find((t) => t.id === visitor.tenant_id)!.floor_id)!.name}
            gate={campus.gates.find((g) => g.id === visitor.gate_id)?.name ?? "the gate"}
          />
        )}
        <p className="text-center font-mono text-[11px] tracking-wider text-muted-foreground uppercase">Secured by GuardForce · preview</p>
      </div>
    </main>
  );
}
