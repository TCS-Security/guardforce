"use client";

import { useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/gf/status-pill";
import { KvList } from "@/components/gf/kv";
import { Mono } from "@/components/gf/mono";
import { VisitorPhoto } from "@/components/campus/campus-bits";
import { ID_TYPE, maskId, VISITOR_TYPE } from "@/lib/campus/visitors";
import { fmtTime } from "@/lib/domain/format";
import type { Tenant, Visitor } from "@/lib/campus/types";

/** One visitor, two big buttons. Built for a phone in one hand. */
export function HostApproval({ campus, visitor, tenant, floor, gate }: { campus: string; visitor: Visitor; tenant: Tenant; floor: string; gate: string }) {
  const [answer, setAnswer] = useState<"approved" | "denied" | null>(visitor.status === "pending" ? null : visitor.status === "rejected" ? "denied" : "approved");
  return (
    <article className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm" aria-label="Visitor approval">
      <header className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4 text-primary" /> {campus} · security desk</header>
      <div>
        <div className="eyebrow">Hello {tenant.contact_name.replace(/^Dr\.\s*/, "").split(" ")[0]}</div>
        <h1 className="font-display text-2xl leading-tight font-semibold">Someone is at {gate.split(" · ")[0]} to see you</h1>
      </div>
      <div className="flex items-center gap-4">
        <VisitorPhoto name={visitor.name} hue={visitor.photo_hue} size="lg" />
        <div>
          <div className="font-display text-xl font-semibold">{visitor.name}</div>
          <div className="text-sm text-muted-foreground">{visitor.company}</div>
          <StatusPill tone="olive" size="xs" dot={false} className="mt-1">{VISITOR_TYPE[visitor.type]}</StatusPill>
        </div>
      </div>
      <KvList items={[
        { k: "Purpose", v: visitor.purpose },
        { k: "For", v: `${tenant.name}, ${floor}` },
        { k: "ID checked", v: <>{ID_TYPE[visitor.id_type]} <Mono className="text-xs">{maskId(visitor.id_type, visitor.id_last4)}</Mono></> },
        { k: "Arrived", v: <Mono>{fmtTime(visitor.arrived_at)}</Mono> },
      ]} />
      {answer ? (
        <div role="status" className={answer === "approved" ? "rounded-xl bg-present/10 p-4 text-center text-present" : "rounded-xl bg-absent/10 p-4 text-center text-absent"}>
          <div className="font-display text-lg font-semibold">{answer === "approved" ? "Approved — they're on their way up" : "Denied — the gate will not let them in"}</div>
          <div className="text-sm opacity-80">The security desk has been told. You can close this page.</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" variant="destructive" className="h-14 text-base" onClick={() => setAnswer("denied")}><X data-icon="inline-start" /> Deny</Button>
          <Button size="lg" className="h-14 text-base" onClick={() => setAnswer("approved")}><Check data-icon="inline-start" /> Approve</Button>
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground">Approving lets {visitor.name.split(" ")[0]} in for today only. No app or login needed.</p>
    </article>
  );
}
