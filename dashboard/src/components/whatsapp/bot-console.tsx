"use client";

import { useState } from "react";
import {
  BadgeCheck, Camera, CheckCircle2, Coffee, MessageCircle, Phone, PhoneCall, Send, Settings2, ShieldCheck, Siren, UserX, Users, Webhook,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/gf/stat-tile";
import { StatusPill } from "@/components/gf/status-pill";
import { Section } from "@/components/gf/section";
import { Mono } from "@/components/gf/mono";
import { GuardAvatar } from "@/components/gf/guard-avatar";
import { PhoneFrame, type PhoneLine } from "@/components/campus/phone-frame";
import { BotSimulator } from "./bot-simulator";
import { TemplateStudio } from "./template-studio";
import { alertText, BOT, BOT_DEFAULTS, BOT_KIND, fmtWaPhone, type BotAlert, type BotKind } from "@/lib/whatsapp/bot";
import { RULES, RUNG_LABEL, TRIGGERS, type AlertRule } from "@/lib/whatsapp/rules";
import { LANG_LABEL, TEMPLATES } from "@/lib/whatsapp/templates";
import { deliveryStats, sessionOpen, threadFor, type Delivery, type WaContact, type WaMessage } from "@/lib/whatsapp/messages";
import { fmtAgo, fmtDateTime, fmtTime } from "@/lib/domain/format";
import { cn } from "cn";

const KIND_ICON: Record<BotKind, typeof Siren> = { absent_rollcall: UserX, incident: Siren, incident_report: Camera, long_break: Coffee, missing: PhoneCall };
const KIND_ICON_CLASS: Record<BotKind, string> = { absent_rollcall: "text-half-day-foreground dark:text-half-day", incident: "text-signal", incident_report: "text-on-leave", long_break: "text-half-day-foreground dark:text-half-day", missing: "text-absent" };
const STATE: Record<BotAlert["state"], { label: string; tone: "present" | "half-day" | "absent" | "neutral" | "on-leave" }> = {
  delivered: { label: "Delivered", tone: "neutral" }, read: { label: "Read, no reply", tone: "half-day" }, acknowledged: { label: "Acknowledged", tone: "present" }, escalated: { label: "Escalated", tone: "absent" },
};
const TICKS: Record<Delivery, { text: string; className: string; label: string }> = {
  queued: { text: "◷", className: "text-muted-foreground", label: "Queued" },
  sent: { text: "✓", className: "text-muted-foreground", label: "Sent" },
  delivered: { text: "✓✓", className: "text-muted-foreground", label: "Delivered" },
  read: { text: "✓✓", className: "text-on-leave", label: "Read" },
  failed: { text: "!", className: "text-absent", label: "Failed" },
};

export function BotConsole({ alerts: initial, contacts: initialContacts, messages, now, canAck, canManage, agencyName }: {
  alerts: BotAlert[]; contacts: WaContact[]; messages: WaMessage[]; now: string; canAck: boolean; canManage: boolean; agencyName: string;
}) {
  const [alerts, setAlerts] = useState(initial);
  const [selected, setSelected] = useState(initial[0]?.id ?? null);
  const [kind, setKind] = useState<BotKind | "all">("all");
  const [contacts, setContacts] = useState(initialContacts);
  const [rules, setRules] = useState(RULES);
  const [thresholds, setThresholds] = useState({ ...BOT_DEFAULTS, rollcall_after_min: 15 });
  const [thread, setThread] = useState<WaContact | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const stats = deliveryStats(messages);
  const shown = alerts.filter((a) => kind === "all" || a.kind === kind);
  const current = alerts.find((a) => a.id === selected) ?? shown[0] ?? null;
  const acked = alerts.filter((a) => a.state === "acknowledged").length;
  const nowD = new Date(now);

  function acknowledge(a: BotAlert, text: string, by: string) {
    setAlerts((xs) => xs.map((x) => (x.id === a.id ? { ...x, state: "acknowledged", ack: { by, text, at: new Date().toISOString() } } : x)));
    toast.success(`${by} replied “${text}”`, { description: "The escalation ladder stopped. Logged against the alert." });
  }

  return (
    <>
      {/* Bot identity strip */}
      <div className="reveal flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border bg-card px-4 py-3" style={{ ["--i" as string]: 1 }}>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-[#25d366] text-white"><MessageCircle className="size-5" /></span>
          <div>
            <div className="flex items-center gap-1.5 font-display text-base font-semibold">{BOT.name} <BadgeCheck className="size-4 fill-[#25d366] text-white" aria-label="Verified business" /></div>
            <Mono className="text-xs text-muted-foreground">{BOT.number} · one number for every guard and supervisor</Mono>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="present" pulse>Connected</StatusPill>
          <StatusPill tone="present" dot={false}>Quality {BOT.quality}</StatusPill>
          <StatusPill tone="neutral" dot={false}>{BOT.tier}</StatusPill>
        </div>
        {canManage && <Button size="sm" variant="outline" className="sm:ml-auto" onClick={() => setTestOpen(true)}><Send data-icon="inline-start" /> Send a test</Button>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Alerts, last 24 h" value={alerts.length} hint={`${alerts.filter((a) => a.source === "live").length} from your live data`} style={{ ["--i" as string]: 2 }} />
        <StatTile label="Acknowledged" value={`${acked}/${alerts.length}`} tone={acked === alerts.length ? "present" : "half-day"} hint={`${alerts.filter((a) => a.state === "escalated").length} escalated up the ladder`} style={{ ["--i" as string]: 3 }} />
        <StatTile label="Delivered" value={`${stats.deliveredPct}%`} hint={`${stats.failed} failed · ${stats.sms} sent by SMS instead`} style={{ ["--i" as string]: 4 }} />
        <StatTile label="Read" value={`${stats.readPct}%`} hint={`${stats.repliedPct}% replied with a button`} style={{ ["--i" as string]: 5 }} />
        <StatTile label="Median reply" value={stats.medianReplyMin == null ? "—" : `${stats.medianReplyMin} min`} tone="olive" hint="From send to a button tap" style={{ ["--i" as string]: 6 }} />
      </div>

      <Tabs defaultValue="alerts" className="reveal gap-4" style={{ ["--i" as string]: 7 }}>
        <TabsList className="h-9 flex-wrap">
          <TabsTrigger value="alerts" className="px-3">Live alerts</TabsTrigger>
          <TabsTrigger value="simulate" className="px-3">Try a flow</TabsTrigger>
          <TabsTrigger value="rules" className="px-3">Alert rules</TabsTrigger>
          <TabsTrigger value="templates" className="px-3">Templates</TabsTrigger>
          <TabsTrigger value="log" className="px-3">Delivery log</TabsTrigger>
          <TabsTrigger value="people" className="px-3">Recipients</TabsTrigger>
          <TabsTrigger value="setup" className="px-3">Setup</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------ live */}
        <TabsContent value="alerts" className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5" role="group" aria-label="Alert kinds">
            {(["absent_rollcall", "incident", "missing", "long_break", "incident_report"] as BotKind[]).map((k) => {
              const Icon = KIND_ICON[k];
              const n = alerts.filter((a) => a.kind === k).length;
              const on = kind === k;
              return (
                <button key={k} type="button" aria-pressed={on} onClick={() => setKind(on ? "all" : k)} className={cn("flex items-start gap-2.5 rounded-lg border bg-card p-3 text-left transition-colors", on ? "border-primary/60 bg-primary/5" : "hover:bg-muted/50")}>
                  <Icon className={cn("mt-0.5 size-4 shrink-0", KIND_ICON_CLASS[k])} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{BOT_KIND[k].label} <Mono className="text-xs text-muted-foreground">{n}</Mono></span>
                    <span className="block text-xs text-muted-foreground">to {BOT_KIND[k].to}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <ul className="flex min-w-0 flex-col gap-2" aria-label="Bot alerts">
              {shown.map((a) => {
                const Icon = KIND_ICON[a.kind];
                const isSel = current?.id === a.id;
                return (
                  <li key={a.id}>
                    <div
                      role="button" tabIndex={0} onClick={() => setSelected(a.id)} onKeyDown={(e) => e.key === "Enter" && setSelected(a.id)}
                      className={cn("flex flex-col gap-2 rounded-lg border bg-card p-3.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50", isSel ? "border-primary/50 shadow-[inset_3px_0_0_0_var(--primary)]" : "hover:bg-muted/40")}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Icon className="size-4 text-muted-foreground" />
                        <span className="font-medium">{BOT_KIND[a.kind].label}</span>
                        <span className="text-sm text-muted-foreground">· {a.site}</span>
                        {a.severity && <StatusPill tone={a.severity === "critical" || a.severity === "high" ? "absent" : "half-day"} size="xs" dot={false}>{a.severity}</StatusPill>}
                        <span className="ml-auto flex items-center gap-2">
                          {a.source === "sample" && <StatusPill tone="neutral" size="xs" dot={false}>Sample</StatusPill>}
                          <StatusPill tone={STATE[a.state].tone} size="xs" pulse={a.state === "escalated"}>{STATE[a.state].label}</StatusPill>
                          <Mono className="text-xs text-muted-foreground">{fmtDateTime(a.at)}</Mono>
                        </span>
                      </div>
                      <div className="text-sm">{a.subject ? <><span className="font-medium">{a.subject.name}</span> — </> : null}{a.detail}</div>
                      {a.people && (
                        <ul className="flex flex-wrap gap-2" aria-label="Absent guards">
                          {a.people.map((p) => (
                            <li key={p.name} className="flex items-center gap-2 rounded-md border bg-muted/30 py-1 pr-1 pl-2 text-xs">
                              <GuardAvatar name={p.name} size="xs" /> <span className="font-medium">{p.name}</span> <Mono className="text-xs">{fmtWaPhone(p.phone)}</Mono>
                              {p.phone && <Button size="xs" variant="ghost" nativeButton={false} render={<a href={`tel:+${p.phone.replace(/\D/g, "")}`} onClick={(e) => e.stopPropagation()} />} aria-label={`Call ${p.name}`}><Phone /></Button>}
                            </li>
                          ))}
                        </ul>
                      )}
                      {a.image && <img src={a.image} alt={`Photo from the ${a.site} incident`} className="h-24 w-36 rounded-md border object-cover" />}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>To {a.recipients.map((r) => `${r.name}${r.phone ? ` (${fmtWaPhone(r.phone)})` : ""}`).join(", ")}</span>
                        {a.ack && <span className="text-present">✓ {a.ack.by}: “{a.ack.text}” · {fmtTime(a.ack.at)}</span>}
                        {a.subject?.phone && <a href={`tel:+${a.subject.phone.replace(/\D/g, "")}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"><Phone className="size-3" /> Call {a.subject.name.split(" ")[0]}</a>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col items-center gap-2 xl:sticky xl:top-20 xl:self-start">
              {current ? <>
                <span className="eyebrow">What {current.recipients[0]!.name.split(" ")[0]} sees</span>
                <PhoneFrame
                  title={BOT.name}
                  label="Alert on WhatsApp"
                  lines={alertLines(current)}
                  onReply={canAck ? (text) => current.state !== "acknowledged" && acknowledge(current, text, current.recipients[0]!.name) : undefined}
                />
                <p className="max-w-[300px] text-center text-xs text-muted-foreground">Tap a reply to play the recipient; the alert is acknowledged and the ladder stops.</p>
              </> : <p className="text-sm text-muted-foreground">No alerts.</p>}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="simulate"><BotSimulator /></TabsContent>

        {/* ----------------------------------------------------------- rules */}
        <TabsContent value="rules" className="flex flex-col gap-4">
          <Section title="Thresholds" description="When the bot decides something is wrong" style={{ ["--i" as string]: 0 }}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {([
                ["rollcall_after_min", "Roll-call after shift start", "min"],
                ["break_allowed_min", "Break allowed", "min"],
                ["missing_after_min", "Missing when not seen for", "min"],
                ["outside_far_m", "Or this far outside the fence", "m"],
              ] as const).map(([k, label, unit]) => (
                <div key={k} className="flex flex-col gap-1.5">
                  <Label htmlFor={`th-${k}`}>{label}</Label>
                  <div className="flex items-center gap-2"><Input id={`th-${k}`} type="number" min={1} disabled={!canManage} value={thresholds[k]} onChange={(e) => setThresholds((t) => ({ ...t, [k]: Number(e.target.value) }))} className="w-24 font-mono" /><span className="text-sm text-muted-foreground">{unit}</span></div>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Rules" description="Which event sends which template to whom, and who hears next if nobody answers" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Alert rules">
                <thead><tr className="eyebrow border-b text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-normal"><th>On</th><th className="min-w-[200px]">When</th><th className="min-w-[280px]">Who hears, in order</th><th>Quiet hours</th><th>SMS backup</th><th className="text-right">7 days</th></tr></thead>
                <tbody className="divide-y">
                  {rules.map((r) => <RuleRow key={r.id} r={r} canManage={canManage} onChange={(nr) => setRules((xs) => xs.map((x) => (x.id === nr.id ? nr : x)))} />)}
                </tbody>
              </table>
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="templates"><TemplateStudio initial={TEMPLATES} /></TabsContent>

        {/* ------------------------------------------------------------- log */}
        <TabsContent value="log">
          <Section title="Delivery log" description="Every message the bot sent, what WhatsApp reported back, and the reply" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Delivery log">
                <thead><tr className="eyebrow border-b text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-normal"><th>Sent</th><th>To</th><th>Alert</th><th className="min-w-[260px]">Message</th><th>Status</th><th>Reply</th></tr></thead>
                <tbody className="divide-y">
                  {messages.map((m) => {
                    const c = contacts.find((x) => x.id === m.contact_id)!;
                    const tk = TICKS[m.status];
                    return (
                      <tr key={m.id} className="cursor-pointer align-top hover:bg-muted/50" onClick={() => setThread(c)}>
                        <td className="px-3 py-2"><Mono className="text-xs">{fmtDateTime(m.sent_at)}</Mono></td>
                        <td className="px-3 py-2"><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground capitalize">{c.role}</div></td>
                        <td className="px-3 py-2 text-xs">{TRIGGERS[m.trigger].label}</td>
                        <td className="max-w-[360px] px-3 py-2 text-xs text-muted-foreground"><span className="line-clamp-2">{m.body}</span></td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap">
                          <span className={cn("font-mono font-semibold", tk.className)} aria-label={tk.label}>{tk.text}</span> {tk.label}
                          {m.failure && <div className="text-absent">{m.failure}</div>}
                          {m.via_sms && <div className="text-muted-foreground">→ sent by SMS</div>}
                        </td>
                        <td className="px-3 py-2 text-xs">{m.reply ? <span className="text-present">“{m.reply.text}” <span className="text-muted-foreground">{fmtTime(m.reply.at)}</span></span> : m.escalated ? <span className="text-absent">No reply → escalated</span> : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </TabsContent>

        {/* ---------------------------------------------------------- people */}
        <TabsContent value="people" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusPill tone="present">{contacts.filter((c) => c.opted_in).length} opted in</StatusPill>
            <StatusPill tone="half-day">{contacts.filter((c) => !c.opted_in).length} not yet</StatusPill>
            <span className="text-muted-foreground">WhatsApp needs each person’s consent first. Guards give it in the app or on the joining form.</span>
            {canManage && contacts.some((c) => !c.opted_in) && <Button size="sm" className="ml-auto" onClick={() => toast.success(`Opt-in request sent to ${contacts.filter((c) => !c.opted_in).length} guards by SMS`, { description: "They reply START (or tap the link) to begin getting alerts on WhatsApp." })}><Users data-icon="inline-start" /> Ask the rest to opt in</Button>}
          </div>
          <Section bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Recipients">
                <thead><tr className="eyebrow border-b text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-normal"><th>Person</th><th>WhatsApp number</th><th>Language</th><th>Opted in</th><th>24-h window</th><th className="text-right">Alerts</th></tr></thead>
                <tbody className="divide-y">
                  {contacts.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/50">
                      <td className="px-3 py-2"><div className="flex items-center gap-2.5"><GuardAvatar name={c.name} size="sm" /><div><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground capitalize">{c.role}{c.site ? ` · ${c.site}` : ""}</div></div></div></td>
                      <td className="px-3 py-2"><Mono className="text-xs">{fmtWaPhone(c.phone)}</Mono></td>
                      <td className="px-3 py-2 text-xs">{LANG_LABEL[c.language]}</td>
                      <td className="px-3 py-2 text-xs">{c.opted_in ? <><span className="text-present">Yes</span> <span className="text-muted-foreground">· {c.opt_in_source}, {c.opted_in_at ? fmtAgo(c.opted_in_at) : ""}</span></> : <span className="text-half-day-foreground dark:text-half-day">Not yet</span>}</td>
                      <td className="px-3 py-2 text-xs">{sessionOpen(c, nowD) ? <StatusPill tone="present" size="xs">Open · free text OK</StatusPill> : <StatusPill tone="neutral" size="xs" dot={false}>Templates only</StatusPill>}</td>
                      <td className="px-3 py-2 text-right"><Switch disabled={!canManage} checked={c.opted_in} onCheckedChange={(v) => setContacts((xs) => xs.map((x) => (x.id === c.id ? { ...x, opted_in: v, opted_in_at: v ? new Date().toISOString() : null, opt_in_source: v ? "reply START" : null } : x)))} aria-label={`Alerts for ${c.name}`} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </TabsContent>

        {/* ----------------------------------------------------------- setup */}
        <TabsContent value="setup">
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Connection" description="WhatsApp Business Platform (Cloud API), through your Meta Business account">
              <ol className="flex flex-col gap-3" aria-label="Setup steps">
                {[
                  { icon: ShieldCheck, title: "Meta Business account verified", sub: agencyName },
                  { icon: Phone, title: "Phone number registered", sub: `${BOT.number} · verified by OTP · not used on the WhatsApp app` },
                  { icon: BadgeCheck, title: "Display name approved", sub: BOT.name },
                  { icon: MessageCircle, title: "Templates approved", sub: `${TEMPLATES.filter((t) => t.status === "approved").length} approved, ${TEMPLATES.filter((t) => t.status === "pending").length} in review` },
                  { icon: Webhook, title: "Webhook receiving replies", sub: "Last event 14 s ago · delivery receipts and button taps" },
                ].map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-4 text-present" />
                    <div><div className="flex items-center gap-1.5 text-sm font-medium"><s.icon className="size-3.5 text-muted-foreground" /> {s.title}</div><div className="text-xs text-muted-foreground">{s.sub}</div></div>
                  </li>
                ))}
              </ol>
            </Section>
            <Section title="Limits & cost" description="What Meta allows and charges">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Messaging tier</dt><dd>{BOT.tier}</dd>
                <dt className="text-muted-foreground">Quality rating</dt><dd className="text-present">{BOT.quality}</dd>
                <dt className="text-muted-foreground">Utility message</dt><dd><Mono>≈ ₹0.12</Mono> each (India)</dd>
                <dt className="text-muted-foreground">Replies within 24 h</dt><dd>Free</dd>
                <dt className="text-muted-foreground">Last 7 days</dt><dd><Mono>{rules.reduce((a, r) => a + r.sent_7d, 0)}</Mono> alerts · <Mono>≈ ₹{Math.round(rules.reduce((a, r) => a + r.sent_7d, 0) * 0.115)}</Mono></dd>
                <dt className="text-muted-foreground">If WhatsApp fails</dt><dd>Same text by SMS</dd>
              </dl>
              {canManage && <Button variant="outline" size="sm" className="mt-4" onClick={() => toast.info("Reconnect opens Meta's embedded signup in a pop-up", { description: "Preview only — the current connection stays as it is." })}><Settings2 data-icon="inline-start" /> Reconnect number</Button>}
            </Section>
          </div>
        </TabsContent>
      </Tabs>

      <ThreadDialog contact={thread} messages={messages} onClose={() => setThread(null)} />
      <TestDialog open={testOpen} onOpenChange={setTestOpen} contacts={contacts} />
    </>
  );
}

function alertLines(a: BotAlert): PhoneLine[] {
  const t = TEMPLATES.find((x) => x.id === a.template_id)!;
  const lines: PhoneLine[] = [{
    id: a.id, from: "us", header: t.header_type === "image" ? null : t.header, image: a.image, text: alertText(a), footer: t.footer, time: fmtTime(a.at),
    buttons: t.buttons.map((b) => ({ kind: b.type === "quick_reply" ? "reply" : b.type === "url" ? "url" : "call", text: b.text })), spent: a.state === "acknowledged",
  }];
  if (a.ack) {
    lines.push({ id: `${a.id}-r`, from: "them", text: a.ack.text, time: fmtTime(a.ack.at), read: true });
    lines.push({ id: `${a.id}-ok`, from: "us", text: "Thanks — logged. Nobody else will be paged for this.", time: fmtTime(a.ack.at) });
  } else if (a.state === "escalated") {
    lines.push({ id: `${a.id}-esc`, from: "system", text: "No reply yet — the next person on the ladder was alerted" });
  }
  return lines;
}

function RuleRow({ r, canManage, onChange }: { r: AlertRule; canManage: boolean; onChange: (r: AlertRule) => void }) {
  const tr = TRIGGERS[r.trigger];
  return (
    <tr className={cn("align-top hover:bg-muted/50", !r.enabled && "opacity-60")}>
      <td className="px-3 py-2.5"><Switch checked={r.enabled} disabled={!canManage} onCheckedChange={(v) => { onChange({ ...r, enabled: v }); toast.success(`${tr.label} alerts ${v ? "on" : "off"}`); }} aria-label={`${tr.label} alerts`} /></td>
      <td className="px-3 py-2.5"><div className="font-medium">{tr.label} {tr.critical && <StatusPill tone="signal" size="xs" dot={false} className="ml-1">Critical</StatusPill>}</div><div className="text-xs text-muted-foreground">{tr.event}</div></td>
      <td className="px-3 py-2.5">
        <ol className="flex flex-wrap items-center gap-1 text-xs">
          {r.ladder.map((g, i) => (
            <li key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-muted-foreground">→</span>}
              <span className="rounded-md border bg-muted/40 px-1.5 py-0.5">{RUNG_LABEL[g.to]}{g.after_min > 0 && <Mono className="ml-1 text-[11px] text-muted-foreground">+{g.after_min}m</Mono>}</span>
            </li>
          ))}
        </ol>
        <div className="mt-1 text-[11px] text-muted-foreground">Template <Mono className="text-[11px]">{TEMPLATES.find((t) => t.id === r.template_id)?.name}</Mono></div>
      </td>
      <td className="px-3 py-2.5 text-xs">{tr.critical ? <span className="text-muted-foreground">Always sends</span> : r.quiet_hours ? <Mono className="text-xs">{r.quiet_hours.from}–{r.quiet_hours.to}</Mono> : "—"}</td>
      <td className="px-3 py-2.5"><Switch checked={r.sms_fallback} disabled={!canManage} onCheckedChange={(v) => onChange({ ...r, sms_fallback: v })} aria-label={`SMS backup for ${tr.label}`} /></td>
      <td className="px-3 py-2.5 text-right text-xs"><Mono className="text-xs">{r.sent_7d}</Mono><div className="text-muted-foreground">{r.sent_7d ? `${Math.round(r.ack_rate * 100)}% answered` : "—"}</div></td>
    </tr>
  );
}

function ThreadDialog({ contact, messages, onClose }: { contact: WaContact | null; messages: WaMessage[]; onClose: () => void }) {
  if (!contact) return <Dialog open={false} />;
  const lines: PhoneLine[] = threadFor(contact.id, messages).map((l) => ({ id: l.id, from: l.from, text: l.text, time: fmtTime(l.at), buttons: l.buttons?.map((b) => ({ kind: "reply" as const, text: b })), spent: true, read: true }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{contact.name}</DialogTitle><DialogDescription>{fmtWaPhone(contact.phone)} · {LANG_LABEL[contact.language]} · the bot’s thread with them</DialogDescription></DialogHeader>
        <PhoneFrame title={BOT.name} lines={lines} label={`Thread with ${contact.name}`} />
      </DialogContent>
    </Dialog>
  );
}

function TestDialog({ open, onOpenChange, contacts }: { open: boolean; onOpenChange: (o: boolean) => void; contacts: WaContact[] }) {
  const [to, setTo] = useState(contacts.find((c) => c.opted_in)?.id ?? "");
  const [tid, setTid] = useState("t-absent");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Send a test alert</DialogTitle><DialogDescription>Uses the template’s example values, so nobody reads it as a real alert.</DialogDescription></DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>To</Label>
            <Select value={to} onValueChange={(v) => setTo(String(v))}>
              <SelectTrigger aria-label="Recipient" className="w-full"><SelectValue>{(v: string) => contacts.find((c) => c.id === v)?.name}</SelectValue></SelectTrigger>
              <SelectContent>{contacts.filter((c) => c.opted_in).map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · {c.role}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Template</Label>
            <Select value={tid} onValueChange={(v) => setTid(String(v))}>
              <SelectTrigger aria-label="Template" className="w-full"><SelectValue>{(v: string) => TEMPLATES.find((t) => t.id === v)?.name}</SelectValue></SelectTrigger>
              <SelectContent>{TEMPLATES.filter((t) => t.status === "approved").map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => { onOpenChange(false); toast.success(`Test sent to ${contacts.find((c) => c.id === to)?.name}`, { description: "Preview only — nothing left the building." }); }}><Send data-icon="inline-start" /> Send test</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
