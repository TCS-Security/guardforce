"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { LOST_REASONS, STAGES, type Stage } from "@/lib/domain/sales";
import type { LeadRow } from "@/lib/data/sales";
import { moveLead } from "@/app/(app)/sales/actions";
import { LabelPill, segmentLabel } from "./bits";

/**
 * Kanban: drag a card to the next column. On a phone (no drag), the stage menu on the lead card
 * does the same job. Moves are applied on screen straight away and rolled back if the server says no.
 */
export function LeadsBoard({ rows, base, canWrite, today }: { rows: LeadRow[]; base: string; canWrite: boolean; today: string }) {
  const [stages, setStages] = useState<Record<string, Stage>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [lostFor, setLostFor] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const stageOf = (l: LeadRow) => stages[l.id] ?? (l.stage as Stage);
  const href = (id: string) => `/sales?${base ? `${base}&` : ""}lead=${id}`;

  function move(id: string, to: Stage, reason?: string) {
    const lead = rows.find((r) => r.id === id);
    if (!lead || stageOf(lead) === to) return;
    if (to === "lost" && !reason) {
      setLostFor(id);
      return;
    }
    const before = stageOf(lead);
    setStages((s) => ({ ...s, [id]: to }));
    startTransition(async () => {
      const res = await moveLead(id, to, reason);
      if (res?.error) {
        setStages((s) => ({ ...s, [id]: before }));
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <div className="reveal -mx-1 overflow-x-auto pb-2" style={{ ["--i" as string]: 4 }}>
        <div className="grid min-w-[1100px] grid-cols-6 gap-3 px-1">
          {STAGES.map((col) => {
            const items = rows.filter((l) => stageOf(l) === col.key);
            return (
              <section
                key={col.key}
                aria-label={col.label}
                data-stage={col.key}
                onDragOver={(e) => {
                  // Don't gate on dragId: a fast drag can reach the column before that state renders.
                  if (!canWrite) return;
                  e.preventDefault();
                  setOver(col.key);
                }}
                onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  const id = e.dataTransfer.getData("application/x-lead-id") || dragId;
                  setDragId(null);
                  if (id) move(id, col.key);
                }}
                className={cn(
                  "flex min-h-[420px] flex-col rounded-lg border bg-secondary/60 transition-colors",
                  over === col.key && "border-primary bg-primary/5",
                )}
              >
                <header className="flex items-center justify-between border-b px-3 py-2">
                  <h3 className="font-display text-sm font-semibold">{col.label}</h3>
                  <span className="font-mono text-xs text-muted-foreground tabular">{items.length}</span>
                </header>
                <div className="flex flex-1 flex-col gap-2 p-2">
                  {items.map((l) => (
                    <article
                      key={l.id}
                      draggable={canWrite}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/x-lead-id", l.id);
                        e.dataTransfer.setData("text/plain", l.name);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(l.id);
                      }}
                      onDragEnd={() => setDragId(null)}
                      data-lead={l.name}
                      className={cn(
                        "rounded-md border bg-card p-2.5 shadow-xs transition-shadow hover:shadow-sm",
                        canWrite && "cursor-grab active:cursor-grabbing",
                        dragId === l.id && "opacity-50",
                      )}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <LabelPill label={l.label as "hot" | "warm" | "cold"} size="xs" />
                        {l.owner && <GuardAvatar name={l.owner.full_name} size="xs" />}
                      </div>
                      <Link href={href(l.id)} scroll={false} draggable={false} className="block text-sm leading-snug font-medium hover:underline">
                        {l.name}
                      </Link>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {segmentLabel(l.segment)}
                        {l.locality ? ` · ${l.locality}` : ""}
                      </div>
                      {l.next_follow_up && !["won", "lost"].includes(stageOf(l)) && (
                        <div className={cn("mt-1.5 font-mono text-[11px]", l.next_follow_up < today ? "text-absent" : "text-muted-foreground")}>
                          Follow up {l.next_follow_up === today ? "today" : l.next_follow_up.slice(5).split("-").reverse().join("/")}
                        </div>
                      )}
                    </article>
                  ))}
                  {items.length === 0 && <p className="px-1 py-6 text-center text-xs text-muted-foreground">Drop a lead here</p>}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <Dialog open={lostFor != null} onOpenChange={(o) => !o && setLostFor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Why was it lost?</DialogTitle>
            <DialogDescription>One tap. This helps us see what to fix.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {LOST_REASONS.map((r) => (
              <Button
                key={r}
                variant="outline"
                className="justify-start"
                onClick={() => {
                  const id = lostFor;
                  setLostFor(null);
                  if (id) move(id, "lost", r);
                }}
              >
                {r}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLostFor(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
