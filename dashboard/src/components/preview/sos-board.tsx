"use client";

import { useEffect, useState } from "react";
import { Check, MapPin, OctagonAlert, Phone, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Section } from "@/components/gf/section";
import { StatTile } from "@/components/gf/stat-tile";
import { StatusPill } from "@/components/gf/status-pill";
import { Mono } from "@/components/gf/mono";
import { EmptyState } from "@/components/gf/empty-state";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { GuardCell } from "./guard-cell";
import { fmtAgo, fmtDateTime, fmtSeconds, mapsUrl } from "@/lib/domain/format";
import { SOS_KIND, ackSeconds, timerState, type LoneWorker, type SosAlert } from "@/lib/preview/sos";
import { median } from "@/lib/preview/alertness";
import { cn } from "cn";

export function SosBoard({ initial, lone, now: serverNow, canRespond, responder }: {
  initial: SosAlert[]; lone: LoneWorker[]; now: string; canRespond: boolean; responder: string;
}) {
  const [alerts, setAlerts] = useState(initial);
  const [resolving, setResolving] = useState<SosAlert | null>(null);
  const [now, setNow] = useState(() => new Date(serverNow));
  useEffect(() => {
    // Durations render in whole minutes, so a 15-second tick is plenty.
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  const open = alerts.filter((a) => a.status !== "resolved");
  const handled = alerts.filter((a) => a.status === "resolved");
  const month = handled.filter((a) => now.getTime() - new Date(a.raised_at).getTime() < 30 * 864e5);
  const ackMed = median(handled.map(ackSeconds).filter((s): s is number => s != null));

  function acknowledge(a: SosAlert) {
    setAlerts((xs) => xs.map((x) => (x.id === a.id ? { ...x, status: "acknowledged", acknowledged_by: responder, acknowledged_at: new Date().toISOString() } : x)));
    toast.success(`You own ${a.guard.full_name}’s alert`, { description: "Preview only — the guard was not notified." });
  }
  function resolve(a: SosAlert, note: string) {
    setAlerts((xs) => xs.map((x) => (x.id === a.id ? { ...x, status: "resolved", resolved_at: new Date().toISOString(), note, acknowledged_by: x.acknowledged_by ?? responder, acknowledged_at: x.acknowledged_at ?? new Date().toISOString() } : x)));
    setResolving(null);
    toast.success("Alert closed", { description: "Preview only — not saved." });
  }

  return (
    <>
      {open.length > 0 ? (
        <div className="flex flex-col gap-3" aria-label="Open SOS alerts">
          {open.map((a, i) => (
            <div
              key={a.id}
              className={cn(
                "reveal flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border bg-card p-4",
                a.status === "active" ? "border-signal/60 shadow-[inset_3px_0_0_0_var(--signal)]" : "border-half-day/50",
              )}
              style={{ ["--i" as string]: i + 1 }}
            >
              <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", a.status === "active" ? "bg-signal text-signal-foreground" : "bg-half-day/20 text-half-day-foreground dark:text-half-day")}>
                <OctagonAlert className="size-5" />
              </div>
              <div className="min-w-[220px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-lg font-semibold">{SOS_KIND[a.kind].label}</span>
                  {a.status === "active"
                    ? <StatusPill tone="signal" pulse>Unanswered · <Mono className="text-xs">{fmtSeconds((now.getTime() - new Date(a.raised_at).getTime()) / 1000)}</Mono></StatusPill>
                    : <StatusPill tone="half-day">Owned by {a.acknowledged_by}</StatusPill>}
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm">
                  <GuardAvatar name={a.guard.full_name} size="xs" />
                  <span className="font-medium">{a.guard.full_name}</span>
                  <span className="text-muted-foreground">· {a.guard.site_name ?? "No site"} · raised {fmtAgo(a.raised_at)}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{SOS_KIND[a.kind].hint}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" nativeButton={false} render={<a href={mapsUrl(a.lat, a.lng) ?? "#"} target="_blank" rel="noreferrer" />}><MapPin data-icon="inline-start" /> Location</Button>
                <Button variant="outline" nativeButton={false} render={<a href={telHref(a.guard.phone)} />}><Phone data-icon="inline-start" /> Call guard</Button>
                {canRespond && a.status === "active" && <Button onClick={() => acknowledge(a)}>I’m on it</Button>}
                {canRespond && <Button variant={a.status === "active" ? "ghost" : "default"} onClick={() => setResolving(a)}><Check data-icon="inline-start" /> Close</Button>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="All clear" description="No open SOS alerts. A new one appears here and in the alerts bell, with a siren." icon={<OctagonAlert />} />
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile label="Open now" value={open.length} tone={open.length ? "signal" : "neutral"} hint={`${open.filter((a) => a.status === "active").length} with nobody on it`} style={{ ["--i" as string]: 3 }} />
        <StatTile label="Last 30 days" value={month.length} hint={`${month.filter((a) => a.kind === "man_down").length} man-down`} style={{ ["--i" as string]: 4 }} />
        <StatTile label="Median time to answer" value={ackMed == null ? "—" : fmtSeconds(ackMed)} hint="raise to “I’m on it”" style={{ ["--i" as string]: 5 }} />
        <StatTile label="Lone workers on shift" value={lone.length} hint="on a 30-minute check-in timer" style={{ ["--i" as string]: 6 }} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)]">
        <Section title="Lone-worker timers" description="Guard taps “I’m OK” every 30 min; a lapse raises an SOS" bodyClassName="p-0" style={{ ["--i" as string]: 7 }}>
          {lone.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nobody is on a single-guard post right now.</p> : (
            <ul className="divide-y">
              {lone
                .map((w) => ({ w, t: timerState(w, now) }))
                .sort((a, b) => a.t.remaining_s - b.t.remaining_s)
                .map(({ w, t }) => (
                  <li key={w.guard.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <GuardCell guard={w.guard} sub={`tapped ${fmtAgo(w.last_tap_at)}`} />
                    <StatusPill tone={t.state === "ok" ? "present" : t.state === "due" ? "half-day" : "signal"} size="xs" pulse={t.state === "lapsed"}>
                      <Timer className="size-3" />
                      <Mono className="text-[11px]">{t.state === "lapsed" ? `lapsed ${fmtSeconds(-t.remaining_s)}` : `${fmtSeconds(t.remaining_s)} left`}</Mono>
                    </StatusPill>
                  </li>
                ))}
            </ul>
          )}
        </Section>

        <Section title="Handled" description="Closed alerts, newest first, with what happened" bodyClassName="p-0" style={{ ["--i" as string]: 8 }}>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-sm" aria-label="Handled SOS alerts">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="eyebrow border-b text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                  <th className="min-w-[170px]">Guard</th>
                  <th>Type</th>
                  <th>Raised</th>
                  <th className="whitespace-nowrap">Answered</th>
                  <th className="min-w-[200px]">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...handled].sort((a, b) => b.raised_at.localeCompare(a.raised_at)).map((a) => (
                  <tr key={a.id} className="transition-colors hover:bg-muted/50">
                    <td className="px-4 py-2.5"><GuardCell guard={a.guard} /></td>
                    <td className="px-4 py-2.5"><StatusPill tone={a.kind === "man_down" ? "absent" : "neutral"} size="xs" dot={false}>{SOS_KIND[a.kind].label}</StatusPill></td>
                    <td className="px-4 py-2.5 whitespace-nowrap"><Mono className="text-xs">{fmtDateTime(a.raised_at)}</Mono></td>
                    <td className="px-4 py-2.5"><Mono className="text-xs">{fmtSeconds(ackSeconds(a))}</Mono></td>
                    <td className="px-4 py-2.5 text-xs">
                      <div>{a.note}</div>
                      <div className="text-muted-foreground">by {a.acknowledged_by}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <ResolveDialog alert={resolving} onClose={() => setResolving(null)} onResolve={resolve} />
    </>
  );
}

/** Guard phones are stored as 10-digit Indian numbers or with the 91 prefix. */
export function telHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `tel:+${digits.length === 10 ? `91${digits}` : digits}`;
}

function ResolveDialog({ alert, onClose, onResolve }: { alert: SosAlert | null; onClose: () => void; onResolve: (a: SosAlert, note: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={alert != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Close this alert</DialogTitle>
          <DialogDescription>Write what happened. It goes on {alert?.guard.full_name ?? "the guard"}’s record and into the client’s daily report.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          action={(form) => {
            const note = String(form.get("note") ?? "").trim();
            if (note.length < 5) return setError("Write a line on what happened.");
            setError(null);
            if (alert) onResolve(alert, note);
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="sos-note">What happened</Label>
            <Textarea id="sos-note" name="note" rows={3} placeholder="e.g. False alarm — guard pressed while cleaning the phone" />
          </div>
          {error && <p role="alert" className="text-sm text-absent">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit"><Check data-icon="inline-start" /> Close alert</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
