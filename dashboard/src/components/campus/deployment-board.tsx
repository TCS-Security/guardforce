"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, CreditCard, Fingerprint, Plus, Smartphone, UserCog, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/gf/stat-tile";
import { StatusPill } from "@/components/gf/status-pill";
import { Section } from "@/components/gf/section";
import { Mono } from "@/components/gf/mono";
import { Battery, PersonCell } from "./campus-bits";
import { AGENCIES, DUTIES } from "@/lib/campus/sample";
import { fmtTime } from "@/lib/domain/format";
import type { CampusData, Deployment, Duty } from "@/lib/campus/types";
import { cn } from "cn";

type GateConfig = { duty_type: string; vehicle: string; visitor: string; material: string };
type CustomField = { id: string; label: string; value: string };

export function DeploymentBoard({ data, canWrite }: { data: CampusData; canWrite: boolean }) {
  const [rows, setRows] = useState(data.deployments);
  const [editing, setEditing] = useState<Deployment | null>(null);
  const active = rows.filter((d) => !d.reserve);
  const reserve = rows.filter((d) => d.reserve);
  const shift = (id: string) => data.shifts.find((s) => s.id === id)!;
  const tower = (id: string | null) => data.towers.find((t) => t.id === id);
  const lowBattery = active.filter((d) => (d.battery_pct ?? 100) < 20);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Guards on this campus" value={rows.length} hint={`${reserve.length} in the reserve pool`} style={{ ["--i" as string]: 1 }} />
        <StatTile label="Online now" value={`${active.filter((d) => d.online).length}/${active.length}`} tone="present" hint="Guard app heartbeat in the last 15 min" style={{ ["--i" as string]: 2 }} />
        <StatTile label="Gate duty" value={active.filter((d) => d.duties.includes("gate")).length} hint="Entry, visitors, vehicles, material" style={{ ["--i" as string]: 3 }} />
        <StatTile label="Floor inspection" value={active.filter((d) => d.duties.includes("inspection")).length} hint="Daily QR + geofence surveys" style={{ ["--i" as string]: 4 }} />
        <StatTile label="Low battery" value={lowBattery.length} tone={lowBattery.length ? "absent" : "neutral"} hint={lowBattery.length ? `${lowBattery.map((d) => d.guard.full_name.split(" ")[0]).join(", ")} — the bot nudged them to charge` : "Every phone above 20%"} style={{ ["--i" as string]: 5 }} />
      </div>

      <Section title="Posts on this campus" description="Where each guard stands, on which shift, doing what" bodyClassName="p-0" style={{ ["--i" as string]: 6 }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Guard posts">
            <thead><tr className="eyebrow border-b text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-normal"><th className="min-w-[180px]">Guard</th><th className="min-w-[170px]">Post</th><th>Shift</th><th className="min-w-[200px]">Duties</th><th>Agency</th><th>Phone</th><th>Access</th><th className="text-right">Action</th></tr></thead>
            <tbody className="divide-y">
              {active.map((d) => {
                const s = shift(d.shift_id);
                return (
                  <tr key={d.guard.id} className="align-top hover:bg-muted/50">
                    <td className="px-3 py-2.5"><Link href={`/guards/${d.guard.id}`} className="hover:underline"><PersonCell guard name={d.guard.full_name} sub={d.guard.employee_code ?? undefined} /></Link></td>
                    <td className="px-3 py-2.5 text-xs"><div className="font-medium text-foreground">{d.post}</div><div className="text-muted-foreground">{tower(d.tower_id)?.name}{d.floor_ids.length ? ` · ${d.floor_ids.map((f) => data.floors.find((x) => x.id === f)?.code).join(", ")}` : ""}{d.gate_ids.length ? ` · ${d.gate_ids.map((g) => data.gates.find((x) => x.id === g)?.code).join(", ")}` : ""}</div></td>
                    <td className="px-3 py-2.5 text-xs"><div>{s.name}</div><Mono className="text-xs text-muted-foreground">{s.start}–{s.end}</Mono></td>
                    <td className="px-3 py-2.5"><div className="flex flex-wrap gap-1">{d.duties.map((x) => <StatusPill key={x} tone="olive" size="xs" dot={false}>{DUTIES[x].label}</StatusPill>)}</div></td>
                    <td className="px-3 py-2.5 text-xs">{d.agency}</td>
                    <td className="px-3 py-2.5"><div className="flex flex-col gap-1"><Battery pct={d.battery_pct} />{d.online ? <StatusPill tone="present" size="xs">Online</StatusPill> : <StatusPill tone="neutral" size="xs">{d.last_seen_at ? `Seen ${fmtTime(d.last_seen_at)}` : "Offline"}</StatusPill>}</div></td>
                    <td className="px-3 py-2.5"><AccessIcons d={d} /></td>
                    <td className="px-3 py-2.5">
                      {canWrite && <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setEditing(d)}><UserCog data-icon="inline-start" /> Edit post</Button>
                        <Button size="sm" variant="ghost" aria-label={`Move ${d.guard.full_name} to reserve`} onClick={() => { setRows((xs) => xs.map((x) => (x.guard.id === d.guard.id ? { ...x, reserve: true, post: "Reserve pool", duties: [], gate_ids: [], floor_ids: [], tower_id: null, online: false } : x))); toast.success(`${d.guard.full_name} moved to the reserve pool`); }}><UserMinus /></Button>
                      </div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Reserve pool" description="Trained for this campus, not on a post today — first call for relief" bodyClassName="p-0" style={{ ["--i" as string]: 7 }}>
        {reserve.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nobody in reserve.</p> : (
          <ul className="divide-y">
            {reserve.map((d) => (
              <li key={d.guard.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <PersonCell guard name={d.guard.full_name} sub={`${d.agency} · ${d.guard.phone ?? "no phone"}`} />
                {canWrite && <Button size="sm" onClick={() => setEditing(d)}><UserPlus data-icon="inline-start" /> Assign to a post</Button>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {editing && (
        <AssignSheet
          d={editing} data={data} onClose={() => setEditing(null)}
          onSave={(nd) => { setRows((xs) => xs.map((x) => (x.guard.id === nd.guard.id ? nd : x))); setEditing(null); toast.success(`${nd.guard.full_name} assigned to ${nd.post}`, { description: "The post orders and shift went to their phone on WhatsApp." }); }}
        />
      )}
    </>
  );
}

function AccessIcons({ d }: { d: Deployment }) {
  const items = [
    { on: d.access_card, icon: CreditCard, label: "Access card" },
    { on: d.biometric, icon: Fingerprint, label: "Biometric enrolled" },
    { on: d.app_access, icon: Smartphone, label: "Guard app" },
  ];
  return (
    <div className="flex gap-1.5">
      {items.map(({ on, icon: Icon, label }) => (
        <span key={label} title={`${label}: ${on ? "yes" : "no"}`} aria-label={`${label}: ${on ? "yes" : "no"}`} className={cn("flex size-6 items-center justify-center rounded-md border", on ? "border-present/30 bg-present/10 text-present" : "text-muted-foreground/50")}>
          <Icon className="size-3.5" />
        </span>
      ))}
    </div>
  );
}

function Chips<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T[]; onChange: (v: T[]) => void; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between"><Label>{label}</Label><span className="flex gap-2 text-xs"><button type="button" className="text-primary hover:underline" onClick={() => onChange(options.map((o) => o.id))}>All</button><button type="button" className="text-muted-foreground hover:underline" onClick={() => onChange([])}>Clear</button></span></div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((o) => {
          const on = value.includes(o.id);
          return <Button key={o.id} type="button" size="sm" variant={on ? "default" : "outline"} aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}>{o.label}</Button>;
        })}
      </div>
    </div>
  );
}

function AssignSheet({ d, data, onClose, onSave }: { d: Deployment; data: CampusData; onClose: () => void; onSave: (d: Deployment) => void }) {
  const [x, setX] = useState<Deployment>({ ...d, tower_id: d.tower_id ?? data.towers[0]!.id, reserve: false });
  const [gate, setGate] = useState<GateConfig>({ duty_type: "Entry & exit management", vehicle: "Mandatory vehicle inspection", visitor: "Govt ID + QR pass", material: "Inward / outward slip scan" });
  const [contract, setContract] = useState({ employee_id: d.agency === AGENCIES[0] ? "" : "SIS-EMP-8821", supervisor: "Inspector Ramesh Sharma", start: "2026-04-01", end: "2027-03-31" });
  const [custom, setCustom] = useState<CustomField[]>([{ id: "c1", label: "Uniform size", value: "L" }, { id: "c2", label: "Ex-serviceman", value: "No" }, { id: "c3", label: "Languages", value: "Kannada, Hindi" }]);
  const [weeklyOff, setWeeklyOff] = useState("Sunday");
  const set = <K extends keyof Deployment>(k: K, v: Deployment[K]) => setX((p) => ({ ...p, [k]: v }));
  const s = data.shifts.find((y) => y.id === x.shift_id)!;
  const floorsOfTower = data.floors.filter((f) => f.tower_id === x.tower_id || x.tower_id === "tw-a");
  const sec = (n: string, title: string, tag?: string) => (
    <div className="flex items-center gap-2 border-b pb-1.5"><span className="font-mono text-xs text-muted-foreground">{n}</span><span className="font-display text-sm font-semibold">{title}</span>{tag && <StatusPill tone="olive" size="xs" dot={false} className="ml-auto">{tag}</StatusPill>}</div>
  );

  function save() {
    if (x.duties.length === 0) return toast.error("Pick at least one duty.");
    if (x.duties.includes("gate") && x.gate_ids.length === 0) return toast.error("Gate duty needs a gate.");
    const t = data.towers.find((y) => y.id === x.tower_id);
    const post = x.duties.includes("gate") && x.gate_ids[0] ? data.gates.find((g) => g.id === x.gate_ids[0])!.name : `${t?.name.split(" (")[0]}${x.floor_ids.length ? ` · ${x.floor_ids.length} floor${x.floor_ids.length > 1 ? "s" : ""}` : ""}`;
    onSave({ ...x, post, online: d.online });
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle className="font-display text-xl">Post for {d.guard.full_name}</SheetTitle>
          <SheetDescription>Identity, KYC and documents live on the guard’s profile; this is where they stand and what they do here.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 p-4">
          <section className="flex flex-col gap-3">
            {sec("01", "Building & location", "Deployment")}
            <div className="flex flex-col gap-1.5">
              <Label>Tower / block</Label>
              <Select value={x.tower_id ?? ""} onValueChange={(v) => set("tower_id", String(v))}>
                <SelectTrigger aria-label="Tower" className="w-full"><SelectValue>{(v: string) => data.towers.find((t) => t.id === v)?.name}</SelectValue></SelectTrigger>
                <SelectContent>{data.towers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Chips label="Floors" options={floorsOfTower.map((f) => ({ id: f.id, label: f.name }))} value={x.floor_ids} onChange={(v) => set("floor_ids", v)} />
            <Chips label="Gates / posts" options={data.gates.map((g) => ({ id: g.id, label: g.name }))} value={x.gate_ids} onChange={(v) => set("gate_ids", v)} />
          </section>

          <section className="flex flex-col gap-3">
            {sec("02", "Shift", "From shift master")}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label>Shift</Label>
                <Select value={x.shift_id} onValueChange={(v) => { const n = data.shifts.find((y) => y.id === v)!; set("shift_id", n.id); toast.info(`Shift timings loaded: ${n.start}–${n.end}, ${n.break_min} min break`); }}>
                  <SelectTrigger aria-label="Shift" className="w-full"><SelectValue>{(v: string) => { const n = data.shifts.find((y) => y.id === v); return n ? `${n.name} (${n.start}–${n.end})` : ""; }}</SelectValue></SelectTrigger>
                  <SelectContent>{data.shifts.map((y) => <SelectItem key={y.id} value={y.id}>{y.name} ({y.start}–{y.end})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5"><Label htmlFor="as-start">Starts</Label><Input id="as-start" readOnly value={s.start} className="bg-muted/50 font-mono" /></div>
              <div className="flex flex-col gap-1.5"><Label htmlFor="as-end">Ends</Label><Input id="as-end" readOnly value={s.end} className="bg-muted/50 font-mono" /></div>
              <div className="flex flex-col gap-1.5"><Label htmlFor="as-break">Break allowed</Label><Input id="as-break" readOnly value={`${s.break_min} min`} className="bg-muted/50 font-mono" /></div>
              <div className="flex flex-col gap-1.5">
                <Label>Weekly off</Label>
                <Select value={weeklyOff} onValueChange={(v) => setWeeklyOff(String(v))}>
                  <SelectTrigger aria-label="Weekly off" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">A break longer than {s.break_min} min makes the WhatsApp bot ask the guard, then their supervisor.</p>
          </section>

          <section className="flex flex-col gap-3">
            {sec("03", "Duties", `${x.duties.length} selected`)}
            <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Duties">
              {(Object.keys(DUTIES) as Duty[]).map((k) => {
                const on = x.duties.includes(k);
                return (
                  <label key={k} className={cn("flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors", on ? "border-primary/50 bg-primary/5" : "hover:bg-muted/50")}>
                    <input type="checkbox" checked={on} onChange={() => set("duties", on ? x.duties.filter((y) => y !== k) : [...x.duties, k])} className="mt-0.5 size-4 accent-[var(--primary)]" />
                    <span><span className="block text-sm font-medium">{DUTIES[k].label}</span><span className="block text-xs text-muted-foreground">{DUTIES[k].hint}</span></span>
                  </label>
                );
              })}
            </div>
          </section>

          {x.duties.includes("gate") && (
            <section className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3" aria-label="Gate duty configuration">
              {sec("03a", "Gate duty set-up", "Because gate duty is on")}
              <div className="grid grid-cols-2 gap-3">
                {([
                  ["duty_type", "Gate duty type", ["Entry & exit management", "Entry only", "Exit only", "Visitor desk only"]],
                  ["vehicle", "Vehicle checking", ["Mandatory vehicle inspection", "Random checks", "No"]],
                  ["visitor", "Visitor verification", ["Govt ID + QR pass", "QR pass only", "No"]],
                  ["material", "Material checking", ["Inward / outward slip scan", "Outward only", "No"]],
                ] as const).map(([k, label, opts]) => (
                  <div key={k} className="flex flex-col gap-1.5">
                    <Label>{label}</Label>
                    <Select value={gate[k]} onValueChange={(v) => setGate((g) => ({ ...g, [k]: String(v) }))}>
                      <SelectTrigger aria-label={label} className="w-full bg-card"><SelectValue /></SelectTrigger>
                      <SelectContent>{opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-3">
            {sec("04", "Employment & agency", "Vendor")}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label>Employed through</Label>
                <Select value={x.agency} onValueChange={(v) => set("agency", String(v))}>
                  <SelectTrigger aria-label="Agency" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{AGENCIES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {x.agency !== AGENCIES[0] && <>
                <div className="flex flex-col gap-1.5"><Label htmlFor="as-emp">Agency employee ID</Label><Input id="as-emp" value={contract.employee_id} onChange={(e) => setContract((c) => ({ ...c, employee_id: e.target.value }))} /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor="as-sup">Agency supervisor</Label><Input id="as-sup" value={contract.supervisor} onChange={(e) => setContract((c) => ({ ...c, supervisor: e.target.value }))} /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor="as-cs">Contract start</Label><Input id="as-cs" type="date" value={contract.start} onChange={(e) => setContract((c) => ({ ...c, start: e.target.value }))} /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor="as-ce">Contract end</Label><Input id="as-ce" type="date" value={contract.end} onChange={(e) => setContract((c) => ({ ...c, end: e.target.value }))} /></div>
              </>}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            {sec("05", "Access & systems")}
            {([["access_card", "Physical access card issued", CreditCard], ["biometric", "Biometric enrolled at the turnstile", Fingerprint], ["app_access", "Guard app login enabled", Smartphone]] as const).map(([k, label, Icon]) => (
              <label key={k} className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2"><Icon className="size-4 text-muted-foreground" /> {label}</span><Switch checked={x[k]} onCheckedChange={(v) => set(k, v)} aria-label={label} /></label>
            ))}
          </section>

          <section className="flex flex-col gap-3">
            {sec("06", "Custom fields", "Your agency's own")}
            {custom.map((c) => (
              <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2">
                <Input aria-label="Field name" value={c.label} onChange={(e) => setCustom((cs) => cs.map((y) => (y.id === c.id ? { ...y, label: e.target.value } : y)))} className="font-medium" />
                <Input aria-label={`${c.label} value`} value={c.value} onChange={(e) => setCustom((cs) => cs.map((y) => (y.id === c.id ? { ...y, value: e.target.value } : y)))} />
              </div>
            ))}
            <Button type="button" size="sm" variant="ghost" className="self-start" onClick={() => setCustom((cs) => [...cs, { id: `c${Date.now()}`, label: "New field", value: "" }])}><Plus data-icon="inline-start" /> Add a field</Button>
          </section>
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-popover px-4 py-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}><BadgeCheck data-icon="inline-start" /> Save post</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
