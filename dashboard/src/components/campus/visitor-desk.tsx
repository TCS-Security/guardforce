"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRightFromLine, ArrowRightToLine, Check, CheckCircle2, Copy, Download, DoorOpen, Link2, MessageCircle, Phone, QrCode as QrIcon,
  ScanLine, ShieldAlert, Sparkles, TimerReset, UserPlus, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/gf/stat-tile";
import { StatusPill } from "@/components/gf/status-pill";
import { Section } from "@/components/gf/section";
import { EmptyState } from "@/components/gf/empty-state";
import { Mono } from "@/components/gf/mono";
import { KvList } from "@/components/gf/kv";
import { FilterBar, FilterField, FilterSearch } from "@/components/gf/filter-bar";
import { Code, VisitorPhoto } from "./campus-bits";
import { LiveCamera } from "./live-camera";
import { PhoneFrame, type PhoneLine } from "./phone-frame";
import { QrCode } from "./qr-code";
import { useDemoNow } from "./use-demo-now";
import {
  approve, autoFillFromTenant, checkIn, checkOut, deny, ID_TYPE, maskId, nextRef, OVERSTAY_MIN, stayMinutes, validateVisitor,
  VISITOR_STATUS, VISITOR_TYPE, visitorStats, watchlist, type NewVisitorInput,
} from "@/lib/campus/visitors";
import { downloadCsv } from "@/lib/campus/csv";
import { render, TEMPLATES } from "@/lib/whatsapp/templates";
import { fmtDateTime, fmtMinutes, fmtTime } from "@/lib/domain/format";
import type { CampusData, Gate, IdType, Tenant, Visitor, VisitorStatus, VisitorType } from "@/lib/campus/types";
import { cn } from "cn";

type Photos = Record<string, string>;
const VISITOR_TEMPLATE = TEMPLATES.find((t) => t.id === "t-visitor")!;
const first = (n: string) => n.replace(/^Dr\.\s*/, "").split(" ")[0] ?? n;

export function VisitorDesk({ data, deskGuard, canWrite }: { data: CampusData; deskGuard: string; canWrite: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const now = useDemoNow(data.now);
  const [visitors, setVisitors] = useState(data.visitors);
  const [photos, setPhotos] = useState<Photos>({});
  const [tab, setTab] = useState(params.get("tab") ?? "register");
  const [entryOpen, setEntryOpen] = useState(params.get("new") === "1");
  const [preAuthOpen, setPreAuthOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [passFor, setPassFor] = useState<Visitor | null>(null);
  const [checkingIn, setCheckingIn] = useState<Visitor | null>(null);
  const [checkingOut, setCheckingOut] = useState<Visitor | null>(null);
  const [selected, setSelected] = useState<string | null>(() => data.visitors.find((v) => v.status === "pending")?.id ?? null);
  const [hostReplies, setHostReplies] = useState<Record<string, { text: string; at: string }>>({});
  const [escalated, setEscalated] = useState<Record<string, boolean>>({});
  const [extended, setExtended] = useState<Record<string, number>>({});

  const tenant = (id: string) => data.tenants.find((t) => t.id === id)!;
  const floorOf = (t: Tenant) => data.floors.find((f) => f.id === t.floor_id)!;
  const gate = (id: string | null) => data.gates.find((g) => g.id === id);
  const stats = visitorStats(visitors, now);
  const flags = watchlist(visitors, now).filter((f) => f.reason === "denied" || (f.minutes ?? 0) > OVERSTAY_MIN + (extended[f.visitor.id] ?? 0));
  const pending = visitors.filter((v) => v.status === "pending");

  function replace(v: Visitor) {
    setVisitors((xs) => xs.map((x) => (x.id === v.id ? v : x)));
  }
  function run(result: ReturnType<typeof approve>, success: (v: Visitor) => void) {
    if (!result.ok) return toast.error(result.error);
    replace(result.visitor);
    success(result.visitor);
  }

  function hostDecides(v: Visitor, yes: boolean, via: Visitor["approval_via"]) {
    const t = tenant(v.tenant_id);
    run(yes ? approve(v, t.contact_name, via, now) : deny(v, t.contact_name, via, now), (nv) => {
      if (via === "whatsapp") setHostReplies((r) => ({ ...r, [v.id]: { text: yes ? "Approve" : "Deny", at: now.toISOString() } }));
      toast[yes ? "success" : "warning"](`${t.contact_name} ${yes ? "approved" : "denied"} ${nv.name}`, {
        description: yes ? `${via === "whatsapp" ? "Replied on WhatsApp" : via === "link" ? "Via the approval link" : "Confirmed by phone"}. The gate can check them in now.` : "The visitor is blocked at every gate for today.",
      });
    });
  }

  function exportRegister() {
    downloadCsv(`visitors-${data.today}.csv`, visitors.map((v) => {
      const t = tenant(v.tenant_id);
      return {
        Ref: v.ref, Visitor: v.name, Mobile: v.phone, Company: v.company, Category: VISITOR_TYPE[v.type], "ID type": ID_TYPE[v.id_type],
        "ID (masked)": maskId(v.id_type, v.id_last4), Vehicle: v.vehicle ?? "", Purpose: v.purpose, "Host tenant": t.name, Destination: `${floorOf(t).name}, ${t.unit}`,
        "Approved by": v.approved_by ?? "", "Approved via": v.approval_via ?? "", "Check-in guard": v.checked_in_by ?? "", "Check-in": v.checked_in_at ? fmtDateTime(v.checked_in_at) : "",
        "Entry gate": gate(v.gate_id)?.name ?? "", Badge: v.badge_no ?? "", "Check-out gate": gate(v.exit_gate_id)?.name ?? "", "Check-out guard": v.checked_out_by ?? "",
        "Check-out": v.checked_out_at ? fmtDateTime(v.checked_out_at) : "", "Stay": fmtMinutes(stayMinutes(v, now)), Status: VISITOR_STATUS[v.status].label,
      };
    }));
    toast.success("Register exported", { description: `${visitors.length} rows · opens in Excel or Sheets` });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {canWrite && <Button onClick={() => setEntryOpen(true)} className="h-9"><UserPlus data-icon="inline-start" /> New gate entry</Button>}
        {canWrite && <Button variant="outline" onClick={() => setPreAuthOpen(true)} className="h-9"><Sparkles data-icon="inline-start" /> Pre-authorise guest</Button>}
        <Button variant="outline" onClick={() => setScanOpen(true)} className="h-9"><ScanLine data-icon="inline-start" /> Scan pass</Button>
        <Button variant="ghost" onClick={exportRegister} className="h-9 sm:ml-auto"><Download data-icon="inline-start" /> Export register</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Visitors today" value={stats.total - stats.expected} hint={`${stats.expected} more expected`} style={{ ["--i" as string]: 1 }} />
        <StatTile label="Awaiting host" value={stats.pending} tone={stats.pending ? "half-day" : "neutral"} hint="Asked on WhatsApp" style={{ ["--i" as string]: 2 }} />
        <StatTile label="On premises" value={stats.onPremises} tone="present" hint={`${flags.filter((f) => f.reason === "overstay").length} past ${OVERSTAY_MIN / 60} h`} style={{ ["--i" as string]: 3 }} />
        <StatTile label="Host approval rate" value={stats.approvalRate == null ? "—" : `${stats.approvalRate}%`} hint={`${stats.denied} turned away`} style={{ ["--i" as string]: 4 }} />
        <StatTile label="Average stay" value={fmtMinutes(stats.avgStayMin)} hint={`${stats.checkedOut} checked out`} style={{ ["--i" as string]: 5 }} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="reveal gap-4" style={{ ["--i" as string]: 6 }}>
        <TabsList className="h-9">
          <TabsTrigger value="register" className="px-3">Register</TabsTrigger>
          <TabsTrigger value="approvals" className="px-3">
            Host approvals {pending.length > 0 && <span className="ml-1 rounded-full bg-half-day px-1.5 font-mono text-[10px] text-half-day-foreground">{pending.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="watchlist" className="px-3">
            Watchlist {flags.length > 0 && <span className="ml-1 rounded-full bg-signal px-1.5 font-mono text-[10px] text-signal-foreground">{flags.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="log" className="px-3">Movement log</TabsTrigger>
        </TabsList>

        <TabsContent value="register">
          <Register
            visitors={visitors} data={data} now={now} photos={photos} canWrite={canWrite}
            onPass={setPassFor} onCheckIn={setCheckingIn} onCheckOut={setCheckingOut}
            onApproveDesk={(v) => hostDecides(v, true, "desk")} onDenyDesk={(v) => hostDecides(v, false, "desk")}
            onAsk={(v) => { setSelected(v.id); setTab("approvals"); }}
          />
        </TabsContent>

        <TabsContent value="approvals">
          <Approvals
            pending={pending} all={visitors} data={data} now={now} photos={photos} selected={selected} onSelect={setSelected}
            hostReplies={hostReplies} canWrite={canWrite} onDecide={hostDecides} onPass={setPassFor}
            onNew={() => setEntryOpen(true)} onPreAuth={() => setPreAuthOpen(true)}
          />
        </TabsContent>

        <TabsContent value="watchlist">
          <Section title="Watchlist" description={`Inside longer than ${OVERSTAY_MIN / 60} hours, or turned away by a host today`} bodyClassName="p-0">
            {flags.length === 0 ? <EmptyState className="m-4" icon={<ShieldAlert />} title="Nobody to watch" description="Overstays and refused visitors show up here, and the bot tells the supervisor." /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label="Watchlist">
                  <thead><tr className="eyebrow border-b text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal"><th>Visitor</th><th>Host</th><th>Purpose</th><th>Flag</th><th className="text-right">Action</th></tr></thead>
                  <tbody className="divide-y">
                    {flags.map((f) => {
                      const t = tenant(f.visitor.tenant_id);
                      return (
                        <tr key={f.visitor.id} className="hover:bg-muted/50">
                          <td className="px-4 py-2.5"><div className="flex items-center gap-2.5"><VisitorPhoto name={f.visitor.name} hue={f.visitor.photo_hue} src={photos[f.visitor.id]} size="sm" /><div><div className="font-medium">{f.visitor.name}</div><div className="text-xs text-muted-foreground">{f.visitor.company}</div></div></div></td>
                          <td className="px-4 py-2.5 text-xs">{t.name}<div className="text-muted-foreground">{floorOf(t).name}</div></td>
                          <td className="max-w-[220px] truncate px-4 py-2.5 text-xs text-muted-foreground">{f.visitor.purpose}</td>
                          <td className="px-4 py-2.5">{f.reason === "overstay" ? <StatusPill tone="signal" size="xs">Inside {fmtMinutes(f.minutes)}</StatusPill> : <StatusPill tone="absent" size="xs">Denied by host</StatusPill>}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex justify-end gap-1.5">
                              {f.reason === "overstay" && canWrite && <Button size="sm" variant="ghost" onClick={() => { setExtended((e) => ({ ...e, [f.visitor.id]: (e[f.visitor.id] ?? 0) + 60 + (f.minutes ?? 0) - OVERSTAY_MIN })); toast.success(`${t.contact_name} extended ${f.visitor.name}'s visit by an hour`); }}><TimerReset data-icon="inline-start" /> Host extended</Button>}
                              {f.reason === "overstay" && canWrite && <Button size="sm" variant="outline" onClick={() => setCheckingOut(f.visitor)}><ArrowRightFromLine data-icon="inline-start" /> Check out</Button>}
                              <Button size="sm" variant={escalated[f.visitor.id] ? "ghost" : "destructive"} disabled={escalated[f.visitor.id]} onClick={() => { setEscalated((e) => ({ ...e, [f.visitor.id]: true })); toast.warning("Escalated to the security supervisor", { description: "The WhatsApp bot sent the visitor's photo, host and time inside." }); }}>
                                <ShieldAlert data-icon="inline-start" /> {escalated[f.visitor.id] ? "Escalated" : "Escalate"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="log">
          <MovementLog visitors={visitors} data={data} now={now} onExport={exportRegister} />
        </TabsContent>
      </Tabs>

      <NewEntrySheet
        open={entryOpen} onOpenChange={(o) => { setEntryOpen(o); if (!o && params.get("new")) router.replace(`?site=${data.campus.site_id}`, { scroll: false }); }}
        data={data} deskGuard={deskGuard} now={now}
        onCreate={(v, photo) => {
          const ref = nextRef("VIS", visitors.map((x) => x.ref));
          const nv = { ...v, ref };
          setVisitors((xs) => [nv, ...xs]);
          if (photo) setPhotos((p) => ({ ...p, [nv.id]: photo }));
          setSelected(nv.id);
          setTab("approvals");
          const t = tenant(nv.tenant_id);
          toast.success(`${ref} created — waiting for ${t.contact_name}`, { description: t.approval_channel === "desk" ? "Call the host from the approvals tab." : `WhatsApp sent to ${t.contact_name} (${t.name}) with the photo and an approve/deny button.` });
        }}
      />
      <PreAuthDialog
        open={preAuthOpen} onOpenChange={setPreAuthOpen} tenants={data.tenants} gates={data.gates}
        onCreate={(input) => {
          const t = tenant(input.tenant_id);
          const ref = nextRef("VIS", visitors.map((x) => x.ref));
          const v: Visitor = {
            id: `vs-${Date.now()}`, ref, name: input.name, phone: input.phone, company: input.company || "Self", type: "guest", id_type: "aadhaar", id_last4: "····",
            vehicle: null, tenant_id: t.id, purpose: input.purpose, gate_id: input.gate_id, status: "expected", pre_authorised: true,
            arrived_at: new Date(`${data.today}T${input.time}:00+05:30`).toISOString(), approved_at: now.toISOString(), approved_by: t.contact_name, approval_via: "link",
            checked_in_at: null, checked_in_by: null, badge_no: null, checked_out_at: null, checked_out_by: null, exit_gate_id: null, exit_remarks: null, baggage: null, photo_hue: (visitors.length * 47) % 360,
          };
          setVisitors((xs) => [v, ...xs]);
          toast.success(`${input.name} pre-authorised for ${input.time}`, { description: `The visitor got their QR pass ${ref} on WhatsApp; the gate lets them straight in.` });
        }}
      />
      <ScanDialog
        open={scanOpen} onOpenChange={setScanOpen} visitors={visitors}
        onFound={(v) => {
          setScanOpen(false);
          if (v.status === "approved" || v.status === "expected") setCheckingIn(v);
          else if (v.status === "checked_in") setCheckingOut(v);
          else setPassFor(v);
        }}
      />
      <PassDialog visitor={passFor} data={data} now={now} photo={passFor ? photos[passFor.id] : undefined} onClose={() => setPassFor(null)} />
      <CheckInDialog
        visitor={checkingIn} data={data} photo={checkingIn ? photos[checkingIn.id] : undefined} onClose={() => setCheckingIn(null)}
        onConfirm={(v, badge) => run(checkIn(v, deskGuard, badge, now), (nv) => { setCheckingIn(null); toast.success(`${nv.name} checked in with badge ${nv.badge_no}`, { description: "The stay timer has started." }); })}
      />
      <CheckOutDialog
        visitor={checkingOut} gates={data.gates} now={now} onClose={() => setCheckingOut(null)}
        onConfirm={(v, gateId, remarks) => run(checkOut(v, deskGuard, gateId, remarks, now), (nv) => { setCheckingOut(null); toast.success(`${nv.name} checked out`, { description: `Stayed ${fmtMinutes(stayMinutes(nv, now))}.` }); })}
      />
    </>
  );
}

/* ------------------------------------------------------------------ register */

function Register({ visitors, data, now, photos, canWrite, onPass, onCheckIn, onCheckOut, onApproveDesk, onDenyDesk, onAsk }: {
  visitors: Visitor[]; data: CampusData; now: Date; photos: Photos; canWrite: boolean;
  onPass: (v: Visitor) => void; onCheckIn: (v: Visitor) => void; onCheckOut: (v: Visitor) => void;
  onApproveDesk: (v: Visitor) => void; onDenyDesk: (v: Visitor) => void; onAsk: (v: Visitor) => void;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [tenantId, setTenantId] = useState<string>("all");
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return visitors
      .filter((v) => status === "all" || v.status === status)
      .filter((v) => tenantId === "all" || v.tenant_id === tenantId)
      .filter((v) => !needle || [v.name, v.company, v.ref, v.phone, v.vehicle ?? "", v.purpose].some((x) => x.toLowerCase().includes(needle)));
  }, [visitors, q, status, tenantId]);
  const tenant = (id: string) => data.tenants.find((t) => t.id === id)!;

  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <FilterField label="Search" className="min-w-[220px] flex-1"><FilterSearch placeholder="Name, company, pass, phone, vehicle" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search visitors" /></FilterField>
        <FilterField label="Status">
          <Select value={status} onValueChange={(v) => setStatus(String(v))}>
            <SelectTrigger aria-label="Filter by status" className="w-[170px]"><SelectValue>{(v: string) => (v === "all" ? "All statuses" : VISITOR_STATUS[v as VisitorStatus].label)}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(VISITOR_STATUS) as VisitorStatus[]).map((s) => <SelectItem key={s} value={s}>{VISITOR_STATUS[s].label}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Tenant">
          <Select value={tenantId} onValueChange={(v) => setTenantId(String(v))}>
            <SelectTrigger aria-label="Filter by tenant" className="w-[200px]"><SelectValue>{(v: string) => (v === "all" ? "All tenants" : tenant(v)?.name)}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tenants</SelectItem>
              {data.tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      <Section bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Visitor register">
            <thead>
              <tr className="eyebrow border-b text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-normal">
                <th className="min-w-[200px]">Visitor</th><th className="min-w-[170px]">Host & destination</th><th className="min-w-[180px]">Purpose & ID</th><th className="min-w-[150px]">Gate</th><th>Status</th><th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((v) => {
                const t = tenant(v.tenant_id);
                const f = data.floors.find((x) => x.id === t.floor_id)!;
                const stay = stayMinutes(v, now);
                return (
                  <tr key={v.id} data-testid={`visitor-${v.ref}`} className="align-top hover:bg-muted/50">
                    <td className="px-3 py-2.5">
                      <div className="flex gap-2.5">
                        <VisitorPhoto name={v.name} hue={v.photo_hue} src={photos[v.id]} />
                        <div className="min-w-0">
                          <div className="font-medium">{v.name}</div>
                          <div className="text-xs text-muted-foreground">{v.company} · <Mono className="text-xs">{v.phone.replace(/(\d{5})(\d{5})/, "$1 $2")}</Mono></div>
                          <div className="mt-0.5 flex flex-wrap gap-1"><Code>{v.ref}</Code>{v.vehicle && <Code>{v.vehicle}</Code>}{v.pre_authorised && <StatusPill tone="on-leave" size="xs" dot={false}>Pre-authorised</StatusPill>}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs"><div className="font-medium text-foreground">{t.name}</div><div className="text-muted-foreground">{f.name} · {t.unit}</div></td>
                    <td className="px-3 py-2.5 text-xs"><div>{v.purpose}</div><div className="text-muted-foreground">{VISITOR_TYPE[v.type]} · {ID_TYPE[v.id_type]} <Mono className="text-[11px]">{maskId(v.id_type, v.id_last4)}</Mono></div></td>
                    <td className="px-3 py-2.5 text-xs">
                      <div>{data.gates.find((g) => g.id === v.gate_id)?.name.split(" · ")[0]}{v.checked_in_by ? ` · ${v.checked_in_by.split(" ")[0]}` : ""}</div>
                      {v.checked_in_at ? (
                        <div className="text-muted-foreground">in <Mono className="text-xs">{fmtTime(v.checked_in_at)}</Mono>{v.checked_out_at ? <> · out <Mono className="text-xs">{fmtTime(v.checked_out_at)}</Mono></> : null} · <span className={cn(v.status === "checked_in" && (stay ?? 0) > OVERSTAY_MIN && "font-medium text-signal")}>{fmtMinutes(stay)}</span></div>
                      ) : <div className="text-muted-foreground">{v.status === "expected" ? `expected ${fmtTime(v.arrived_at)}` : `arrived ${fmtTime(v.arrived_at)}`}</div>}
                    </td>
                    <td className="px-3 py-2.5"><StatusPill tone={VISITOR_STATUS[v.status].tone} size="xs" pulse={v.status === "pending"}>{VISITOR_STATUS[v.status].label}</StatusPill></td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        {canWrite && v.status === "pending" && <>
                          <Button size="sm" variant="ghost" onClick={() => onAsk(v)}><MessageCircle data-icon="inline-start" /> Host</Button>
                          <Button size="sm" variant="outline" onClick={() => onDenyDesk(v)} aria-label={`Deny ${v.name}`}><X /></Button>
                          <Button size="sm" onClick={() => onApproveDesk(v)} aria-label={`Approve ${v.name}`}><Check data-icon="inline-start" /> Approve</Button>
                        </>}
                        {canWrite && (v.status === "approved" || v.status === "expected") && <Button size="sm" onClick={() => onCheckIn(v)}><ArrowRightToLine data-icon="inline-start" /> Check in</Button>}
                        {canWrite && v.status === "checked_in" && <Button size="sm" variant="outline" onClick={() => onCheckOut(v)}><ArrowRightFromLine data-icon="inline-start" /> Check out</Button>}
                        <Button size="sm" variant="ghost" onClick={() => onPass(v)} aria-label={`Pass for ${v.name}`}><QrIcon /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">No visitors match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

/* ----------------------------------------------------------------- approvals */

function hostThread(v: Visitor, t: Tenant, gateName: string, photo: string | undefined, reply: { text: string; at: string } | undefined, decided: Visitor["status"]): PhoneLine[] {
  const values = [first(t.contact_name), v.name, v.company, gateName, v.purpose];
  const lines: PhoneLine[] = [{
    id: `${v.id}-ask`, from: "us", header: VISITOR_TEMPLATE.header, text: render(VISITOR_TEMPLATE.body, values), footer: VISITOR_TEMPLATE.footer,
    time: fmtTime(v.arrived_at), image: photo ?? null,
    buttons: VISITOR_TEMPLATE.buttons.map((b) => ({ kind: b.type === "quick_reply" ? "reply" as const : b.type === "url" ? "url" as const : "call" as const, text: b.text })),
    spent: decided !== "pending",
  }];
  if (reply) {
    lines.push({ id: `${v.id}-r`, from: "them", text: reply.text, time: fmtTime(reply.at), read: true });
    lines.push({
      id: `${v.id}-ok`, from: "us", time: fmtTime(reply.at),
      text: reply.text === "Approve" ? `Thank you. ${v.name} has been cleared at ${gateName} and will get a visitor badge.` : `Understood. ${v.name} will not be let in today. The gate has been told.`,
    });
  }
  return lines;
}

function Approvals({ pending, all, data, now, photos, selected, onSelect, hostReplies, canWrite, onDecide, onPass, onNew, onPreAuth }: {
  pending: Visitor[]; all: Visitor[]; data: CampusData; now: Date; photos: Photos; selected: string | null; onSelect: (id: string) => void;
  hostReplies: Record<string, { text: string; at: string }>; canWrite: boolean; onDecide: (v: Visitor, yes: boolean, via: Visitor["approval_via"]) => void;
  onPass: (v: Visitor) => void; onNew: () => void; onPreAuth: () => void;
}) {
  const shown = all.find((v) => v.id === selected) ?? pending[0] ?? null;
  const tenant = (id: string) => data.tenants.find((t) => t.id === id)!;
  const cleared = all.filter((v) => v.approved_at && !v.pre_authorised && v.status !== "rejected").length;
  const denied = all.filter((v) => v.status === "rejected").length;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <StatusPill tone="half-day" size="xs">{pending.length} waiting</StatusPill>
          <StatusPill tone="present" size="xs">{cleared} cleared</StatusPill>
          <StatusPill tone="absent" size="xs">{denied} denied</StatusPill>
          <span className="text-muted-foreground">Hosts answer on WhatsApp, from a no-login link, or by phone to the desk. No tenant app to install.</span>
        </div>
        {pending.length === 0 ? (
          <EmptyState icon={<CheckCircle2 />} title="All visitor requests cleared" description="New walk-ins appear here the moment the gate registers them." action={canWrite && <div className="flex gap-2"><Button onClick={onNew}><UserPlus data-icon="inline-start" /> New gate entry</Button><Button variant="outline" onClick={onPreAuth}>Pre-authorise guest</Button></div>} />
        ) : (
          <ul className="flex flex-col gap-3" aria-label="Waiting for host">
            {pending.map((v) => {
              const t = tenant(v.tenant_id);
              const f = data.floors.find((x) => x.id === t.floor_id)!;
              const waitMin = Math.max(0, Math.round((now.getTime() - new Date(v.arrived_at).getTime()) / 60_000));
              const isShown = shown?.id === v.id;
              const link = `/approve/${v.ref}?site=${data.campus.site_id}`;
              return (
                <li key={v.id} className={cn("rounded-lg border bg-card p-4 transition-colors", isShown && "border-primary/50 shadow-[inset_3px_0_0_0_var(--primary)]")}>
                  <div className="flex flex-wrap gap-4">
                    <VisitorPhoto name={v.name} hue={v.photo_hue} src={photos[v.id]} size="lg" />
                    <div className="min-w-[220px] flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-lg font-semibold">{v.name}</span>
                        <StatusPill tone="olive" size="xs" dot={false}>{VISITOR_TYPE[v.type]}</StatusPill>
                        <Code>{v.ref}</Code>
                      </div>
                      <div className="text-sm text-muted-foreground">{v.company} · <Mono className="text-xs">{v.phone}</Mono> · {ID_TYPE[v.id_type]} <Mono className="text-xs">{maskId(v.id_type, v.id_last4)}</Mono></div>
                      <div className="mt-1 text-sm">For <span className="font-medium">{t.contact_name}</span>, {t.name} · {f.name}, {t.unit}</div>
                      <div className="text-sm text-muted-foreground">“{v.purpose}” · at {data.gates.find((g) => g.id === v.gate_id)?.name} · waiting <span className={cn(waitMin >= 10 && "font-medium text-signal")}>{waitMin} min</span></div>
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {t.approval_channel === "whatsapp" ? <><MessageCircle className="size-3.5 text-present" /> WhatsApp delivered to {t.contact_name} · <span className="text-on-leave">✓✓ read</span></>
                          : t.approval_channel === "link" ? <><Link2 className="size-3.5" /> Approval link sent by SMS to {t.contact_name}</>
                            : <><Phone className="size-3.5" /> Host prefers a call to the desk</>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                    <Button size="sm" variant={isShown ? "secondary" : "ghost"} onClick={() => onSelect(v.id)}><MessageCircle data-icon="inline-start" /> {isShown ? "Showing host's WhatsApp" : "Show host's WhatsApp"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(`${location.origin}${link}`); toast.success("Approval link copied", { description: "Works on any phone; no login, expires in 30 min." }); }}><Copy data-icon="inline-start" /> Copy link</Button>
                    <Button size="sm" variant="ghost" nativeButton={false} render={<a href={link} target="_blank" rel="noreferrer" />}><Link2 data-icon="inline-start" /> Open link</Button>
                    <Button size="sm" variant="ghost" onClick={() => onPass(v)}><QrIcon data-icon="inline-start" /> Pass details</Button>
                    {canWrite && <div className="ml-auto flex gap-2">
                      <Button size="sm" variant="destructive" onClick={() => onDecide(v, false, "desk")}><X data-icon="inline-start" /> Deny entry</Button>
                      <Button size="sm" onClick={() => onDecide(v, true, "desk")}><Check data-icon="inline-start" /> Approve (host called)</Button>
                    </div>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 xl:sticky xl:top-20 xl:self-start">
        {shown ? (
          <>
            <div className="eyebrow text-center">What {first(tenant(shown.tenant_id).contact_name)} sees on WhatsApp</div>
            <PhoneFrame
              title="Security Desk"
              subtitle={`${data.campus.name} · business account`}
              label={`Host WhatsApp for ${shown.ref}`}
              lines={hostThread(shown, tenant(shown.tenant_id), data.gates.find((g) => g.id === shown.gate_id)?.name ?? "the gate", photos[shown.id], hostReplies[shown.id], shown.status)}
              onReply={(text) => {
                if (text === "Approve") onDecide(shown, true, "whatsapp");
                else if (text === "Deny") onDecide(shown, false, "whatsapp");
              }}
            />
            <p className="max-w-[300px] text-center text-xs text-muted-foreground">Tap <b>Approve</b> or <b>Deny</b> on the phone to play the host. The register updates the moment they reply.</p>
          </>
        ) : <p className="text-sm text-muted-foreground">Pick a request to see the host’s side.</p>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- movement log */

function MovementLog({ visitors, data, now, onExport }: { visitors: Visitor[]; data: CampusData; now: Date; onExport: () => void }) {
  const tenant = (id: string) => data.tenants.find((t) => t.id === id)!;
  const gateName = (id: string | null) => data.gates.find((g) => g.id === id)?.name.split(" · ")[0] ?? "—";
  const rows = [...visitors].sort((a, b) => b.arrived_at.localeCompare(a.arrived_at));
  return (
    <Section title="Visitor movement & approval log" description={`${rows.length} records · who approved, who let them in and out, how long they stayed`} actions={<Button size="sm" variant="ghost" onClick={onExport}><Download data-icon="inline-start" /> Export</Button>} bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap" aria-label="Movement log">
          <thead><tr className="eyebrow border-b text-left [&>th]:border-r [&>th]:px-3 [&>th]:py-2 [&>th]:font-normal last:[&>th]:border-r-0"><th>Pass</th><th>Visitor</th><th>Host</th><th>Approval</th><th>Check-in</th><th>Check-out</th><th>Stay</th><th>Status</th></tr></thead>
          <tbody className="divide-y">
            {rows.map((v) => (
              <tr key={v.id} className="hover:bg-muted/50 [&>td]:border-r [&>td]:px-3 [&>td]:py-2 last:[&>td]:border-r-0">
                <td><Code>{v.ref}</Code> <span className="text-muted-foreground">{v.badge_no ?? ""}</span></td>
                <td><span className="font-medium">{v.name}</span> <span className="text-muted-foreground">· {v.company}</span></td>
                <td>{tenant(v.tenant_id).name}</td>
                <td>{v.approved_at ? <>{v.approved_by} <span className="text-muted-foreground">· {v.pre_authorised ? "pre-authorised" : v.approval_via} · {fmtTime(v.approved_at)}</span></> : <span className="text-muted-foreground">—</span>}</td>
                <td>{v.checked_in_at ? <>{gateName(v.gate_id)} · {v.checked_in_by} · <Mono className="text-xs">{fmtTime(v.checked_in_at)}</Mono></> : "—"}</td>
                <td>{v.checked_out_at ? <>{gateName(v.exit_gate_id)} · {v.checked_out_by} · <Mono className="text-xs">{fmtTime(v.checked_out_at)}</Mono></> : "—"}</td>
                <td><Mono className="text-xs">{fmtMinutes(stayMinutes(v, now))}</Mono>{v.status === "checked_in" && <span className="text-present"> · inside</span>}</td>
                <td><StatusPill tone={VISITOR_STATUS[v.status].tone} size="xs">{VISITOR_STATUS[v.status].label}</StatusPill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------- dialogs */

const EMPTY: NewVisitorInput & { vehicle: string; gate_id: string; baggage: string } = {
  name: "", phone: "", company: "", type: "", id_type: "", id_number: "", tenant_id: "", purpose: "", vehicle: "", gate_id: "gt-2", baggage: "",
};

function NewEntrySheet({ open, onOpenChange, data, deskGuard, now, onCreate }: {
  open: boolean; onOpenChange: (o: boolean) => void; data: CampusData; deskGuard: string; now: Date; onCreate: (v: Visitor, photo: string | null) => void;
}) {
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof NewVisitorInput, string>>>({});
  const [photo, setPhoto] = useState<string | null>(null);
  const t = data.tenants.find((x) => x.id === f.tenant_id);
  const fill = t ? autoFillFromTenant(t, data.floors.find((x) => x.id === t.floor_id)!.name) : null;
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setF((x) => ({ ...x, [k]: v }));
  const gateName = data.gates.find((g) => g.id === f.gate_id)?.name ?? "";

  function submit() {
    const e = validateVisitor(f);
    setErrors(e);
    if (Object.keys(e).length) return toast.error("Some fields need fixing", { description: Object.values(e)[0] });
    const digits = f.id_number.replace(/\D|\s/g, "");
    onCreate({
      id: `vs-${Date.now()}`, ref: "", name: f.name.trim(), phone: f.phone.replace(/\D/g, "").slice(-10), company: f.company.trim(), type: f.type as VisitorType,
      id_type: f.id_type as IdType, id_last4: (digits || f.id_number).slice(-4), vehicle: f.vehicle.trim().toUpperCase() || null, tenant_id: f.tenant_id,
      purpose: f.purpose.trim(), gate_id: f.gate_id, status: "pending", pre_authorised: false, arrived_at: now.toISOString(), approved_at: null,
      approved_by: null, approval_via: null, checked_in_at: null, checked_in_by: null, badge_no: null, checked_out_at: null, checked_out_by: null,
      exit_gate_id: null, exit_remarks: null, baggage: f.baggage.trim() || null, photo_hue: (f.name.length * 37) % 360,
    }, photo);
    setF(EMPTY);
    setPhoto(null);
    setErrors({});
    onOpenChange(false);
  }

  const err = (k: keyof NewVisitorInput) => errors[k] && <p className="text-xs text-absent">{errors[k]}</p>;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl" aria-describedby="entry-desc">
        <SheetHeader className="border-b">
          <SheetTitle className="font-display text-xl">New gate entry</SheetTitle>
          <SheetDescription id="entry-desc">Register a walk-in at the gate. The host is asked on WhatsApp the moment you save.</SheetDescription>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => setF({ name: "Piyush Khare", phone: "98110 45623", company: "Shivit Technologies", type: "guest", id_type: "aadhaar", id_number: "4234 2342 3412", tenant_id: "tn-3", purpose: "Product demo for the robotics team", vehicle: "UP 16 BD 4501", gate_id: "gt-2", baggage: "1 laptop" })}><Sparkles data-icon="inline-start" /> Fill sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setF(EMPTY); setErrors({}); setPhoto(null); }}>Clear</Button>
          </div>
        </SheetHeader>
        <form className="flex flex-col gap-5 p-4" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="eyebrow mb-2">01 · Visitor</legend>
            <div className="flex flex-col gap-1.5 sm:col-span-2"><Label htmlFor="v-name">Full name *</Label><Input id="v-name" value={f.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} />{err("name")}</div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="v-phone">Mobile *</Label><Input id="v-phone" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} aria-invalid={!!errors.phone} />{err("phone")}</div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="v-company">Company *</Label><Input id="v-company" value={f.company} onChange={(e) => set("company", e.target.value)} aria-invalid={!!errors.company} />{err("company")}</div>
            <div className="flex flex-col gap-1.5">
              <Label>Visitor type *</Label>
              <Select value={f.type} onValueChange={(v) => set("type", v as VisitorType)}>
                <SelectTrigger aria-label="Visitor type" className="w-full"><SelectValue placeholder="Pick one">{(v: string) => VISITOR_TYPE[v as VisitorType] ?? "Pick one"}</SelectValue></SelectTrigger>
                <SelectContent>{(Object.keys(VISITOR_TYPE) as VisitorType[]).map((k) => <SelectItem key={k} value={k}>{VISITOR_TYPE[k]}</SelectItem>)}</SelectContent>
              </Select>{err("type")}
            </div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="v-vehicle">Vehicle number</Label><Input id="v-vehicle" value={f.vehicle} onChange={(e) => set("vehicle", e.target.value)} placeholder="KA 01 AB 1234" /></div>
            <div className="flex flex-col gap-1.5">
              <Label>Government ID *</Label>
              <Select value={f.id_type} onValueChange={(v) => set("id_type", v as IdType)}>
                <SelectTrigger aria-label="ID type" className="w-full"><SelectValue placeholder="Pick one">{(v: string) => ID_TYPE[v as IdType] ?? "Pick one"}</SelectValue></SelectTrigger>
                <SelectContent>{(Object.keys(ID_TYPE) as IdType[]).map((k) => <SelectItem key={k} value={k}>{ID_TYPE[k]}</SelectItem>)}</SelectContent>
              </Select>{err("id_type")}
            </div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="v-id">ID number *</Label><Input id="v-id" value={f.id_number} onChange={(e) => set("id_number", e.target.value)} aria-invalid={!!errors.id_number} /><p className="text-[11px] text-muted-foreground">Only the last 4 are kept.</p>{err("id_number")}</div>
          </fieldset>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="eyebrow mb-2 flex items-center gap-2">02 · Host & destination <StatusPill tone="olive" size="xs" dot={false}>Auto-filled from tenant</StatusPill></legend>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Host tenant *</Label>
              <Select value={f.tenant_id} onValueChange={(v) => set("tenant_id", String(v))}>
                <SelectTrigger aria-label="Host tenant" className="w-full"><SelectValue placeholder="Who are they here to see?">{(v: string) => { const x = data.tenants.find((y) => y.id === v); return x ? `${x.name} · ${x.unit}` : "Who are they here to see?"; }}</SelectValue></SelectTrigger>
                <SelectContent>{data.tenants.map((x) => <SelectItem key={x.id} value={x.id}>{x.name} · {x.unit}</SelectItem>)}</SelectContent>
              </Select>{err("tenant_id")}
            </div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="v-floor">Floor</Label><Input id="v-floor" readOnly value={fill?.floor ?? ""} placeholder="From the tenant" className="bg-muted/50" /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="v-unit">Unit</Label><Input id="v-unit" readOnly value={fill?.unit ?? ""} placeholder="From the tenant" className="bg-muted/50" /></div>
            <div className="flex flex-col gap-1.5 sm:col-span-2"><Label htmlFor="v-host">Host contact</Label><Input id="v-host" readOnly value={fill?.host ?? ""} placeholder="From the tenant" className="bg-muted/50" /></div>
            {fill && <p className="flex items-center gap-1.5 text-xs text-present sm:col-span-2"><CheckCircle2 className="size-3.5" /> {fill.message}</p>}
            <div className="flex flex-col gap-1.5 sm:col-span-2"><Label htmlFor="v-purpose">Purpose of visit *</Label><Input id="v-purpose" value={f.purpose} onChange={(e) => set("purpose", e.target.value)} aria-invalid={!!errors.purpose} />{err("purpose")}</div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Gate of entry</Label>
              <Select value={f.gate_id} onValueChange={(v) => set("gate_id", String(v))}>
                <SelectTrigger aria-label="Gate" className="w-full"><SelectValue>{(v: string) => data.gates.find((g) => g.id === v)?.name}</SelectValue></SelectTrigger>
                <SelectContent>{data.gates.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="eyebrow mb-2">03 · Photo & baggage</legend>
            <LiveCamera label="Visitor live photo" value={photo} onCapture={setPhoto} watermark={{ by: `${deskGuard} · gate desk`, place: gateName }} />
            <div className="flex flex-col gap-1.5"><Label htmlFor="v-bag">Baggage / remarks</Label><Input id="v-bag" value={f.baggage} onChange={(e) => set("baggage", e.target.value)} placeholder="1 laptop, toolkit" /></div>
          </fieldset>

          <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-popover px-4 py-3">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit"><DoorOpen data-icon="inline-start" /> Save & ask host</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function PreAuthDialog({ open, onOpenChange, tenants, gates, onCreate }: {
  open: boolean; onOpenChange: (o: boolean) => void; tenants: Tenant[]; gates: Gate[];
  onCreate: (x: { tenant_id: string; name: string; phone: string; company: string; time: string; purpose: string; gate_id: string }) => void;
}) {
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? "");
  const [gateId, setGateId] = useState("gt-2");
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pre-authorise a guest</DialogTitle>
          <DialogDescription>A host clears a visitor before they arrive. The visitor gets a QR pass on WhatsApp and walks straight in.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          action={(fd) => {
            const name = String(fd.get("name") ?? "").trim();
            const phone = String(fd.get("phone") ?? "").replace(/\D/g, "");
            const purpose = String(fd.get("purpose") ?? "").trim();
            if (name.length < 2 || phone.length < 10 || purpose.length < 3) return setError("Name, a 10-digit mobile and a purpose are needed.");
            setError(null);
            onCreate({ tenant_id: tenantId, name, phone: phone.slice(-10), company: String(fd.get("company") ?? ""), time: String(fd.get("time") || "16:00"), purpose, gate_id: gateId });
            onOpenChange(false);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label>Host tenant</Label>
            <Select value={tenantId} onValueChange={(v) => setTenantId(String(v))}>
              <SelectTrigger aria-label="Host tenant" className="w-full"><SelectValue>{(v: string) => tenants.find((t) => t.id === v)?.name}</SelectValue></SelectTrigger>
              <SelectContent>{tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5"><Label htmlFor="pa-name">Guest name</Label><Input id="pa-name" name="name" /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="pa-phone">Mobile</Label><Input id="pa-phone" name="phone" inputMode="tel" /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="pa-company">Company</Label><Input id="pa-company" name="company" placeholder="Self" /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="pa-time">Expected at</Label><Input id="pa-time" name="time" type="time" defaultValue="16:00" /></div>
            <div className="flex flex-col gap-1.5">
              <Label>Gate</Label>
              <Select value={gateId} onValueChange={(v) => setGateId(String(v))}>
                <SelectTrigger aria-label="Gate" className="w-full"><SelectValue>{(v: string) => gates.find((g) => g.id === v)?.name.split(" · ")[0]}</SelectValue></SelectTrigger>
                <SelectContent>{gates.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex flex-col gap-1.5"><Label htmlFor="pa-purpose">Purpose</Label><Input id="pa-purpose" name="purpose" /></div>
          </div>
          {error && <p role="alert" className="text-sm text-absent">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit"><Sparkles data-icon="inline-start" /> Pre-authorise & send pass</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ScanDialog({ open, onOpenChange, visitors, onFound }: { open: boolean; onOpenChange: (o: boolean) => void; visitors: Visitor[]; onFound: (v: Visitor) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const samples = visitors.filter((v) => ["approved", "expected", "checked_in"].includes(v.status)).slice(0, 3);
  function look(ref: string) {
    const v = visitors.find((x) => x.ref.toLowerCase() === ref.trim().toLowerCase());
    if (!v) return setError(`No pass ${ref.trim().toUpperCase()} today.`);
    setError(null);
    setCode("");
    onFound(v);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan a visitor pass</DialogTitle>
          <DialogDescription>Point the gate phone at the QR on the visitor’s WhatsApp pass. The same scanner reads floor checkpoint codes.</DialogDescription>
        </DialogHeader>
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-ink">
          <div className="absolute inset-x-10 top-1/2 h-0.5 animate-pulse bg-present shadow-[0_0_12px_var(--present)]" />
          <div className="size-40 rounded-lg border-2 border-dashed border-white/60" />
          <span className="absolute bottom-2 text-xs text-white/70">Align the QR inside the box</span>
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); look(code); }}>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="or type the pass number, e.g. VIS-4630" aria-label="Pass number" />
          <Button type="submit">Look up</Button>
        </form>
        {error && <p role="alert" className="text-sm text-absent">{error}</p>}
        {samples.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            Simulate a scan:
            {samples.map((v) => <Button key={v.id} size="xs" variant="outline" onClick={() => look(v.ref)}>{v.ref}</Button>)}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PassDialog({ visitor, data, now, photo, onClose }: { visitor: Visitor | null; data: CampusData; now: Date; photo?: string; onClose: () => void }) {
  if (!visitor) return <Dialog open={false} />;
  const t = data.tenants.find((x) => x.id === visitor.tenant_id)!;
  const f = data.floors.find((x) => x.id === t.floor_id)!;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">Digital visitor pass <Code>{visitor.ref}</Code></DialogTitle>
          <DialogDescription>{data.campus.name} · the QR is what the gate scans on the way in and out.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-4">
          <div className="flex flex-col items-center gap-2">
            <VisitorPhoto name={visitor.name} hue={visitor.photo_hue} src={photo} size="lg" />
            <QrCode value={`GF-VIS:${visitor.ref}:${data.campus.site_id.slice(0, 8)}`} size={120} label={`QR for pass ${visitor.ref}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><span className="font-display text-lg font-semibold">{visitor.name}</span><StatusPill tone={VISITOR_STATUS[visitor.status].tone} size="xs">{VISITOR_STATUS[visitor.status].label}</StatusPill></div>
            <KvList items={[
              { k: "Company", v: visitor.company },
              { k: "Host", v: `${t.contact_name}, ${t.name}` },
              { k: "Floor & unit", v: `${f.name}, ${t.unit}` },
              { k: "Purpose", v: visitor.purpose },
              { k: "ID proof", v: <>{ID_TYPE[visitor.id_type]} <Mono className="text-xs">{maskId(visitor.id_type, visitor.id_last4)}</Mono></> },
              { k: "Vehicle", v: visitor.vehicle ?? "—" },
              { k: "Gate · guard", v: `${data.gates.find((g) => g.id === visitor.gate_id)?.name ?? "—"}${visitor.checked_in_by ? ` · ${visitor.checked_in_by}` : ""}` },
              { k: "Time inside", v: fmtMinutes(stayMinutes(visitor, now)) },
              { k: "Approved", v: visitor.approved_by ? `${visitor.approved_by} via ${visitor.pre_authorised ? "pre-authorisation" : visitor.approval_via}` : "Waiting" },
            ]} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CheckInDialog({ visitor, data, photo, onClose, onConfirm }: { visitor: Visitor | null; data: CampusData; photo?: string; onClose: () => void; onConfirm: (v: Visitor, badge: string) => void }) {
  const [badge, setBadge] = useState("");
  const [idSeen, setIdSeen] = useState(false);
  if (!visitor) return <Dialog open={false} />;
  const t = data.tenants.find((x) => x.id === visitor.tenant_id)!;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) { setBadge(""); setIdSeen(false); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Check in {visitor.name}</DialogTitle>
          <DialogDescription>Approved by {visitor.approved_by ?? t.contact_name}. Hand over a visitor badge and note its number; the stay timer starts now.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <VisitorPhoto name={visitor.name} hue={visitor.photo_hue} src={photo} />
          <div className="text-sm"><div className="font-medium">{visitor.company}</div><div className="text-xs text-muted-foreground">{ID_TYPE[visitor.id_type]} {maskId(visitor.id_type, visitor.id_last4)} · for {t.name}</div></div>
        </div>
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (!idSeen) return toast.error("Confirm you checked the ID against the face."); onConfirm(visitor, badge); setBadge(""); setIdSeen(false); }}>
          <div className="flex flex-col gap-1.5"><Label htmlFor="ci-badge">Visitor badge number</Label><Input id="ci-badge" value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="B-14" autoFocus /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={idSeen} onChange={(e) => setIdSeen(e.target.checked)} className="size-4 accent-[var(--primary)]" /> I matched the ID to the person in front of me</label>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit"><ArrowRightToLine data-icon="inline-start" /> Confirm check-in</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CheckOutDialog({ visitor, gates, now, onClose, onConfirm }: { visitor: Visitor | null; gates: Gate[]; now: Date; onClose: () => void; onConfirm: (v: Visitor, gateId: string, remarks: string) => void }) {
  const [gateId, setGateId] = useState<string | null>(null);
  if (!visitor) return <Dialog open={false} />;
  const g = gateId ?? visitor.gate_id;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) { setGateId(null); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Visitor check-out</DialogTitle>
          <DialogDescription>Confirm {visitor.name} ({visitor.company}) is leaving. Inside for {fmtMinutes(stayMinutes(visitor, now))}{visitor.badge_no ? `, badge ${visitor.badge_no}` : ""}.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-3" action={(fd) => { onConfirm(visitor, g, String(fd.get("remarks") ?? "")); setGateId(null); }}>
          <div className="flex flex-col gap-1.5">
            <Label>Exit gate</Label>
            <Select value={g} onValueChange={(v) => setGateId(String(v))}>
              <SelectTrigger aria-label="Exit gate" className="w-full"><SelectValue>{(v: string) => gates.find((x) => x.id === v)?.name}</SelectValue></SelectTrigger>
              <SelectContent>{gates.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="co-remarks">Exit remarks</Label><Textarea id="co-remarks" name="remarks" rows={2} placeholder="Badge returned, laptop serial checked" /></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit"><ArrowRightFromLine data-icon="inline-start" /> Confirm check-out</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
