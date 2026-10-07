"use client";

import { useMemo, useState } from "react";
import { BellRing, Camera, ScanFace, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Section } from "@/components/gf/section";
import { StatTile } from "@/components/gf/stat-tile";
import { StatusPill, ToneDot } from "@/components/gf/status-pill";
import { Mono } from "@/components/gf/mono";
import { EmptyState } from "@/components/gf/empty-state";
import { GuardCell } from "./guard-cell";
import { fmtDate, fmtSeconds, fmtTime } from "@/lib/domain/format";
import {
  DEFAULT_ALERTNESS_POLICY, checkStatus, median, nightlySummary, repeatOffenders,
  type AlertCheck, type AlertnessPolicy, type CheckStatus,
} from "@/lib/preview/alertness";
import type { CrewGuard } from "@/lib/preview/crew";
import type { Tone } from "@/lib/domain/status";

const STATUS: Record<CheckStatus, { label: string; tone: Tone }> = {
  on_time: { label: "On time", tone: "present" },
  late: { label: "Late", tone: "half-day" },
  missed: { label: "Missed", tone: "absent" },
};

const pad = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function AlertnessBoard({ checks: generated, guards, canConfigure }: { checks: AlertCheck[]; guards: CrewGuard[]; canConfigure: boolean }) {
  const [policy, setPolicy] = useState<AlertnessPolicy>(DEFAULT_ALERTNESS_POLICY);
  // Re-grade against the policy on screen, so the tiles always match the window shown.
  const checks = useMemo(() => generated.map((c) => ({ ...c, status: checkStatus(c.response_s, policy) })), [generated, policy]);
  const nights = nightlySummary(checks);
  const lastNight = nights.at(-1)?.night;
  const last = checks.filter((c) => c.night === lastNight);
  const answered = last.filter((c) => c.response_s != null);
  const onTimePct = last.length ? Math.round((100 * last.filter((c) => c.status === "on_time").length) / last.length) : null;
  const missed = last.filter((c) => c.status === "missed").length;
  const med = median(answered.map((c) => c.response_s!));
  const worst = repeatOffenders(checks);
  const maxNight = Math.max(1, ...nights.map((n) => n.on_time + n.late + n.missed));

  function update(patch: Partial<AlertnessPolicy>) {
    setPolicy((p) => ({ ...p, ...patch }));
    toast.success("Alertness policy updated", { description: "Preview only — not saved." });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile label="Checks last night" value={last.length} hint={`${new Set(last.map((c) => c.guard.id)).size} guards on night duty`} style={{ ["--i" as string]: 1 }} />
        <StatTile label="Answered on time" value={onTimePct == null ? "—" : `${onTimePct}%`} tone={onTimePct != null && onTimePct < 85 ? "half-day" : "present"} hint={`within ${policy.respond_within_s / 60} min`} style={{ ["--i" as string]: 2 }} />
        <StatTile label="Missed" value={missed} tone={missed ? "absent" : "neutral"} hint="escalated to a supervisor" style={{ ["--i" as string]: 3 }} />
        <StatTile label="Median response" value={med == null ? "—" : fmtSeconds(med)} hint="ring to selfie" style={{ ["--i" as string]: 4 }} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Section
          title={lastNight ? `Last night · ${fmtDate(`${lastNight}T12:00:00+05:30`, undefined, "EEE d MMM")}` : "Last night"}
          description="Every check sent, latest first"
          bodyClassName="p-0"
          actions={<SendCheckDialog guards={guards} escalateMin={policy.escalate_after_s / 60} />}
          className="xl:self-start"
          style={{ ["--i" as string]: 5 }}
        >
          {last.length === 0 ? (
            <EmptyState title="No checks last night" description="Checks are sent to guards on night shifts once the policy is on." className="m-4" />
          ) : (
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full text-sm" aria-label="Last night's checks">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="eyebrow border-b text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                    <th className="min-w-[200px]">Guard</th>
                    <th>Rang</th>
                    <th>Answered</th>
                    <th>Selfie</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {last.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-muted/50">
                      <td className="px-4 py-2.5"><GuardCell guard={c.guard} sub={c.guard.site_name ?? undefined} /></td>
                      <td className="px-4 py-2.5"><Mono className="text-xs">{fmtTime(c.sent_at)}</Mono></td>
                      <td className="px-4 py-2.5">
                        {c.response_s == null ? <span className="text-xs text-muted-foreground">No answer</span> : (
                          <Mono className="text-xs whitespace-nowrap">{fmtTime(c.responded_at)} <span className="text-muted-foreground">· {fmtSeconds(c.response_s)}</span></Mono>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {c.face_match == null ? <span className="text-xs text-muted-foreground">—</span>
                          : c.face_match ? <StatusPill tone="neutral" size="xs" dot={false}><ScanFace className="size-3" /> Face matched</StatusPill>
                          : <StatusPill tone="half-day" size="xs" dot={false}><ScanFace className="size-3" /> No match</StatusPill>}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill tone={STATUS[c.status].tone} size="xs">{STATUS[c.status].label}</StatusPill>
                        {c.escalated_to && <div className="mt-1 text-[11px] text-muted-foreground">→ {c.escalated_to}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <div className="flex min-w-0 flex-col gap-4">
          <Section title="Last 7 nights" description="Checks per night by result" style={{ ["--i" as string]: 6 }}>
            <div className="flex h-36 items-end gap-2" role="img" aria-label="Checks per night, on time, late and missed">
              {nights.map((n) => {
                const total = n.on_time + n.late + n.missed;
                return (
                  <div key={n.night} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex w-full flex-col-reverse overflow-hidden rounded-sm" style={{ height: `${(total / maxNight) * 112}px` }} title={`${n.on_time} on time · ${n.late} late · ${n.missed} missed`}>
                      <div className="bg-present" style={{ flexGrow: n.on_time }} />
                      <div className="bg-half-day" style={{ flexGrow: n.late }} />
                      <div className="bg-absent" style={{ flexGrow: n.missed }} />
                    </div>
                    <Mono className="text-[10px] text-muted-foreground">{fmtDate(`${n.night}T12:00:00+05:30`, undefined, "EEE")}</Mono>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
              {(["on_time", "late", "missed"] as const).map((k) => (
                <span key={k} className="flex items-center gap-1.5"><ToneDot tone={STATUS[k].tone} />{STATUS[k].label}</span>
              ))}
            </div>
          </Section>

          <Section title="Repeat misses, 7 nights" description="Who to talk to first" bodyClassName="p-0" style={{ ["--i" as string]: 7 }}>
            {worst.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Everyone answered.</p> : (
              <ul className="divide-y">
                {worst.map((w) => (
                  <li key={w.guard.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <GuardCell guard={w.guard} sub={`${w.total} checks`} />
                    <div className="flex shrink-0 gap-1.5">
                      {w.missed > 0 && <StatusPill tone="absent" size="xs">{w.missed} missed</StatusPill>}
                      {w.late > 0 && <StatusPill tone="half-day" size="xs">{w.late} late</StatusPill>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Policy" description="Applies to every night shift" style={{ ["--i" as string]: 8 }}>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="al-on">Random checks on night shifts</Label>
                <Switch id="al-on" checked={policy.enabled} disabled={!canConfigure} onCheckedChange={(v) => update({ enabled: v })} />
              </div>
              <PolicySelect label="Checks per night" value={String(policy.checks_per_night)} options={["1", "2", "3", "4", "6"]} disabled={!canConfigure || !policy.enabled}
                onChange={(v) => update({ checks_per_night: Number(v) })} />
              <PolicySelect label="Guard must answer within" value={String(policy.respond_within_s)} disabled={!canConfigure || !policy.enabled}
                options={["120", "300", "600"]} format={(v) => `${Number(v) / 60} minutes`} onChange={(v) => update({ respond_within_s: Number(v) })} />
              <p className="text-xs text-muted-foreground">
                Rings between <Mono className="text-xs">{pad(policy.window_start_h)}</Mono> and <Mono className="text-xs">{pad(policy.window_end_h)}</Mono>. Unanswered after {policy.escalate_after_s / 60} minutes, the site supervisor gets a call.
              </p>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

function PolicySelect({ label, value, options, onChange, format = (v) => v, disabled }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; format?: (v: string) => string; disabled?: boolean;
}) {
  const id = `al-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(v) => v && onChange(v)} disabled={disabled}>
        <SelectTrigger id={id} className="w-36" aria-label={label}><SelectValue>{format(value)}</SelectValue></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{format(o)}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function SendCheckDialog({ guards, escalateMin }: { guards: CrewGuard[]; escalateMin: number }) {
  const [open, setOpen] = useState(false);
  const [guard, setGuard] = useState<string | null>(null);
  const chosen = guards.find((g) => g.id === guard);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline"><BellRing data-icon="inline-start" /> Ring a guard now</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ring a guard now</DialogTitle>
          <DialogDescription>Sends an alertness check outside the random schedule — for when a client calls in a doubt.</DialogDescription>
        </DialogHeader>
        <Field>
          <Label htmlFor="al-guard">Guard</Label>
          <Select value={guard} onValueChange={setGuard}>
            <SelectTrigger id="al-guard" className="w-full" aria-label="Guard"><SelectValue placeholder="Choose a guard…" /></SelectTrigger>
            <SelectContent>{guards.map((g) => <SelectItem key={g.id} value={g.id}>{g.full_name}{g.site_name ? ` — ${g.site_name}` : ""}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Camera className="mt-px size-3.5 shrink-0" /> The phone rings at full volume until the guard takes a selfie. <TriangleAlert className="mt-px size-3.5 shrink-0" /> No answer in {escalateMin} minutes calls the supervisor.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!chosen} onClick={() => { setOpen(false); toast.success(`Ringing ${chosen?.full_name}`, { description: "Preview only — nothing was sent." }); }}>
            <BellRing data-icon="inline-start" /> Ring now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
