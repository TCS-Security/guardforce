"use client";

import { useState } from "react";
import { FileJson, Plus, Printer, QrCode as QrIcon, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/gf/stat-tile";
import { StatusPill } from "@/components/gf/status-pill";
import { Section } from "@/components/gf/section";
import { Mono } from "@/components/gf/mono";
import { Code } from "./campus-bits";
import { QrCode } from "./qr-code";
import { FLOOR_COLUMNS, parseImport, TENANT_COLUMNS, templateFor, type ImportColumn } from "@/lib/campus/bulk-import";
import { fmtLatLng, offsetM } from "@/lib/campus/geo";
import type { CampusData, Checkpoint, Floor, Tenant, Tower } from "@/lib/campus/types";

const CHANNEL: Record<Tenant["approval_channel"], string> = { whatsapp: "WhatsApp", link: "SMS link", desk: "Call the desk" };

export function PropertyMasters({ data, canWrite }: { data: CampusData; canWrite: boolean }) {
  const [towers, setTowers] = useState(data.towers);
  const [floors, setFloors] = useState(data.floors);
  const [checkpoints, setCheckpoints] = useState(data.checkpoints);
  const [tenants, setTenants] = useState(data.tenants);
  const [importing, setImporting] = useState<"tenants" | "floors" | null>(null);
  const [labels, setLabels] = useState<Checkpoint[] | null>(null);
  const [adding, setAdding] = useState<"tower" | "tenant" | null>(null);
  const floorName = (id: string) => floors.find((f) => f.id === id)?.name ?? "—";
  const towerName = (id: string) => towers.find((t) => t.id === id)?.name ?? "—";

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Campus" value={data.campus.code} hint={[data.campus.address, data.campus.city].filter(Boolean).join(", ") || data.campus.name} style={{ ["--i" as string]: 1 }} />
        <StatTile label="Towers" value={towers.length} hint={`${towers.filter((t) => t.status === "active").length} active · ${towers.reduce((a, t) => a + t.units, 0)} units`} style={{ ["--i" as string]: 2 }} />
        <StatTile label="Checkpoints" value={checkpoints.length} hint={`QR + geofence on ${floors.length} floors`} style={{ ["--i" as string]: 3 }} />
        <StatTile label="Tenants" value={tenants.length} hint={`${tenants.filter((t) => t.approval_channel === "whatsapp").length} approve visitors on WhatsApp`} style={{ ["--i" as string]: 4 }} />
      </div>

      <Tabs defaultValue="towers" className="reveal gap-4" style={{ ["--i" as string]: 5 }}>
        <TabsList className="h-9">
          <TabsTrigger value="towers" className="px-3">Towers</TabsTrigger>
          <TabsTrigger value="floors" className="px-3">Floors & checkpoints</TabsTrigger>
          <TabsTrigger value="tenants" className="px-3">Tenants</TabsTrigger>
          <TabsTrigger value="gates" className="px-3">Gates</TabsTrigger>
        </TabsList>

        <TabsContent value="towers">
          <Section
            title="Towers & blocks" description="Buildings on this campus"
            actions={<>
              <Button size="sm" variant="ghost" onClick={() => { const blob = new Blob([JSON.stringify({ campus: data.campus, towers, floors }, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${data.campus.code}-property.json`; a.click(); }}><FileJson data-icon="inline-start" /> Export JSON</Button>
              {canWrite && <Button size="sm" variant="outline" onClick={() => setAdding("tower")}><Plus data-icon="inline-start" /> Add tower</Button>}
            </>}
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {towers.map((t) => (
                <div key={t.id} className="flex flex-col gap-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between"><Code>{t.code}</Code><StatusPill tone={t.status === "active" ? "present" : "half-day"} size="xs">{t.status === "active" ? "Active" : "Maintenance"}</StatusPill></div>
                  <div className="font-display text-base font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.description}</div>
                  <dl className="mt-auto grid grid-cols-2 gap-1 text-xs">
                    <dt className="text-muted-foreground">Floors</dt><dd><Mono className="text-xs">{t.floors}</Mono></dd>
                    <dt className="text-muted-foreground">Units</dt><dd><Mono className="text-xs">{t.units}</Mono></dd>
                    <dt className="text-muted-foreground">In charge</dt><dd className="truncate">{t.incharge}</dd>
                    <dt className="text-muted-foreground">Phone</dt><dd><Mono className="text-xs">{t.incharge_phone}</Mono></dd>
                  </dl>
                </div>
              ))}
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="floors" className="flex flex-col gap-4">
          <Section
            title="Floors" description="Each floor is a survey checkpoint: a QR fixed on the wall and a circle the phone must be inside"
            actions={<>
              {canWrite && <Button size="sm" variant="ghost" onClick={() => setImporting("floors")}><Upload data-icon="inline-start" /> Bulk import</Button>}
              <Button size="sm" variant="outline" onClick={() => setLabels(checkpoints)}><Printer data-icon="inline-start" /> Print all QR labels</Button>
            </>}
            bodyClassName="p-0"
          >
            <table className="w-full text-sm" aria-label="Floors">
              <thead><tr className="eyebrow border-b text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-normal"><th>Floor</th><th>Code</th><th>Tower</th><th>Registered GPS</th><th>Radius</th><th className="text-right">QR</th></tr></thead>
              <tbody className="divide-y">
                {floors.map((f) => (
                  <tr key={f.id} className="hover:bg-muted/50">
                    <td className="px-3 py-2 font-medium">{f.name}</td>
                    <td className="px-3 py-2"><Code>{f.code}</Code></td>
                    <td className="px-3 py-2 text-xs">{towerName(f.tower_id)}</td>
                    <td className="px-3 py-2"><Mono className="text-xs">{fmtLatLng(f)}</Mono></td>
                    <td className="px-3 py-2"><Mono className="text-xs">±{f.radius_m} m</Mono></td>
                    <td className="px-3 py-2 text-right"><Button size="sm" variant="ghost" onClick={() => setLabels(checkpoints.filter((c) => c.floor_id === f.id))}><QrIcon data-icon="inline-start" /> QR label</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <Section title="Checkpoints" description="The exact spot on each floor where the QR is fixed" bodyClassName="p-0">
            <table className="w-full text-sm" aria-label="Checkpoints">
              <thead><tr className="eyebrow border-b text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-normal"><th>Checkpoint</th><th>Floor</th><th>Where exactly</th><th>GPS</th><th>Radius</th></tr></thead>
              <tbody className="divide-y">
                {checkpoints.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/50">
                    <td className="px-3 py-2"><Code>{c.code}</Code></td>
                    <td className="px-3 py-2 text-xs">{floorName(c.floor_id)}</td>
                    <td className="px-3 py-2">{c.location}</td>
                    <td className="px-3 py-2"><Mono className="text-xs">{fmtLatLng(c)}</Mono></td>
                    <td className="px-3 py-2"><Mono className="text-xs">±{c.radius_m} m</Mono></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </TabsContent>

        <TabsContent value="tenants">
          <Section
            title="Tenant companies" description="Who visitors come to see, and how each host prefers to approve them"
            actions={canWrite && <>
              <Button size="sm" variant="ghost" onClick={() => setImporting("tenants")}><Upload data-icon="inline-start" /> Bulk import</Button>
              <Button size="sm" variant="outline" onClick={() => setAdding("tenant")}><Plus data-icon="inline-start" /> Add tenant</Button>
            </>}
            bodyClassName="p-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Tenants">
                <thead><tr className="eyebrow border-b text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-normal"><th>Company</th><th>Code</th><th>Floor & unit</th><th>Contact</th><th>Approves visitors by</th><th className="text-right">Visitors today</th></tr></thead>
                <tbody className="divide-y">
                  {tenants.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/50">
                      <td className="px-3 py-2 font-medium">{t.name}</td>
                      <td className="px-3 py-2"><Code>{t.code}</Code></td>
                      <td className="px-3 py-2 text-xs">{floorName(t.floor_id)} · {t.unit}</td>
                      <td className="px-3 py-2 text-xs"><div className="font-medium text-foreground">{t.contact_name}</div><div className="text-muted-foreground"><Mono className="text-xs">{t.contact_phone}</Mono> · {t.contact_email}</div></td>
                      <td className="px-3 py-2">
                        <Select value={t.approval_channel} onValueChange={(v) => { setTenants((xs) => xs.map((x) => (x.id === t.id ? { ...x, approval_channel: v as Tenant["approval_channel"] } : x))); toast.success(`${t.contact_name} will approve by ${CHANNEL[v as Tenant["approval_channel"]]}`); }} disabled={!canWrite}>
                          <SelectTrigger size="sm" aria-label={`Approval channel for ${t.name}`} className="w-[150px]"><SelectValue>{(v: string) => CHANNEL[v as Tenant["approval_channel"]]}</SelectValue></SelectTrigger>
                          <SelectContent>{(Object.keys(CHANNEL) as Tenant["approval_channel"][]).map((k) => <SelectItem key={k} value={k}>{CHANNEL[k]}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2 text-right"><Mono className="text-xs">{data.visitors.filter((v) => v.tenant_id === t.id).length}</Mono></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="gates">
          <Section title="Gates" description="Where people and goods come in" bodyClassName="p-0">
            <ul className="divide-y">
              {data.gates.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex items-center gap-2.5"><Code>{g.code}</Code><span className="font-medium">{g.name}</span></div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="capitalize">{g.kind}</span><Mono className="text-xs">{g.open_hours}</Mono><span>{data.deployments.filter((d) => d.gate_ids.includes(g.id)).length} guard(s)</span></div>
                </li>
              ))}
            </ul>
          </Section>
        </TabsContent>
      </Tabs>

      <ImportDialog
        kind={importing} onClose={() => setImporting(null)}
        existing={importing === "tenants" ? tenants.map((t) => t.code) : floors.map((f) => f.code)}
        onImport={(rows) => {
          if (importing === "tenants") {
            setTenants((xs) => [...xs, ...rows.map((r, i): Tenant => ({ id: `tn-i${Date.now()}-${i}`, code: r.code!, name: r.name!, floor_id: floors.find((f) => f.code === r.floor)?.id ?? floors[0]!.id, unit: r.unit!, contact_name: r.contact!, contact_phone: r.phone!.slice(-10), contact_email: r.email ?? "", approval_channel: "whatsapp" }))]);
          } else {
            const base = data.campus.anchor;
            const nf = rows.map((r, i): Floor => ({ id: `fl-i${Date.now()}-${i}`, code: r.code!, name: r.name!, tower_id: towers.find((t) => t.code === r.tower)?.id ?? towers[0]!.id, radius_m: Number(r.radius || 35), units: "", ...(r.lat && r.lng ? { lat: Number(r.lat), lng: Number(r.lng) } : offsetM(base, 10 * i, 15)) }));
            setFloors((xs) => [...xs, ...nf]);
            setCheckpoints((xs) => [...xs, ...nf.map((f, i): Checkpoint => ({ id: `cp-i${i}-${f.id}`, code: `CHK-${f.code}`, floor_id: f.id, location: "Main corridor", radius_m: f.radius_m, lat: f.lat, lng: f.lng }))]);
          }
          toast.success(`${rows.length} ${importing} imported`);
          setImporting(null);
        }}
      />
      <LabelsDialog checkpoints={labels} floors={floors} campus={data.campus.name} siteId={data.campus.site_id} onClose={() => setLabels(null)} />
      <AddDialog
        kind={adding} onClose={() => setAdding(null)} floors={floors}
        onTower={(t) => { setTowers((xs) => [...xs, t]); toast.success(`${t.name} added`); }}
        onTenant={(t) => { setTenants((xs) => [...xs, t]); toast.success(`${t.name} added — ${t.contact_name} will approve visitors on WhatsApp`); }}
      />
    </>
  );
}

function ImportDialog({ kind, existing, onClose, onImport }: { kind: "tenants" | "floors" | null; existing: string[]; onClose: () => void; onImport: (rows: Record<string, string>[]) => void }) {
  const [text, setText] = useState("");
  if (!kind) return <Dialog open={false} />;
  const columns: ImportColumn[] = kind === "tenants" ? TENANT_COLUMNS : FLOOR_COLUMNS;
  const sample = kind === "tenants"
    ? templateFor(columns, [["Indus Legal LLP", "INDUS-06", "3F-LUMN", "Suite 310", "Meera Pillai", "9845011223", "meera@induslegal.in"], ["Bad Row Co", "x", "2F-NWFN", "Suite 2", "Ravi", "12345", ""]])
    : templateFor(columns, [["4th floor (Indus)", "4F-INDS", "TWR-B", "", "", "35"], ["Terrace", "TR-TOP", "TWR-A", "", "", "50"]]);
  const res = text.trim() ? parseImport(text, columns, existing) : null;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) { setText(""); onClose(); } }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk import {kind}</DialogTitle>
          <DialogDescription>Paste straight from Excel or Google Sheets (with the header row), or a CSV. Nothing is added until you confirm.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          Columns: {columns.map((c) => <Code key={c.key} className={c.required ? "" : "opacity-60"}>{c.label}{c.required ? "*" : ""}</Code>)}
          <Button size="xs" variant="ghost" onClick={() => setText(sample)}>Paste a sample</Button>
        </div>
        <Textarea aria-label="Rows to import" rows={7} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-xs" placeholder={sample} />
        {res && (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex gap-2"><StatusPill tone="present" size="xs">{res.rows.length} ready</StatusPill>{res.errors.length > 0 && <StatusPill tone="absent" size="xs">{res.errors.length} with problems</StatusPill>}{res.unknownHeaders.length > 0 && <StatusPill tone="neutral" size="xs">Ignored: {res.unknownHeaders.join(", ")}</StatusPill>}</div>
            {res.errors.length > 0 && <ul className="max-h-28 overflow-auto rounded-md border border-absent/30 bg-absent/5 p-2 text-xs">{res.errors.map((e) => <li key={e.line}><Mono className="text-xs">Line {e.line}</Mono> — {e.message}</li>)}</ul>}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!res || res.rows.length === 0} onClick={() => { onImport(res!.rows); setText(""); }}><Upload data-icon="inline-start" /> Import {res?.rows.length ?? 0}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LabelsDialog({ checkpoints, floors, campus, siteId, onClose }: { checkpoints: Checkpoint[] | null; floors: Floor[]; campus: string; siteId: string; onClose: () => void }) {
  if (!checkpoints) return <Dialog open={false} />;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader data-print-hide>
          <DialogTitle>QR checkpoint label{checkpoints.length > 1 ? "s" : ""}</DialogTitle>
          <DialogDescription>Print on a 50 × 75 mm label printer or plain A4, and fix at the checkpoint at eye height. Guards scan it from the app to start a floor survey.</DialogDescription>
        </DialogHeader>
        <div data-print-root className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {checkpoints.map((c) => (
            <div key={c.id} className="flex flex-col items-center gap-1.5 rounded-lg border-2 border-dashed border-ink/40 p-3 text-center break-inside-avoid">
              <span className="eyebrow text-[9px]">{campus}</span>
              <QrCode value={`GF-CHK:${c.code}:${siteId.slice(0, 8)}`} size={120} label={`QR for ${c.code}`} />
              <Mono className="text-sm font-semibold">{c.code}</Mono>
              <span className="text-xs leading-tight">{floors.find((f) => f.id === c.floor_id)?.name}<br /><span className="text-muted-foreground">{c.location}</span></span>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2" data-print-hide>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}><Printer data-icon="inline-start" /> Print {checkpoints.length > 1 ? `${checkpoints.length} labels` : "label"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddDialog({ kind, floors, onClose, onTower, onTenant }: { kind: "tower" | "tenant" | null; floors: Floor[]; onClose: () => void; onTower: (t: Tower) => void; onTenant: (t: Tenant) => void }) {
  const [floorId, setFloorId] = useState(floors[0]?.id ?? "");
  if (!kind) return <Dialog open={false} />;
  const field = (id: string, label: string, ph = "", type = "text") => <div className="flex flex-col gap-1.5"><Label htmlFor={id}>{label}</Label><Input id={id} name={id} placeholder={ph} type={type} /></div>;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{kind === "tower" ? "Add a tower" : "Add a tenant"}</DialogTitle><DialogDescription>{kind === "tower" ? "A building or block on this campus." : "A company visitors come to see."}</DialogDescription></DialogHeader>
        <form className="grid grid-cols-2 gap-3" action={(fd) => {
          const g = (k: string) => String(fd.get(k) ?? "").trim();
          if (kind === "tower") {
            if (!g("name") || !g("code")) { toast.error("Name and code are needed."); return; }
            onTower({ id: `tw-${Date.now()}`, code: g("code").toUpperCase(), name: g("name"), category: "commercial", floors: Number(g("floors") || 1), units: Number(g("units") || 0), incharge: g("incharge") || "—", incharge_phone: g("phone") || "—", status: "active", description: "" });
          } else {
            if (!g("name") || !g("code") || !g("contact")) { toast.error("Company, code and contact are needed."); return; }
            onTenant({ id: `tn-${Date.now()}`, code: g("code").toUpperCase(), name: g("name"), floor_id: floorId, unit: g("unit") || "—", contact_name: g("contact"), contact_phone: g("phone"), contact_email: g("email"), approval_channel: "whatsapp" });
          }
          onClose();
        }}>
          {kind === "tower" ? <>
            <div className="col-span-2">{field("name", "Tower name", "Tower D (East wing)")}</div>
            {field("code", "Code", "TWR-D")}{field("floors", "Floors", "6", "number")}
            {field("units", "Units", "20", "number")}{field("incharge", "In charge", "Name")}
            <div className="col-span-2">{field("phone", "In-charge phone", "98xxxxxxxx")}</div>
          </> : <>
            <div className="col-span-2">{field("name", "Company", "Indus Legal LLP")}</div>
            {field("code", "Code", "INDUS-06")}
            <div className="flex flex-col gap-1.5">
              <Label>Floor</Label>
              <Select value={floorId} onValueChange={(v) => setFloorId(String(v))}>
                <SelectTrigger aria-label="Floor" className="w-full"><SelectValue>{(v: string) => floors.find((f) => f.id === v)?.name}</SelectValue></SelectTrigger>
                <SelectContent>{floors.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {field("unit", "Unit", "Suite 310")}{field("contact", "Contact person", "Name")}
            {field("phone", "Phone", "98xxxxxxxx")}{field("email", "Email", "name@company.in", "email")}
          </>}
          <div className="col-span-2 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit"><Plus data-icon="inline-start" /> Add</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
