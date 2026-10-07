"use client";

import { useState } from "react";
import { FilePen, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Section } from "@/components/gf/section";
import { StatusPill } from "@/components/gf/status-pill";
import { Mono } from "@/components/gf/mono";
import { EmptyState } from "@/components/gf/empty-state";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { fmtAgo, fmtDate } from "@/lib/domain/format";
import { POST_ORDER_KIND, ackProgress, publishRevision, type PostOrder, type PostOrderKind } from "@/lib/preview/site-ops";
import type { CrewSite } from "@/lib/preview/crew";
import { cn } from "cn";

type Draft = { mode: "new" } | { mode: "revise"; order: PostOrder };

export function PostOrdersBoard({ sites, initial, canEdit, editor }: { sites: CrewSite[]; initial: PostOrder[]; canEdit: boolean; editor: string }) {
  const [orders, setOrders] = useState(initial);
  const [siteId, setSiteId] = useState(sites[0]!.id);
  const [draft, setDraft] = useState<Draft | null>(null);
  const site = sites.find((s) => s.id === siteId)!;
  const mine = orders.filter((o) => o.site_id === siteId);

  function save(kind: PostOrderKind, title: string, steps: string[]) {
    const now = new Date().toISOString();
    if (draft?.mode === "revise") {
      setOrders((xs) => xs.map((o) => (o.id === draft.order.id ? { ...publishRevision(o, steps, editor, now), title } : o)));
      toast.success(`“${title}” is now v${draft.order.version + 1}`, { description: "Every guard at the site must accept it again. Preview only." });
    } else {
      const guards = orders.find((o) => o.site_id === siteId)?.acks.map((a) => ({ guard: a.guard, version: null, at: null })) ?? [];
      setOrders((xs) => [...xs, { id: `po-new-${Date.now()}`, site_id: siteId, kind, title, steps, version: 1, updated_at: now, updated_by: editor, acks: guards }]);
      toast.success(`“${title}” published to ${site.name}`, { description: "Preview only — not saved." });
    }
    setDraft(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Section title="Sites" bodyClassName="p-1.5" className="lg:self-start" style={{ ["--i" as string]: 1 }}>
        <ul className="flex flex-col gap-px" aria-label="Sites">
          {sites.map((s) => {
            const so = orders.filter((o) => o.site_id === s.id);
            const unread = so.reduce((n, o) => { const p = ackProgress(o); return n + (p.total - p.read); }, 0);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSiteId(s.id)}
                  aria-current={s.id === siteId ? "true" : undefined}
                  className={cn("flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors", s.id === siteId ? "bg-muted font-medium" : "hover:bg-muted/60")}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{s.name}</span>
                    <span className="block text-xs font-normal text-muted-foreground">{so.length} orders</span>
                  </span>
                  {unread > 0 && <StatusPill tone="half-day" size="xs" dot={false}>{unread} unread</StatusPill>}
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="reveal flex flex-wrap items-center justify-between gap-3" style={{ ["--i" as string]: 2 }}>
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">{site.name}</h2>
            <p className="text-xs text-muted-foreground">{site.client_name ?? "No client"}{site.city ? ` · ${site.city}` : ""}</p>
          </div>
          {canEdit && <Button onClick={() => setDraft({ mode: "new" })}><Plus data-icon="inline-start" /> New post order</Button>}
        </div>

        {mine.length === 0 && <EmptyState title="No post orders" description="Write the first one — gate duties are a good start." />}

        {mine.map((o, i) => {
          const p = ackProgress(o);
          const pending = o.acks.filter((a) => a.version !== o.version);
          return (
            <Section
              key={o.id}
              title={<span className="flex items-center gap-2">{o.title} <Mono className="text-xs font-normal text-muted-foreground">v{o.version}</Mono></span>}
              description={<>{POST_ORDER_KIND[o.kind]} · revised {fmtAgo(o.updated_at)} by {o.updated_by}</>}
              actions={canEdit && <Button size="sm" variant="ghost" onClick={() => setDraft({ mode: "revise", order: o })}><FilePen data-icon="inline-start" /> Revise</Button>}
              style={{ ["--i" as string]: i + 3 }}
            >
              <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_240px]">
                <ol className="flex flex-col gap-2 text-sm">
                  {o.steps.map((s, n) => (
                    <li key={n} className="flex gap-3">
                      <Mono className="mt-px w-5 shrink-0 text-xs text-muted-foreground">{String(n + 1).padStart(2, "0")}</Mono>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
                <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="eyebrow">Accepted</span>
                    <Mono className="text-xs">{p.read}/{p.total}</Mono>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", p.read === p.total ? "bg-present" : "bg-half-day")} style={{ width: `${p.total ? (100 * p.read) / p.total : 0}%` }} />
                  </div>
                  {pending.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Every guard at the site has accepted v{o.version}.</p>
                  ) : (
                    <ul className="mt-1 flex flex-col gap-1.5" aria-label="Not yet accepted">
                      {pending.map((a) => (
                        <li key={a.guard.id} className="flex items-center gap-2 text-xs">
                          <GuardAvatar name={a.guard.full_name} size="xs" />
                          <span className="truncate">{a.guard.full_name}</span>
                          <span className="ml-auto shrink-0 text-muted-foreground">{a.version ? `on v${a.version}` : "never read"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-auto pt-1 text-[11px] text-muted-foreground">Since {fmtDate(o.updated_at, undefined, "d MMM")}</div>
                </div>
              </div>
            </Section>
          );
        })}
      </div>

      <OrderDialog draft={draft} onClose={() => setDraft(null)} onSave={save} />
    </div>
  );
}

function OrderDialog({ draft, onClose, onSave }: { draft: Draft | null; onClose: () => void; onSave: (kind: PostOrderKind, title: string, steps: string[]) => void }) {
  const order = draft?.mode === "revise" ? draft.order : null;
  const [kind, setKind] = useState<PostOrderKind>("gate");
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={draft != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{order ? `Revise “${order.title}”` : "New post order"}</DialogTitle>
          <DialogDescription>
            {order ? `Publishing makes this v${order.version + 1}; every guard at the site has to accept it again.` : "One instruction per line. Guards see them as numbered steps."}
          </DialogDescription>
        </DialogHeader>
        <form
          key={order?.id ?? "new"}
          className="flex flex-col gap-4"
          action={(form) => {
            const title = String(form.get("title") ?? "").trim();
            const steps = String(form.get("steps") ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
            if (!title) return setError("Give the order a title.");
            if (steps.length === 0) return setError("Write at least one instruction.");
            setError(null);
            onSave(order?.kind ?? kind, title, steps);
          }}
        >
          <div className="grid grid-cols-[minmax(0,1fr)_170px] gap-3">
            <Field>
              <Label htmlFor="po-title">Title</Label>
              <Input id="po-title" name="title" defaultValue={order?.title} placeholder="e.g. Loading bay duties" />
            </Field>
            <Field>
              <Label htmlFor="po-kind">Type</Label>
              <Select value={order?.kind ?? kind} onValueChange={(v) => v && setKind(v as PostOrderKind)} disabled={!!order}>
                <SelectTrigger id="po-kind" className="w-full" aria-label="Type"><SelectValue>{POST_ORDER_KIND[order?.kind ?? kind]}</SelectValue></SelectTrigger>
                <SelectContent>{(Object.keys(POST_ORDER_KIND) as PostOrderKind[]).map((k) => <SelectItem key={k} value={k}>{POST_ORDER_KIND[k]}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field>
            <Label htmlFor="po-steps">Instructions</Label>
            <Textarea id="po-steps" name="steps" rows={7} defaultValue={order?.steps.join("\n")} placeholder={"Check every vehicle's pass\nWrite the seal number in the register"} />
          </Field>
          {error && <p role="alert" className="text-sm text-absent">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit">{order ? "Publish revision" : "Publish"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
