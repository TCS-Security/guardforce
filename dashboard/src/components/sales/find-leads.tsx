"use client";

import { useState, useTransition } from "react";
import { ExternalLink, MapPin, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Section } from "@/components/gf/section";
import { EmptyState } from "@/components/gf/empty-state";
import { nearReason, sizeText, type Reason, type SizeUnit } from "@/lib/domain/sales";
import type { ProspectRow } from "@/lib/data/sales";
import { addProspects } from "@/app/(app)/sales/actions";
import { LabelPill, segmentLabel } from "./bits";

export function FindLeads({ rows, hasSites, canWrite }: { rows: ProspectRow[]; hasSites: boolean; canWrite: boolean }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState<string[]>([]);

  function add(ids: string[]) {
    const fd = new FormData();
    for (const id of ids) fd.append("prospect_id", id);
    startTransition(async () => {
      const res = await addProspects(undefined, fd);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(res?.message ?? "Added", { description: "They're in “My leads” now." });
        setAdded((a) => [...a, ...ids]);
        setPicked([]);
      }
    });
  }

  const visible = rows.filter((r) => !added.includes(r.id));

  return (
    <Section
      title={`${visible.length} place${visible.length === 1 ? "" : "s"} you haven't added yet`}
      description="Public records: RERA apartment projects, government tenders, hospitals, schools, factories and more. Best first."
      bodyClassName="p-0"
      style={{ ["--i" as string]: 4 }}
      actions={
        canWrite && picked.length > 0 ? (
          <Button size="sm" disabled={pending} onClick={() => add(picked)}>
            <Plus data-icon="inline-start" /> Add {picked.length} to my leads
          </Button>
        ) : null
      }
    >
      {visible.length === 0 ? (
        <EmptyState
          icon={<Sparkles />}
          title="Nothing new matches"
          description={hasSites ? "Clear a filter, or turn off “Near my sites”." : "Clear a filter to see more places."}
          className="border-0"
        />
      ) : (
        <ul className="divide-y" aria-label="New leads">
          {visible.map((p) => {
            const reasons = (Array.isArray(p.reasons) ? p.reasons : []) as Reason[];
            const near = nearReason(p.near ? { site: { name: p.near.name }, meters: p.near.meters } : null);
            const shown = [...reasons.filter((r) => r.kind !== "size"), ...(near ? [near] : [])].slice(0, 3);
            const size = sizeText({ size_value: p.size_value, size_unit: p.size_unit as SizeUnit | null, tender_value_inr: p.tender_value_inr, tender_guards: p.tender_guards });
            return (
              <li key={p.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30" data-prospect={p.name}>
                {canWrite && (
                  <Checkbox
                    className="mt-1"
                    aria-label={`Pick ${p.name}`}
                    checked={picked.includes(p.id)}
                    onCheckedChange={(v) => setPicked((ids) => (v ? [...ids, p.id] : ids.filter((i) => i !== p.id)))}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <LabelPill label={p.label as "hot" | "warm" | "cold"} size="xs" />
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>{segmentLabel(p.segment)}</span>
                    {size && <span>· {size}</span>}
                    {p.est_guards ? <span>· about {p.est_guards} guards</span> : null}
                    {p.locality && (
                      <span className="inline-flex items-center gap-0.5">
                        · <MapPin className="size-3" /> {p.locality}
                      </span>
                    )}
                  </div>
                  {shown.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-sm">
                      {shown.map((r, i) => (
                        <li key={i} className="flex gap-1.5">
                          <span className="text-present">✓</span>
                          <span>{r.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {canWrite && (
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => add([p.id])} aria-label={`Add ${p.name}`}>
                      <Plus data-icon="inline-start" /> Add
                    </Button>
                  )}
                  {p.source_url && (
                    <a href={p.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:underline">
                      {p.source === "osm" ? "OpenStreetMap" : p.source.toUpperCase()} <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
