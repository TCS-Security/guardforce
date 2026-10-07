"use client";

import { useState } from "react";
import { Camera, Check, CheckCircle2, Download, ListChecks, LocateFixed, MapPinOff, MessageCircle, Plus, QrCode as QrIcon, RotateCcw, ScanLine, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/gf/stat-tile";
import { StatusPill } from "@/components/gf/status-pill";
import { Section } from "@/components/gf/section";
import { Mono } from "@/components/gf/mono";
import { EmptyState } from "@/components/gf/empty-state";
import { FilterBar, FilterField } from "@/components/gf/filter-bar";
import { Code, PersonCell } from "./campus-bits";
import { LiveCamera } from "./live-camera";
import { useDemoNow } from "./use-demo-now";
import { failActions, floorStates, INSPECTION_STATE, ledgerStats, OWNER_LABEL, score, submitBlocker, SURVEY_STEPS, type SurveyStep } from "@/lib/campus/inspections";
import { checkFence, fmtLatLng, offsetM } from "@/lib/campus/geo";
import { downloadCsv } from "@/lib/campus/csv";
import { fmtDateTime, fmtTime } from "@/lib/domain/format";
import type { CampusData, ChecklistItem, Floor, FloorInspection } from "@/lib/campus/types";
import { cn } from "cn";

export function InspectionBoard({ data, inspector, canSignOff }: { data: CampusData; inspector: { id: string; name: string }; canSignOff: boolean }) {
  const now = useDemoNow(data.now);
  const [inspections, setInspections] = useState(data.inspections);
  const [checklist, setChecklist] = useState(data.checklist);
  const [surveying, setSurveying] = useState<Floor | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [floorFilter, setFloorFilter] = useState("all");

  const states = floorStates(data.floors, inspections, data.today, now);
  const pending = inspections.filter((i) => i.state === "pending_approval");
  const stats = ledgerStats(inspections, checklist.length);
  const guardName = (id: string) => data.deployments.find((d) => d.guard.id === id)?.guard.full_name ?? (id === inspector.id ? inspector.name : "Guard");
  const floor = (id: string) => data.floors.find((f) => f.id === id)!;
  const ledger = [...inspections].filter((i) => floorFilter === "all" || i.floor_id === floorFilter).sort((a, b) => b.finished_at.localeCompare(a.finished_at));

  function signOff(i: FloorInspection, ok: boolean) {
    setInspections((xs) => xs.map((x) => (x.id === i.id ? { ...x, state: ok ? "completed" : "missed", signed_off_by: ok ? "You" : null } : x)));
    toast[ok ? "success" : "warning"](ok ? `${i.ref} signed off` : `${i.ref} sent back`, { description: ok ? "It counts towards today's compliance." : `${guardName(i.inspector_id)} was asked on WhatsApp to re-inspect ${floor(i.floor_id).name}.` });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Done today" value={`${states.filter((s) => s.state === "completed" || s.state === "pending_approval").length}/${states.length}`} hint={`${states.filter((s) => s.state === "due").length} still due`} style={{ ["--i" as string]: 1 }} />
        <StatTile label="Awaiting sign-off" value={pending.length} tone={pending.length ? "half-day" : "neutral"} hint="Supervisor approves each survey" style={{ ["--i" as string]: 2 }} />
        <StatTile label="Compliance, 7 days" value={stats.compliance == null ? "—" : `${stats.compliance}%`} hint={`${stats.flagged} surveys found a fault`} style={{ ["--i" as string]: 3 }} />
        <StatTile label="Average survey" value={stats.avgMin == null ? "—" : `${stats.avgMin} min`} hint="QR scan to submit" style={{ ["--i" as string]: 4 }} />
        <StatTile label="Geofence verified" value={stats.gpsPct == null ? "—" : `${stats.gpsPct}%`} tone="present" hint="Every survey inside its radius" style={{ ["--i" as string]: 5 }} />
      </div>

      <Tabs defaultValue="today" className="reveal gap-4" style={{ ["--i" as string]: 6 }}>
        <TabsList className="h-9">
          <TabsTrigger value="today" className="px-3">Today’s floors</TabsTrigger>
          <TabsTrigger value="signoff" className="px-3">Sign-off {pending.length > 0 && <span className="ml-1 rounded-full bg-half-day px-1.5 font-mono text-[10px] text-half-day-foreground">{pending.length}</span>}</TabsTrigger>
          <TabsTrigger value="ledger" className="px-3">Audit ledger</TabsTrigger>
          <TabsTrigger value="checklist" className="px-3">Checklist</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="flex flex-col gap-3">
          <p className="rounded-lg border border-dashed bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
            <span className="eyebrow mr-1.5 text-foreground">Protocol</span>
            Every floor survey is four proofs in order — scan the floor’s QR, stand inside its fence, take a live photo, answer the checklist. A failed check needs a photo and opens a task for whoever fixes it.
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Floors">
            {states.map(({ floor: f, state, latest, last }) => {
              const tower = data.towers.find((t) => t.id === f.tower_id);
              const inspectorName = data.deployments.find((d) => d.floor_ids.includes(f.id))?.guard.full_name ?? inspector.name;
              const faults = latest ? Object.values(latest.answers).filter((a) => !a).length : 0;
              return (
                <div key={f.id} data-testid={`floor-${f.code}`} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-display text-base font-semibold">{f.name}</div>
                      <div className="text-xs text-muted-foreground"><Code>{f.code}</Code> · {tower?.name}</div>
                    </div>
                    <StatusPill tone={INSPECTION_STATE[state].tone} size="xs">{INSPECTION_STATE[state].label}</StatusPill>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <dt className="text-muted-foreground">Registered GPS</dt><dd><Mono className="text-xs">{fmtLatLng(f)}</Mono></dd>
                    <dt className="text-muted-foreground">Fence radius</dt><dd><Mono className="text-xs">±{f.radius_m} m</Mono></dd>
                    <dt className="text-muted-foreground">Last survey</dt><dd>{last ? fmtDateTime(last.finished_at) : "Never"}</dd>
                    <dt className="text-muted-foreground">Inspector</dt><dd className="truncate">{inspectorName}</dd>
                  </dl>
                  {latest && <div className={cn("rounded-md px-2.5 py-1.5 text-xs", faults ? "bg-signal/10 text-signal" : "bg-present/10 text-present")}>{score(checklist, latest.answers).label}{faults ? ` · ${faults} fault${faults > 1 ? "s" : ""} raised as tasks` : " · nothing to fix"}</div>}
                  <Button className="mt-auto" variant={latest ? "outline" : "default"} onClick={() => setSurveying(f)}>
                    {latest ? <><RotateCcw data-icon="inline-start" /> Re-inspect floor</> : <><ScanLine data-icon="inline-start" /> Start 4-step survey</>}
                  </Button>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="signoff">
          {pending.length === 0 ? <EmptyState icon={<CheckCircle2 />} title="Nothing to sign off" description="Submitted surveys wait here for a supervisor." /> : (
            <ul className="flex flex-col gap-3" aria-label="Surveys awaiting sign-off">
              {pending.map((i) => {
                const fails = checklist.filter((c) => i.answers[c.id] === false);
                return (
                  <li key={i.id} className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4">
                    <div className="min-w-[220px] flex-1">
                      <div className="flex items-center gap-2"><span className="font-display text-base font-semibold">{floor(i.floor_id).name}</span><Code>{i.ref}</Code></div>
                      <div className="text-xs text-muted-foreground">{guardName(i.inspector_id)} · {fmtTime(i.started_at)}–{fmtTime(i.finished_at)} · GPS {i.gps_distance_m} m from checkpoint · {score(checklist, i.answers).label}</div>
                      {fails.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{fails.map((c) => <StatusPill key={c.id} tone="signal" size="xs">{c.code} {c.fail_label}</StatusPill>)}</div>}
                      <div className="mt-1 text-xs italic text-muted-foreground">“{i.remarks}”</div>
                    </div>
                    {canSignOff && <div className="flex gap-2">
                      <Button variant="outline" onClick={() => signOff(i, false)}><Undo2 data-icon="inline-start" /> Send back</Button>
                      <Button onClick={() => signOff(i, true)}><Check data-icon="inline-start" /> Sign off</Button>
                    </div>}
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="ledger" className="flex flex-col gap-3">
          <FilterBar>
            <FilterField label="Floor">
              <Select value={floorFilter} onValueChange={(v) => setFloorFilter(String(v))}>
                <SelectTrigger aria-label="Filter by floor" className="w-[220px]"><SelectValue>{(v: string) => (v === "all" ? "All floors" : floor(v).name)}</SelectValue></SelectTrigger>
                <SelectContent><SelectItem value="all">All floors</SelectItem>{data.floors.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
              </Select>
            </FilterField>
            <Button variant="outline" className="ml-auto" onClick={() => {
              downloadCsv(`floor-inspections-${data.today}.csv`, ledger.map((i) => ({
                Audit: i.ref, Floor: floor(i.floor_id).name, Code: floor(i.floor_id).code, Inspector: guardName(i.inspector_id), Start: fmtDateTime(i.started_at), Finish: fmtDateTime(i.finished_at),
                "Minutes": Math.round((new Date(i.finished_at).getTime() - new Date(i.started_at).getTime()) / 60_000), Score: score(checklist, i.answers).label,
                "GPS distance (m)": i.gps_distance_m, "GPS verified": i.gps_ok ? "Yes" : "No", "Signed off": i.signed_off_by ?? "", Status: INSPECTION_STATE[i.state].label, Remarks: i.remarks,
              })));
              toast.success("Inspection ledger exported");
            }}><Download data-icon="inline-start" /> Export</Button>
          </FilterBar>
          <Section bodyClassName="p-0">
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full text-sm" aria-label="Inspection ledger">
                <thead className="sticky top-0 z-10 bg-card"><tr className="eyebrow border-b text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-normal"><th>Audit</th><th>Inspector</th><th>Floor</th><th>Started</th><th>Took</th><th>Score</th><th>GPS</th><th>Status</th></tr></thead>
                <tbody className="divide-y">
                  {ledger.map((i) => {
                    const sc = score(checklist, i.answers);
                    return (
                      <tr key={i.id} className="hover:bg-muted/50">
                        <td className="px-3 py-2"><Code>{i.ref}</Code></td>
                        <td className="px-3 py-2"><PersonCell name={guardName(i.inspector_id)} /></td>
                        <td className="px-3 py-2 text-xs">{floor(i.floor_id).name}</td>
                        <td className="px-3 py-2"><Mono className="text-xs">{fmtDateTime(i.started_at)}</Mono></td>
                        <td className="px-3 py-2"><Mono className="text-xs">{Math.round((new Date(i.finished_at).getTime() - new Date(i.started_at).getTime()) / 60_000)} min</Mono></td>
                        <td className="px-3 py-2"><StatusPill tone={sc.ok === sc.total ? "present" : "signal"} size="xs" dot={false}>{sc.label}</StatusPill></td>
                        <td className="px-3 py-2"><Mono className="text-xs">{i.gps_distance_m} m ✓</Mono></td>
                        <td className="px-3 py-2"><StatusPill tone={INSPECTION_STATE[i.state].tone} size="xs">{INSPECTION_STATE[i.state].label}</StatusPill></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="checklist">
          <Section title="Daily checklist" description={`${checklist.length} questions every floor survey answers`} actions={<Button size="sm" variant="outline" onClick={() => setAddingItem(true)}><Plus data-icon="inline-start" /> Add question</Button>} bodyClassName="p-0">
            <table className="w-full text-sm" aria-label="Checklist">
              <thead><tr className="eyebrow border-b text-left [&>th]:px-3 [&>th]:py-2 [&>th]:font-normal"><th>Code</th><th>Category</th><th>Question</th><th>Answers</th><th>On a fail</th><th className="text-right">Photo needed</th></tr></thead>
              <tbody className="divide-y">
                {checklist.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/50">
                    <td className="px-3 py-2"><Code>{c.code}</Code></td>
                    <td className="px-3 py-2"><StatusPill tone="olive" size="xs" dot={false}>{c.category}</StatusPill></td>
                    <td className="px-3 py-2">{c.question}</td>
                    <td className="px-3 py-2 text-xs"><span className="text-present">{c.ok_label}</span> / <span className="text-signal">{c.fail_label}</span></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">Task + WhatsApp to {OWNER_LABEL[c.owner]}</td>
                    <td className="px-3 py-2 text-right"><Switch checked={c.photo_on_fail} onCheckedChange={(v) => setChecklist((xs) => xs.map((x) => (x.id === c.id ? { ...x, photo_on_fail: v } : x)))} aria-label={`Photo needed for ${c.code}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </TabsContent>
      </Tabs>

      {surveying && (
        <SurveyWizard
          floor={surveying} data={data} checklist={checklist} inspector={inspector} now={now}
          onClose={() => setSurveying(null)}
          onSubmit={(i) => setInspections((xs) => [...xs, { ...i, ref: `INS-${8861 + xs.length}` }])}
        />
      )}
      <AddItemDialog open={addingItem} onOpenChange={setAddingItem} count={checklist.length} onAdd={(c) => { setChecklist((xs) => [...xs, c]); toast.success(`${c.code} added to every floor survey`); }} />
    </>
  );
}

/* -------------------------------------------------------------------- wizard */

function SurveyWizard({ floor, data, checklist, inspector, now, onClose, onSubmit }: {
  floor: Floor; data: CampusData; checklist: ChecklistItem[]; inspector: { id: string; name: string }; now: Date;
  onClose: () => void; onSubmit: (i: FloorInspection) => void;
}) {
  const [step, setStep] = useState<SurveyStep>("qr");
  const [scanned, setScanned] = useState(false);
  const [fix, setFix] = useState<{ lat: number; lng: number; accuracy_m: number } | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [faultPhotos, setFaultPhotos] = useState<Record<string, boolean>>({});
  const [remarks, setRemarks] = useState("");
  const [done, setDone] = useState<ReturnType<typeof failActions> | null>(null);
  const [startedAt] = useState(() => now.toISOString());
  const fence = fix ? checkFence(floor, fix) : null;
  const idx = SURVEY_STEPS.findIndex((s) => s.key === step);
  const blocker = submitBlocker(checklist, answers, faultPhotos);
  const actions = failActions(checklist, answers, faultPhotos, floor.name);
  const otherFloor = data.floors.find((f) => f.id !== floor.id)!;

  function submit() {
    if (blocker) return toast.error(blocker);
    onSubmit({
      id: `in-${Date.now()}`, ref: "", floor_id: floor.id, inspector_id: inspector.id, started_at: startedAt, finished_at: now.toISOString(),
      gps_distance_m: fence?.distance_m ?? 0, gps_ok: true, answers, remarks: remarks || "No remarks.", state: "pending_approval", signed_off_by: null,
    });
    setDone(actions);
    toast.success(`${floor.name} survey submitted`, { description: actions.length ? `${actions.length} task${actions.length > 1 ? "s" : ""} opened and owners told on WhatsApp.` : "Sent to the supervisor for sign-off." });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Floor survey: {floor.name}</DialogTitle>
          <DialogDescription>Step {Math.min(idx + 1, 4)} of 4 · inspector {inspector.name} · checkpoint <Mono className="text-xs">{floor.code}</Mono></DialogDescription>
        </DialogHeader>

        <ol className="grid grid-cols-4 gap-2" aria-label="Survey steps">
          {SURVEY_STEPS.map((s, i) => {
            const passed = i < idx || !!done;
            return (
              <li key={s.key} aria-current={s.key === step && !done ? "step" : undefined} className="flex flex-col gap-1">
                <span className={cn("h-1.5 rounded-full", passed ? "bg-present" : s.key === step ? "bg-primary" : "bg-muted")} />
                <span className={cn("text-xs", s.key === step ? "font-medium" : "text-muted-foreground")}>{i + 1}. {s.label}</span>
              </li>
            );
          })}
        </ol>

        {done ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-present/10 p-3 text-sm text-present"><CheckCircle2 className="size-4" /> Submitted — {score(checklist, answers).label}. Waiting for supervisor sign-off.</div>
            {done.length > 0 ? (
              <ul className="flex flex-col gap-2" aria-label="What the faults set in motion">
                {done.map((a) => (
                  <li key={a.item.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center gap-2"><ListChecks className="size-4 text-primary" /><span className="font-medium">Task opened:</span> {a.task}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><MessageCircle className="size-3.5 text-present" /> WhatsApp bot sent the photo and the task to the {a.notify.toLowerCase()}.</div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Every check passed; nothing to fix.</p>}
            <div className="flex justify-end"><Button onClick={onClose}>Done</Button></div>
          </div>
        ) : step === "qr" ? (
          <div className="flex flex-col gap-3">
            <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-lg bg-ink">
              <div className={cn("absolute inset-x-12 top-1/2 h-0.5 bg-present shadow-[0_0_12px_var(--present)]", !scanned && "animate-pulse")} />
              <div className={cn("flex size-36 items-center justify-center rounded-lg border-2 border-dashed", scanned ? "border-present" : "border-white/60")}>
                {scanned ? <CheckCircle2 className="size-10 text-present" /> : <QrIcon className="size-10 text-white/40" />}
              </div>
              <span className="absolute bottom-2 text-xs text-white/70">{scanned ? `Checkpoint ${floor.code} verified` : `Align with checkpoint QR ${floor.code}`}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setScanned(true); toast.success(`QR scanned: ${floor.code} verified`); }} disabled={scanned}><ScanLine data-icon="inline-start" /> Simulate scan</Button>
                <Button variant="ghost" onClick={() => toast.error(`That is ${otherFloor.code} (${otherFloor.name}). Walk to ${floor.name}.`)} disabled={scanned}>Scan the wrong floor</Button>
              </div>
              <Button disabled={!scanned} onClick={() => setStep("gps")}>Next: geofence</Button>
            </div>
          </div>
        ) : step === "gps" ? (
          <div className="flex flex-col gap-3">
            <table className="w-full text-sm" aria-label="Geofence check">
              <tbody className="divide-y [&>tr>td]:py-2 [&>tr>td:first-child]:text-muted-foreground">
                <tr><td>Floor registered GPS</td><td><Mono>{fmtLatLng(floor)}</Mono></td></tr>
                <tr><td>Your phone</td><td><Mono>{fix ? `${fmtLatLng(fix)} (±${fix.accuracy_m} m)` : "—"}</Mono></td></tr>
                <tr><td>Allowed radius</td><td><Mono>±{floor.radius_m} m</Mono></td></tr>
                <tr><td>Distance</td><td><Mono>{fence ? `${fence.distance_m} m` : "—"}</Mono></td></tr>
                <tr><td>Verification</td><td>{!fence ? <StatusPill tone="neutral" size="xs">Not checked</StatusPill> : fence.inside ? <StatusPill tone="present" size="xs">Inside the fence</StatusPill> : <StatusPill tone="absent" size="xs">Outside — {fence.distance_m - fence.allowed_m} m too far</StatusPill>}</td></tr>
              </tbody>
            </table>
            <div className="flex flex-wrap justify-between gap-2">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { const p = offsetM(floor, 9, -6); setFix({ ...p, accuracy_m: 6 }); }}><LocateFixed data-icon="inline-start" /> Get my location</Button>
                <Button variant="ghost" onClick={() => { const p = offsetM(floor, 70, 40); setFix({ ...p, accuracy_m: 9 }); toast.error("Outside the floor's fence — the survey cannot continue from here."); }}><MapPinOff data-icon="inline-start" /> Simulate GPS failure</Button>
              </div>
              <Button disabled={!fence?.inside} onClick={() => setStep("photo")}>Next: live photo</Button>
            </div>
          </div>
        ) : step === "photo" ? (
          <div className="flex flex-col gap-3">
            <LiveCamera label="Live photo of the floor" value={photo} onCapture={setPhoto} aspect="aspect-[16/9]" watermark={{ by: inspector.name, place: `${floor.name} · ${floor.code}`, gps: fix ? `${fmtLatLng(fix)} ±${fix.accuracy_m} m` : undefined }} />
            <div className="flex justify-end"><Button disabled={!photo} onClick={() => setStep("checklist")}>Next: checklist</Button></div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <Button size="xs" variant="ghost" onClick={() => setAnswers(Object.fromEntries(checklist.map((c) => [c.id, true])))}>Mark all OK</Button>
            </div>
            <ol className="flex flex-col divide-y rounded-lg border" aria-label="Checklist">
              {checklist.map((c, i) => {
                const a = answers[c.id];
                return (
                  <li key={c.id} className={cn("flex flex-col gap-2 p-3", a === false && "bg-signal/5")}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 text-sm"><span className="font-mono text-xs text-muted-foreground">{i + 1}.</span> {c.question} <StatusPill tone="olive" size="xs" dot={false} className="ml-1">{c.category}</StatusPill></div>
                      <div className="flex gap-1" role="group" aria-label={c.code}>
                        <Button size="sm" variant={a === true ? "default" : "outline"} aria-pressed={a === true} onClick={() => setAnswers((x) => ({ ...x, [c.id]: true }))}>{c.ok_label}</Button>
                        <Button size="sm" variant={a === false ? "destructive" : "outline"} aria-pressed={a === false} onClick={() => setAnswers((x) => ({ ...x, [c.id]: false }))}>{c.fail_label}</Button>
                      </div>
                    </div>
                    {a === false && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {c.photo_on_fail && (faultPhotos[c.id]
                          ? <StatusPill tone="present" size="xs"><Camera className="size-3" /> Photo attached</StatusPill>
                          : <Button size="xs" variant="outline" onClick={() => setFaultPhotos((x) => ({ ...x, [c.id]: true }))}><Camera data-icon="inline-start" /> Add photo of the fault</Button>)}
                        <span className="text-muted-foreground">→ task for the {OWNER_LABEL[c.owner].toLowerCase()}, sent on WhatsApp</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="flex flex-col gap-1.5"><Label htmlFor="sv-remarks">Remarks</Label><Textarea id="sv-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="All exits clear. DB panels locked." /></div>
            {blocker && <p className="text-xs text-half-day-foreground dark:text-half-day" role="status">{blocker}</p>}
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}><X data-icon="inline-start" /> Cancel</Button><Button disabled={!!blocker} onClick={submit}><Check data-icon="inline-start" /> Submit survey</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddItemDialog({ open, onOpenChange, count, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; count: number; onAdd: (c: ChecklistItem) => void }) {
  const [owner, setOwner] = useState<ChecklistItem["owner"]>("facility");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add a checklist question</DialogTitle><DialogDescription>Every floor survey will ask it from the next round.</DialogDescription></DialogHeader>
        <form className="grid grid-cols-2 gap-3" action={(fd) => {
          const q = String(fd.get("q") ?? "").trim();
          if (q.length < 5) { toast.error("Write the question."); return; }
          onAdd({ id: `ck-${Date.now()}`, code: `CHK-${String(count + 1).padStart(2, "0")}`, category: String(fd.get("cat") || "General"), question: q, ok_label: String(fd.get("ok") || "OK"), fail_label: String(fd.get("fail") || "Not OK"), required: true, photo_on_fail: true, owner });
          onOpenChange(false);
        }}>
          <div className="col-span-2 flex flex-col gap-1.5"><Label htmlFor="ck-q">Question</Label><Input id="ck-q" name="q" placeholder="Lift emergency phone working" /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="ck-cat">Category</Label><Input id="ck-cat" name="cat" placeholder="Lifts" /></div>
          <div className="flex flex-col gap-1.5">
            <Label>On a fail, tell</Label>
            <Select value={owner} onValueChange={(v) => setOwner(v as ChecklistItem["owner"])}>
              <SelectTrigger aria-label="Owner" className="w-full"><SelectValue>{(v: string) => OWNER_LABEL[v as ChecklistItem["owner"]]}</SelectValue></SelectTrigger>
              <SelectContent>{(Object.keys(OWNER_LABEL) as ChecklistItem["owner"][]).map((k) => <SelectItem key={k} value={k}>{OWNER_LABEL[k]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="ck-ok">Pass answer</Label><Input id="ck-ok" name="ok" placeholder="Working" /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="ck-fail">Fail answer</Label><Input id="ck-fail" name="fail" placeholder="Dead" /></div>
          <div className="col-span-2 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit"><Plus data-icon="inline-start" /> Add</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
