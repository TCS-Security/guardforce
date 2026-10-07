"use client";

import { useState } from "react";
import { ArrowRight, CheckCheck, Clock, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Section } from "@/components/gf/section";
import { StatTile } from "@/components/gf/stat-tile";
import { StatusPill } from "@/components/gf/status-pill";
import { Mono } from "@/components/gf/mono";
import { EmptyState } from "@/components/gf/empty-state";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { fmtAgo, fmtDayLabel, fmtTime, toLocalDate } from "@/lib/domain/format";
import type { Handover, HandoverPriority } from "@/lib/preview/site-ops";
import type { CrewGuard, CrewSite } from "@/lib/preview/crew";
import type { Tone } from "@/lib/domain/status";
import { cn } from "cn";

const PRIORITY: Record<HandoverPriority, { label: string; tone: Tone }> = {
  routine: { label: "Routine", tone: "neutral" },
  watch: { label: "Keep watch", tone: "half-day" },
  urgent: { label: "Urgent", tone: "signal" },
};

export function HandoverBoard({ initial, sites, guards, today }: { initial: Handover[]; sites: CrewSite[]; guards: CrewGuard[]; today: string }) {
  const [list, setList] = useState(initial);
  const [site, setSite] = useState<string>("all");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [dayLimit, setDayLimit] = useState(2);

  const todays = list.filter((h) => toLocalDate(new Date(h.at)) === today);
  const unread = list.filter((h) => !h.read_at);
  const flagged = list.filter((h) => h.priority !== "routine" && toLocalDate(new Date(h.at)) >= today.slice(0, 8) + "01");
  const shown = list.filter((h) => (site === "all" || h.site.id === site) && (!onlyOpen || h.priority !== "routine"));
  const allDays = [...new Set(shown.map((h) => toLocalDate(new Date(h.at))))];
  const days = allDays.slice(0, dayLimit);

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Handovers today" value={todays.length} hint={`across ${new Set(todays.map((h) => h.site.id)).size} sites`} style={{ ["--i" as string]: 1 }} />
        <StatTile label="Not yet read" value={unread.length} tone={unread.length ? "half-day" : "neutral"} hint="incoming guard hasn’t opened it" style={{ ["--i" as string]: 2 }} />
        <StatTile label="Watch & urgent" value={flagged.length} tone={flagged.some((h) => h.priority === "urgent") ? "signal" : "neutral"} hint="this month" style={{ ["--i" as string]: 3 }} />
      </div>

      <div className="reveal flex flex-wrap items-center justify-between gap-3" style={{ ["--i" as string]: 4 }}>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={site} onValueChange={(v) => v && setSite(v)}>
            <SelectTrigger className="w-56" aria-label="Site"><SelectValue>{site === "all" ? "All sites" : sites.find((s) => s.id === site)?.name}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sites</SelectItem>
              {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <ToggleGroup value={[onlyOpen ? "flagged" : "all"]} onValueChange={(v) => v[0] && setOnlyOpen(v[0] === "flagged")} variant="outline" size="sm" aria-label="Which handovers">
            <ToggleGroupItem value="all">Everything</ToggleGroupItem>
            <ToggleGroupItem value="flagged">Watch & urgent</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <WriteHandover sites={sites} guards={guards} onSave={(h) => { setList((xs) => [h, ...xs]); toast.success("Handover logged", { description: "Preview only — not saved." }); }} />
      </div>

      {shown.length === 0 && <EmptyState title="Nothing here" description="No handovers match. Try all sites." />}

      {days.map((day, d) => (
        <Section key={day} title={fmtDayLabel(day)} bodyClassName="p-0" style={{ ["--i" as string]: d + 5 }}>
          <ul className="divide-y">
            {shown.filter((h) => toLocalDate(new Date(h.at)) === day).map((h) => (
              <li key={h.id} className={cn("grid gap-x-5 gap-y-2 px-4 py-3 md:grid-cols-[200px_minmax(0,1fr)_150px]", h.priority === "urgent" && "shadow-[inset_3px_0_0_0_var(--signal)]")}>
                <div className="flex flex-col gap-1">
                  <Mono className="text-xs">{fmtTime(h.at)}</Mono>
                  <span className="truncate text-sm font-medium">{h.site.name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <GuardAvatar name={h.from.full_name} size="xs" />
                    <span className="truncate">{h.from.full_name.split(" ")[0]}</span>
                    <ArrowRight className="size-3 shrink-0" />
                    {h.to ? <><GuardAvatar name={h.to.full_name} size="xs" /><span className="truncate">{h.to.full_name.split(" ")[0]}</span></> : <span>next shift</span>}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  <p className="text-sm">{h.note}</p>
                  {h.items.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {h.items.map((it) => <StatusPill key={it} tone="neutral" dot={false} size="xs">{it}</StatusPill>)}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-start gap-1.5 md:items-end">
                  <StatusPill tone={PRIORITY[h.priority].tone} size="xs">{PRIORITY[h.priority].label}</StatusPill>
                  {h.read_at
                    ? <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><CheckCheck className="size-3 text-present" /> read {fmtAgo(h.read_at)}</span>
                    : <span className="flex items-center gap-1 text-[11px] text-half-day-foreground dark:text-half-day"><Clock className="size-3" /> not read yet</span>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ))}

      {allDays.length > days.length && (
        <Button variant="outline" className="self-center" onClick={() => setDayLimit((n) => n + 3)}>
          Show older handovers
        </Button>
      )}
    </>
  );
}

function WriteHandover({ sites, guards, onSave }: { sites: CrewSite[]; guards: CrewGuard[]; onSave: (h: Handover) => void }) {
  const [open, setOpen] = useState(false);
  const [siteId, setSiteId] = useState<string | null>(sites[0]?.id ?? null);
  const [priority, setPriority] = useState<HandoverPriority>("routine");
  const [error, setError] = useState<string | null>(null);
  const atSite = guards.filter((g) => g.site_id === siteId);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><PenLine data-icon="inline-start" /> Write a handover</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Write a handover</DialogTitle>
          <DialogDescription>Guards write these in the app at checkout. Supervisors can add one here for a post.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          action={(form) => {
            const note = String(form.get("note") ?? "").trim();
            const site = sites.find((s) => s.id === siteId);
            const from = guards.find((g) => g.id === form.get("from"));
            if (!site || !from) return setError("Pick the site and the outgoing guard.");
            if (note.length < 5) return setError("Write what the next shift needs to know.");
            setError(null);
            onSave({ id: `ho-new-${Date.now()}`, site, from, to: null, at: new Date().toISOString(), priority, note, items: [], read_at: null });
            setOpen(false);
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label htmlFor="ho-site">Site</Label>
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger id="ho-site" className="w-full" aria-label="Site"><SelectValue placeholder="Site" /></SelectTrigger>
                <SelectContent>{sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field>
              <Label htmlFor="ho-from">Outgoing guard</Label>
              <Select name="from" key={siteId}>
                <SelectTrigger id="ho-from" className="w-full" aria-label="Outgoing guard"><SelectValue placeholder="Guard" /></SelectTrigger>
                <SelectContent>{atSite.map((g) => <SelectItem key={g.id} value={g.id}>{g.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field>
            <Label>Priority</Label>
            <ToggleGroup value={[priority]} onValueChange={(v) => v[0] && setPriority(v[0] as HandoverPriority)} variant="outline" size="sm" aria-label="Priority">
              {(Object.keys(PRIORITY) as HandoverPriority[]).map((p) => <ToggleGroupItem key={p} value={p}>{PRIORITY[p].label}</ToggleGroupItem>)}
            </ToggleGroup>
          </Field>
          <Field>
            <Label htmlFor="ho-note">Note for the next shift</Label>
            <Textarea id="ho-note" name="note" rows={4} placeholder="Open issues, things to watch, what was handed over" />
          </Field>
          {error && <p role="alert" className="text-sm text-absent">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Log handover</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
