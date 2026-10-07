"use client";

import { useState } from "react";
import { CalendarClock, Mail, MailCheck, MailX, Send, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Section } from "@/components/gf/section";
import { StatTile } from "@/components/gf/stat-tile";
import { StatusPill } from "@/components/gf/status-pill";
import { Mono } from "@/components/gf/mono";
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/domain/format";
import type { ClientAccount, DarSite, DeliveryStatus, SentReport } from "@/lib/preview/client-reports";
import type { Tone } from "@/lib/domain/status";
import { cn } from "cn";

const DELIVERY: Record<DeliveryStatus, { label: string; tone: Tone; icon: typeof Mail }> = {
  opened: { label: "Opened", tone: "present", icon: MailCheck },
  delivered: { label: "Delivered", tone: "neutral", icon: Mail },
  bounced: { label: "Bounced", tone: "absent", icon: MailX },
};

export function ClientReportsBoard({ accounts: initial, reports, log, date, agencyName, canEdit }: {
  accounts: ClientAccount[]; reports: Record<string, DarSite[]>; log: SentReport[]; date: string; agencyName: string; canEdit: boolean;
}) {
  const [accounts, setAccounts] = useState(initial);
  const [key, setKey] = useState(initial[0]!.key);
  const [editing, setEditing] = useState<ClientAccount | null>(null);
  const account = accounts.find((a) => a.key === key)!;
  const dar = reports[key] ?? [];
  const openRate = log.length ? Math.round((100 * log.filter((l) => l.status === "opened").length) / log.length) : null;
  const bounced = log.filter((l) => l.status === "bounced").length;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile label="Clients receiving" value={`${accounts.filter((a) => a.enabled).length}/${accounts.length}`} hint="daily report switched on" style={{ ["--i" as string]: 1 }} />
        <StatTile label="Sent, 7 days" value={log.length} hint={`to ${accounts.filter((a) => a.enabled).length} clients`} style={{ ["--i" as string]: 2 }} />
        <StatTile label="Open rate" value={openRate == null ? "—" : `${openRate}%`} tone="present" hint="clients actually read them" style={{ ["--i" as string]: 3 }} />
        <StatTile label="Bounced" value={bounced} tone={bounced ? "absent" : "neutral"} hint="fix the address" style={{ ["--i" as string]: 4 }} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 xl:self-start">
          <Section title="Clients" bodyClassName="p-1.5" style={{ ["--i" as string]: 5 }}>
            <ul className="flex flex-col gap-px" aria-label="Clients">
              {accounts.map((a) => (
                <li key={a.key}>
                  <button
                    type="button"
                    onClick={() => setKey(a.key)}
                    aria-current={a.key === key ? "true" : undefined}
                    className={cn("flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors", a.key === key ? "bg-muted font-medium" : "hover:bg-muted/60")}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{a.name}</span>
                      <span className="block text-xs font-normal text-muted-foreground">{a.sites.length} site{a.sites.length === 1 ? "" : "s"} · <Mono className="text-xs">{a.send_at}</Mono></span>
                    </span>
                    {a.enabled ? <StatusPill tone="present" size="xs">Daily</StatusPill> : <StatusPill tone="neutral" size="xs">Off</StatusPill>}
                  </button>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Delivery log" description="Last 7 days" bodyClassName="p-0" style={{ ["--i" as string]: 6 }}>
            <ul className="max-h-[360px] divide-y overflow-auto">
              {log.map((l) => {
                const d = DELIVERY[l.status];
                return (
                  <li key={l.id} className="flex items-center justify-between gap-2 px-4 py-2 text-xs">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{l.client}</span>
                      <span className="text-muted-foreground">for {fmtDate(`${l.date}T12:00:00+05:30`, undefined, "d MMM")} · sent {fmtDateTime(l.sent_at)}</span>
                    </span>
                    <StatusPill tone={d.tone} size="xs" dot={false}><d.icon className="size-3" /> {d.label}</StatusPill>
                  </li>
                );
              })}
            </ul>
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="reveal flex flex-wrap items-center justify-between gap-3" style={{ ["--i" as string]: 5 }}>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarClock className="size-4" />
              {account.enabled
                ? <>Goes to <span className="text-foreground">{account.recipients.join(", ")}</span> at <Mono>{account.send_at}</Mono> daily</>
                : <>Daily report is off for this client</>}
            </div>
            <div className="flex gap-2">
              {canEdit && <Button variant="outline" onClick={() => setEditing(account)}><Settings2 data-icon="inline-start" /> Schedule</Button>}
              <Button onClick={() => toast.success(`Report sent to ${account.recipients.length} recipient${account.recipients.length === 1 ? "" : "s"}`, { description: "Preview only — no email left." })}>
                <Send data-icon="inline-start" /> Send now
              </Button>
            </div>
          </div>
          <DarPreview account={account} sites={dar} date={date} agencyName={agencyName} />
        </div>
      </div>

      <ScheduleDialog
        account={editing}
        onClose={() => setEditing(null)}
        onSave={(a) => { setAccounts((xs) => xs.map((x) => (x.key === a.key ? a : x))); setEditing(null); toast.success(`Schedule for ${a.name} updated`, { description: "Preview only — not saved." }); }}
      />
    </>
  );
}

/** The email body, rendered as the client will see it. */
function DarPreview({ account, sites, date, agencyName }: { account: ClientAccount; sites: DarSite[]; date: string; agencyName: string }) {
  const posts = sites.reduce((n, s) => n + s.posts, 0);
  const present = sites.reduce((n, s) => n + s.present, 0);
  const incidents = sites.reduce((n, s) => n + s.incidents.length, 0);
  return (
    <article className="reveal overflow-hidden rounded-lg border bg-card shadow-sm" aria-label="Report preview" style={{ ["--i" as string]: 6 }}>
      <div className="flex items-center justify-between gap-3 border-b bg-sidebar px-6 py-4 text-sidebar-foreground">
        <div>
          <div className="eyebrow text-sidebar-foreground/60">Daily activity report</div>
          <div className="font-display text-xl font-semibold">{account.name}</div>
        </div>
        <div className="text-right text-xs text-sidebar-foreground/70">
          <div className="font-display text-sm font-semibold text-sidebar-foreground">{agencyName}</div>
          <Mono className="text-xs">{fmtDate(`${date}T12:00:00+05:30`, undefined, "EEEE d MMMM yyyy")}</Mono>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x border-b">
        {[
          ["Posts covered", `${present}/${posts}`],
          ["Patrol rounds", `${sites.reduce((n, s) => n + s.patrols_done, 0)}/${sites.reduce((n, s) => n + s.patrols_due, 0)}`],
          ["Incidents", String(incidents)],
        ].map(([k, v]) => (
          <div key={k} className="px-6 py-4">
            <div className="eyebrow">{k}</div>
            <div className="font-display text-2xl font-semibold tabular">{v}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-col divide-y">
        {sites.map((s) => (
          <section key={s.site.id} className="flex flex-col gap-4 px-6 py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-base font-semibold">{s.site.name}</h3>
              <div className="flex flex-wrap gap-1.5">
                <StatusPill tone={s.covered_pct === 100 ? "present" : "half-day"} size="xs">{s.covered_pct}% covered</StatusPill>
                {s.late > 0 && <StatusPill tone="half-day" size="xs" dot={false}>{s.late} late</StatusPill>}
                <StatusPill tone="neutral" size="xs" dot={false}>{s.checks_on_time}/{s.checks_total} alertness checks on time</StatusPill>
              </div>
            </div>
            {s.guards.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="eyebrow border-b text-left [&>th]:py-1.5 [&>th]:font-normal"><th>Guard on duty</th><th>In</th><th>Out</th></tr>
                </thead>
                <tbody className="divide-y">
                  {s.guards.map((g) => (
                    <tr key={g.guard.id}>
                      <td className="py-1.5">{g.guard.full_name}</td>
                      <td className="py-1.5"><Mono className="text-xs">{fmtTime(g.in)}</Mono></td>
                      <td className="py-1.5"><Mono className="text-xs">{fmtTime(g.out)}</Mono></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="text-sm">
              <div className="eyebrow mb-1">Incidents</div>
              {s.incidents.length === 0
                ? <p className="text-muted-foreground">Nothing to report.</p>
                : s.incidents.map((i) => <p key={i.at}><Mono className="mr-2 text-xs">{fmtTime(i.at)}</Mono>{i.title}</p>)}
            </div>
          </section>
        ))}
      </div>
      <div className="border-t px-6 py-3 text-[11px] text-muted-foreground">
        Every time above is from a GPS-verified check-in inside the site fence. Reply to this email to reach your account manager.
      </div>
    </article>
  );
}

function ScheduleDialog({ account, onClose, onSave }: { account: ClientAccount | null; onClose: () => void; onSave: (a: ClientAccount) => void }) {
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={account != null} onOpenChange={(o) => { if (o && account) setEnabled(account.enabled); if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Daily report for {account?.name}</DialogTitle>
          <DialogDescription>Sent every morning for the day before, covering all of this client’s sites.</DialogDescription>
        </DialogHeader>
        {account && (
          <form
            key={account.key}
            className="flex flex-col gap-4"
            action={(form) => {
              const recipients = String(form.get("recipients") ?? "").split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
              if (enabled && recipients.length === 0) return setError("Add at least one email address.");
              if (recipients.some((r) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r))) return setError("One of the addresses doesn’t look like an email.");
              setError(null);
              onSave({ ...account, enabled, recipients, send_at: String(form.get("send_at") || account.send_at) });
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="cr-on">Send daily</Label>
              <Switch id="cr-on" checked={enabled} onCheckedChange={setEnabled} />
            </div>
            <Field>
              <Label htmlFor="cr-to">Recipients</Label>
              <Textarea id="cr-to" name="recipients" rows={2} defaultValue={account.recipients.join(", ")} />
            </Field>
            <Field>
              <Label htmlFor="cr-at">Send at</Label>
              <Input id="cr-at" name="send_at" type="time" defaultValue={account.send_at} className="w-32" />
            </Field>
            {error && <p role="alert" className="text-sm text-absent">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit">Save schedule</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
