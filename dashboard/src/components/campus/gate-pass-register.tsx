"use client";

import { useMemo, useState } from "react";
import { Ban, CheckCheck, Download, FilePlus2, Printer, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/gf/stat-tile";
import { StatusPill } from "@/components/gf/status-pill";
import { Section } from "@/components/gf/section";
import { Mono } from "@/components/gf/mono";
import { FilterBar, FilterField, FilterSearch } from "@/components/gf/filter-bar";
import { Code } from "./campus-bits";
import { QrCode } from "./qr-code";
import { useDemoNow } from "./use-demo-now";
import { effectiveStatus, PASS_STATUS, PASS_TYPE, validatePass, validityLabel, type NewPassInput } from "@/lib/campus/passes";
import { ID_TYPE, maskId, nextRef } from "@/lib/campus/visitors";
import { downloadCsv } from "@/lib/campus/csv";
import { fmtDateTime, fromLocalInput, toLocalInput } from "@/lib/domain/format";
import type { CampusData, GatePass, IdType, PassStatus, PassType } from "@/lib/campus/types";
import { cn } from "cn";

export function GatePassRegister({ data, officer, canWrite }: { data: CampusData; officer: string; canWrite: boolean }) {
  const now = useDemoNow(data.now);
  const [passes, setPasses] = useState(data.passes);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [creating, setCreating] = useState(false);
  const [slip, setSlip] = useState<GatePass | null>(null);

  const tenant = (id: string) => data.tenants.find((t) => t.id === id)!;
  const floor = (id: string) => data.floors.find((f) => f.id === id)!;
  const st = (p: GatePass) => effectiveStatus(p, now);
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return passes
      .filter((p) => type === "all" || p.type === type)
      .filter((p) => status === "all" || effectiveStatus(p, now) === status)
      .filter((p) => !n || [p.ref, p.title, p.holder, p.firm, tenant(p.tenant_id).name].some((x) => x.toLowerCase().includes(n)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passes, q, type, status, now]);

  const active = passes.filter((p) => st(p) === "active");
  const set = (id: string, s: PassStatus, msg: string) => {
    setPasses((xs) => xs.map((x) => (x.id === id ? { ...x, status: s } : x)));
    toast.success(msg);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {canWrite && <Button className="h-9" onClick={() => setCreating(true)}><FilePlus2 data-icon="inline-start" /> Issue a pass</Button>}
        <Button variant="ghost" className="h-9 sm:ml-auto" onClick={() => {
          downloadCsv(`gate-passes-${data.today}.csv`, passes.map((p) => ({
            Ref: p.ref, Type: PASS_TYPE[p.type].label, Subject: p.title, Holder: p.holder, Firm: p.firm, Mobile: p.phone, "Host tenant": tenant(p.tenant_id).name,
            "Floor / unit": `${floor(p.floor_id).name}, ${p.unit}`, Gates: p.gate_ids.map((g) => data.gates.find((x) => x.id === g)?.code).join(" "),
            "Valid from": fmtDateTime(p.valid_from), "Valid to": fmtDateTime(p.valid_to), "Issued by": p.issued_by, Materials: p.materials, Status: PASS_STATUS[st(p)].label,
          })));
          toast.success("Pass register exported");
        }}><Download data-icon="inline-start" /> Export</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Passes on record" value={passes.length} hint={`${active.length} active right now`} style={{ ["--i" as string]: 1 }} />
        <StatTile label="Work permits" value={active.filter((p) => p.type === "work_permit").length} tone="olive" hint="Contractors on site" style={{ ["--i" as string]: 2 }} />
        <StatTile label="Material in" value={active.filter((p) => p.type === "material_in").length} hint="Against a challan" style={{ ["--i" as string]: 3 }} />
        <StatTile label="Returnables out" value={passes.filter((p) => p.returnable).length} tone="half-day" hint="Goods that must come back" style={{ ["--i" as string]: 4 }} />
        <StatTile label="VIP passes" value={active.filter((p) => p.type === "vip").length} tone="signal" hint="Escort from the gate" style={{ ["--i" as string]: 5 }} />
      </div>

      <FilterBar style={{ ["--i" as string]: 6 }}>
        <FilterField label="Search" className="min-w-[220px] flex-1"><FilterSearch value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pass, holder, firm, tenant, subject" aria-label="Search passes" /></FilterField>
        <FilterField label="Type">
          <Select value={type} onValueChange={(v) => setType(String(v))}>
            <SelectTrigger aria-label="Filter by type" className="w-[200px]"><SelectValue>{(v: string) => (v === "all" ? "All types" : PASS_TYPE[v as PassType].label)}</SelectValue></SelectTrigger>
            <SelectContent><SelectItem value="all">All types</SelectItem>{(Object.keys(PASS_TYPE) as PassType[]).map((k) => <SelectItem key={k} value={k}>{PASS_TYPE[k].label}</SelectItem>)}</SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Status">
          <Select value={status} onValueChange={(v) => setStatus(String(v))}>
            <SelectTrigger aria-label="Filter by status" className="w-[150px]"><SelectValue>{(v: string) => (v === "all" ? "All statuses" : PASS_STATUS[v as PassStatus].label)}</SelectValue></SelectTrigger>
            <SelectContent><SelectItem value="all">All statuses</SelectItem>{(Object.keys(PASS_STATUS) as PassStatus[]).map((k) => <SelectItem key={k} value={k}>{PASS_STATUS[k].label}</SelectItem>)}</SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      <Section bodyClassName="p-0" style={{ ["--i" as string]: 7 }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Gate passes">
            <thead><tr className="eyebrow border-b text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-normal"><th>Pass</th><th className="min-w-[240px]">Subject</th><th className="min-w-[170px]">Holder</th><th className="min-w-[160px]">Host & floor</th><th className="min-w-[150px]">Validity</th><th>Status</th><th className="text-right">Action</th></tr></thead>
            <tbody className="divide-y">
              {rows.map((p) => {
                const s = st(p);
                const t = tenant(p.tenant_id);
                return (
                  <tr key={p.id} className="align-top hover:bg-muted/50">
                    <td className="px-3 py-2.5"><Code>{p.ref}</Code><div className="mt-1 text-xs text-muted-foreground">{fmtDateTime(p.issued_at)}</div></td>
                    <td className="px-3 py-2.5"><div className="font-medium">{p.title}</div><StatusPill tone={PASS_TYPE[p.type].tone} size="xs" dot={false} className="mt-1">{PASS_TYPE[p.type].label}</StatusPill>{p.returnable && <StatusPill tone="half-day" size="xs" dot={false} className="mt-1 ml-1">Returnable</StatusPill>}</td>
                    <td className="px-3 py-2.5"><div className="font-medium">{p.holder}</div><div className="text-xs text-muted-foreground">{p.firm} · <Mono className="text-xs">{p.phone}</Mono></div></td>
                    <td className="px-3 py-2.5 text-xs"><div className="font-medium text-foreground">{t.name}</div><div className="text-muted-foreground">{floor(p.floor_id).name} · {p.unit}</div></td>
                    <td className="px-3 py-2.5 text-xs"><Mono className="text-xs">{fmtDateTime(p.valid_from)} → {fmtDateTime(p.valid_to).replace(/^Today |^Yesterday /, "")}</Mono><div className={cn("text-muted-foreground", s === "expired" && "text-absent")}>{validityLabel(p, now)}</div></td>
                    <td className="px-3 py-2.5"><StatusPill tone={PASS_STATUS[s].tone} size="xs">{PASS_STATUS[s].label}</StatusPill></td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setSlip(p)}>View slip</Button>
                        {canWrite && s === "active" && <Button size="sm" variant="ghost" onClick={() => set(p.id, "closed", `${p.ref} closed at the gate — ${p.type === "material_out" ? "goods verified on the way out" : "holder left, badge returned"}`)}><CheckCheck data-icon="inline-start" /> Close</Button>}
                        {canWrite && s === "active" && <Button size="sm" variant="ghost" aria-label={`Revoke ${p.ref}`} onClick={() => set(p.id, "revoked", `${p.ref} revoked; every gate will refuse it`)}><Ban /></Button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">No passes match.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>

      <SlipDialog pass={slip} data={data} now={now} onClose={() => setSlip(null)} />
      <CreatePassSheet open={creating} onOpenChange={setCreating} data={data} officer={officer} now={now} existing={passes}
        onCreate={(p) => { setPasses((xs) => [p, ...xs]); setSlip(p); toast.success(`${p.ref} issued`, { description: `The holder got it on WhatsApp; ${tenant(p.tenant_id).contact_name} was told.` }); }} />
    </>
  );
}

function SlipDialog({ pass, data, now, onClose }: { pass: GatePass | null; data: CampusData; now: Date; onClose: () => void }) {
  if (!pass) return <Dialog open={false} />;
  const t = data.tenants.find((x) => x.id === pass.tenant_id)!;
  const f = data.floors.find((x) => x.id === pass.floor_id)!;
  const s = effectiveStatus(pass, now);
  const field = (k: string, v: React.ReactNode) => (
    <div className="min-w-0"><div className="eyebrow text-[10px]">{k}</div><div className="text-sm font-medium break-words">{v}</div></div>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader data-print-hide>
          <DialogTitle>Gate pass {pass.ref}</DialogTitle>
          <DialogDescription>What the holder carries, and what the gate checks against.</DialogDescription>
        </DialogHeader>
        <article data-print-root className="rounded-lg border-2 border-ink/80 bg-card p-5 text-card-foreground" aria-label={`Slip ${pass.ref}`}>
          <header className="flex items-start justify-between gap-4 border-b-2 border-dashed pb-3">
            <div>
              <div className="eyebrow">{data.campus.client_name ?? "Campus"} · security & access</div>
              <div className="font-display text-xl font-semibold tracking-tight uppercase">{data.campus.name}</div>
            </div>
            <StatusPill tone={PASS_STATUS[s].tone}>{s === "active" ? "Active permit" : PASS_STATUS[s].label}</StatusPill>
          </header>
          <div className="flex gap-5 pt-4">
            <div className="min-w-0 flex-1">
              <div className="eyebrow text-primary">{PASS_TYPE[pass.type].label}</div>
              <div className="font-display text-lg leading-tight font-semibold">{pass.title}</div>
              <Mono className="text-xs text-muted-foreground">Ref {pass.ref} · issued {fmtDateTime(pass.issued_at)} by {pass.issued_by}</Mono>
              <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3">
                {field("Issued to", pass.holder)}
                {field("Firm", pass.firm)}
                {field("Mobile", <Mono>{pass.phone}</Mono>)}
                {field("ID proof", <>{ID_TYPE[pass.id_type]} <Mono className="text-xs">{maskId(pass.id_type, pass.id_last4)}</Mono></>)}
                {field("Host tenant", t.name)}
                {field("Zone / floor", `${f.name} — ${pass.unit}`)}
                {field("Gates allowed", pass.gate_ids.map((g) => data.gates.find((x) => x.id === g)?.name).join(", "))}
                {field("Valid", <Mono className="text-xs">{fmtDateTime(pass.valid_from)} → {fmtDateTime(pass.valid_to)}</Mono>)}
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <QrCode value={`GF-PASS:${pass.ref}:${data.campus.site_id.slice(0, 8)}`} size={132} />
              <span className="eyebrow text-[10px]">Scan at the gate</span>
            </div>
          </div>
          <div className="mt-4 grid gap-3 border-t pt-3 sm:grid-cols-3">
            {field("Materials / tools", pass.materials)}
            {field("Deposit / badge", pass.deposit)}
            {field("Scope of work", pass.scope)}
          </div>
          <div className="mt-8 grid grid-cols-3 gap-4 text-center text-xs text-muted-foreground">
            {["Issuing gate officer", "Host tenant / approver", "Security head"].map((s) => (
              <div key={s}><div className="mb-1 h-8 border-b border-foreground/50" />{s}</div>
            ))}
          </div>
        </article>
        <div className="flex justify-end gap-2" data-print-hide>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}><Printer data-icon="inline-start" /> Print slip</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Draft = NewPassInput & { id_type: IdType; id_number: string; materials: string; deposit: string; scope: string; returnable: boolean };

function CreatePassSheet({ open, onOpenChange, data, officer, now, existing, onCreate }: {
  open: boolean; onOpenChange: (o: boolean) => void; data: CampusData; officer: string; now: Date; existing: GatePass[]; onCreate: (p: GatePass) => void;
}) {
  const blank = (): Draft => ({
    type: "", title: "", holder: "", firm: "", phone: "", tenant_id: "", gate_ids: [], valid_from: toLocalInput(now), valid_to: toLocalInput(new Date(now.getTime() + 4 * 3_600_000)),
    id_type: "aadhaar", id_number: "", materials: "", deposit: "", scope: "", returnable: false,
  });
  const [d, setD] = useState<Draft>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof NewPassInput, string>>>({});
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const t = data.tenants.find((x) => x.id === d.tenant_id);
  const prefix = d.type ? PASS_TYPE[d.type].prefix : "GP";
  const ref = nextRef(prefix, existing.map((p) => p.ref), 9000);

  function submit() {
    const input = { ...d, valid_from: d.valid_from && fromLocalInput(d.valid_from).toISOString(), valid_to: d.valid_to && fromLocalInput(d.valid_to).toISOString() };
    const e = validatePass(input);
    setErrors(e);
    if (Object.keys(e).length) return toast.error("Some fields need fixing", { description: Object.values(e)[0] });
    onCreate({
      id: `gp-${Date.now()}`, ref, type: d.type as PassType, title: d.title.trim(), holder: d.holder.trim(), firm: d.firm.trim(), phone: d.phone.replace(/\D/g, "").slice(-10),
      id_type: d.id_type, id_last4: d.id_number.replace(/\s/g, "").slice(-4) || "····", tenant_id: d.tenant_id, floor_id: t!.floor_id, unit: t!.unit,
      gate_ids: d.gate_ids, valid_from: input.valid_from, valid_to: input.valid_to, issued_at: now.toISOString(), issued_by: officer,
      materials: d.materials || "—", deposit: d.deposit || "—", scope: d.scope || "—", returnable: d.type === "material_out" && d.returnable, status: "active",
    });
    setD(blank());
    onOpenChange(false);
  }
  const err = (k: keyof NewPassInput) => errors[k] && <p className="text-xs text-absent">{errors[k]}</p>;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle className="font-display text-xl">Issue a gate pass</SheetTitle>
          <SheetDescription>Work permit, material in or out, or a VIP pass. The host tenant, floor and unit come from the tenant record.</SheetDescription>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => setD({ ...blank(), type: "work_permit", title: "Pantry plumbing repair", holder: "Suresh Pal", firm: "AquaFix Services", phone: "98450 12345", tenant_id: "tn-2", gate_ids: ["gt-3"], id_number: "5523 1100 9081", materials: "Pipe wrench set, 2 m PVC pipe", deposit: "₹500 · badge C-11", scope: "Pantry sink line, 2F; water off 15 min" })}><Sparkles data-icon="inline-start" /> Fill sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setD(blank()); setErrors({}); }}>Clear</Button>
          </div>
        </SheetHeader>
        <form className="grid gap-3 p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label>Pass type *</Label>
            <Select value={d.type} onValueChange={(v) => set("type", v as PassType)}>
              <SelectTrigger aria-label="Pass type" className="w-full"><SelectValue placeholder="Pick one">{(v: string) => PASS_TYPE[v as PassType]?.label ?? "Pick one"}</SelectValue></SelectTrigger>
              <SelectContent>{(Object.keys(PASS_TYPE) as PassType[]).map((k) => <SelectItem key={k} value={k}>{PASS_TYPE[k].label}</SelectItem>)}</SelectContent>
            </Select>{err("type")}
          </div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="gp-ref">Reference</Label><Input id="gp-ref" readOnly value={ref} className="bg-muted/50 font-mono" /></div>
          <div className="flex flex-col gap-1.5 sm:col-span-2"><Label htmlFor="gp-title">Subject *</Label><Input id="gp-title" value={d.title} onChange={(e) => set("title", e.target.value)} />{err("title")}</div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="gp-holder">Holder *</Label><Input id="gp-holder" value={d.holder} onChange={(e) => set("holder", e.target.value)} />{err("holder")}</div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="gp-firm">Firm *</Label><Input id="gp-firm" value={d.firm} onChange={(e) => set("firm", e.target.value)} />{err("firm")}</div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="gp-phone">Mobile *</Label><Input id="gp-phone" value={d.phone} onChange={(e) => set("phone", e.target.value)} />{err("phone")}</div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="gp-id">ID number ({ID_TYPE[d.id_type]})</Label><Input id="gp-id" value={d.id_number} onChange={(e) => set("id_number", e.target.value)} /></div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Host tenant *</Label>
            <Select value={d.tenant_id} onValueChange={(v) => set("tenant_id", String(v))}>
              <SelectTrigger aria-label="Host tenant" className="w-full"><SelectValue placeholder="Pick the tenant">{(v: string) => data.tenants.find((x) => x.id === v)?.name ?? "Pick the tenant"}</SelectValue></SelectTrigger>
              <SelectContent>{data.tenants.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
            </Select>{err("tenant_id")}
            {t && <p className="text-xs text-present">Zone set to {data.floors.find((f) => f.id === t.floor_id)?.name}, {t.unit}; {t.contact_name} will be told.</p>}
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Gates allowed *</Label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Gates allowed">
              {data.gates.map((g) => {
                const on = d.gate_ids.includes(g.id);
                return <Button key={g.id} type="button" size="sm" variant={on ? "default" : "outline"} aria-pressed={on} onClick={() => set("gate_ids", on ? d.gate_ids.filter((x) => x !== g.id) : [...d.gate_ids, g.id])}>{g.name}</Button>;
              })}
            </div>{err("gate_ids")}
          </div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="gp-from">Valid from</Label><Input id="gp-from" type="datetime-local" value={d.valid_from} onChange={(e) => set("valid_from", e.target.value)} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="gp-to">Valid to *</Label><Input id="gp-to" type="datetime-local" value={d.valid_to} onChange={(e) => set("valid_to", e.target.value)} />{err("valid_to")}</div>
          <div className="flex flex-col gap-1.5 sm:col-span-2"><Label htmlFor="gp-mat">Materials / tools carried</Label><Input id="gp-mat" value={d.materials} onChange={(e) => set("materials", e.target.value)} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="gp-dep">Deposit / badge</Label><Input id="gp-dep" value={d.deposit} onChange={(e) => set("deposit", e.target.value)} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="gp-officer">Authorising officer</Label><Input id="gp-officer" readOnly value={officer} className="bg-muted/50" /></div>
          <div className="flex flex-col gap-1.5 sm:col-span-2"><Label htmlFor="gp-scope">Scope of work</Label><Textarea id="gp-scope" rows={2} value={d.scope} onChange={(e) => set("scope", e.target.value)} /></div>
          {d.type === "material_out" && <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={d.returnable} onChange={(e) => set("returnable", e.target.checked)} className="size-4 accent-[var(--primary)]" /> Returnable — the gate expects these goods back</label>}
          <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-popover px-4 py-3 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit"><FilePlus2 data-icon="inline-start" /> Issue pass</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
