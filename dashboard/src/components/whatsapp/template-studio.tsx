"use client";

import { useState } from "react";
import { Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/gf/status-pill";
import { Mono } from "@/components/gf/mono";
import { PhoneFrame } from "@/components/campus/phone-frame";
import { BOT, scenePhoto } from "@/lib/whatsapp/bot";
import { LANG_LABEL, render, TEMPLATE_STATUS, validateTemplate, variablesIn, type Lang, type WaTemplate } from "@/lib/whatsapp/templates";
import { cn } from "cn";

const AUDIENCE = { guard: "Guards", supervisor: "Supervisors", host: "Tenant hosts" } as const;

/** Template list on the left, editor and a live phone preview on the right. */
export function TemplateStudio({ initial }: { initial: WaTemplate[] }) {
  const [templates, setTemplates] = useState(initial);
  const [id, setId] = useState(initial[0]!.id);
  const t = templates.find((x) => x.id === id)!;
  const errors = validateTemplate(t);
  const vars = variablesIn(t.body);
  const locked = t.status === "approved" || t.status === "pending";
  const update = (patch: Partial<WaTemplate>) => setTemplates((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  return (
    <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_auto]">
      <div className="flex flex-col gap-2">
        <Button variant="outline" size="sm" onClick={() => {
          const n: WaTemplate = { id: `t-new-${Date.now()}`, name: "new_alert", category: "UTILITY", language: "en", status: "draft", audience: "guard", header: null, body: "Hello {{1}}, ", footer: "GuardWatch AI", buttons: [{ type: "quick_reply", text: "OK" }], samples: ["Ramesh"], variables: ["Guard first name"] };
          setTemplates((xs) => [n, ...xs]);
          setId(n.id);
        }}><Plus data-icon="inline-start" /> New template</Button>
        <ul className="flex max-h-[620px] flex-col gap-1 overflow-auto" aria-label="Templates">
          {templates.map((x) => (
            <li key={x.id}>
              <button type="button" onClick={() => setId(x.id)} aria-current={x.id === id ? "true" : undefined} className={cn("flex w-full flex-col gap-1 rounded-lg border px-3 py-2 text-left transition-colors", x.id === id ? "border-primary/50 bg-primary/5" : "hover:bg-muted/50")}>
                <span className="flex items-center justify-between gap-2"><Mono className="truncate text-xs font-medium">{x.name}</Mono><StatusPill tone={TEMPLATE_STATUS[x.status].tone} size="xs">{TEMPLATE_STATUS[x.status].label}</StatusPill></span>
                <span className="text-xs text-muted-foreground">{AUDIENCE[x.audience]} · {LANG_LABEL[x.language]} · {x.category.toLowerCase()}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><Mono className="font-medium">{t.name}</Mono><StatusPill tone={TEMPLATE_STATUS[t.status].tone} size="xs">{TEMPLATE_STATUS[t.status].label}</StatusPill></div>
          {locked && <span className="text-xs text-muted-foreground">Approved templates are locked; duplicate to change the wording.</span>}
        </div>
        {t.rejection_reason && <p className="rounded-md bg-absent/10 px-3 py-2 text-xs text-absent">Meta: {t.rejection_reason}</p>}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="col-span-2 flex flex-col gap-1.5"><Label htmlFor="tp-name">Name</Label><Input id="tp-name" disabled={locked} value={t.name} onChange={(e) => update({ name: e.target.value })} className="font-mono" /></div>
          <div className="flex flex-col gap-1.5">
            <Label>Language</Label>
            <Select value={t.language} onValueChange={(v) => update({ language: v as Lang })} disabled={locked}>
              <SelectTrigger aria-label="Language" className="w-full"><SelectValue>{(v: string) => LANG_LABEL[v as Lang]}</SelectValue></SelectTrigger>
              <SelectContent>{(Object.keys(LANG_LABEL) as Lang[]).map((l) => <SelectItem key={l} value={l}>{LANG_LABEL[l]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Sent to</Label>
            <Select value={t.audience} onValueChange={(v) => update({ audience: v as WaTemplate["audience"] })} disabled={locked}>
              <SelectTrigger aria-label="Audience" className="w-full"><SelectValue>{(v: string) => AUDIENCE[v as keyof typeof AUDIENCE]}</SelectValue></SelectTrigger>
              <SelectContent>{Object.entries(AUDIENCE).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2 flex flex-col gap-1.5 md:col-span-4"><Label htmlFor="tp-header">Header {t.header_type === "image" && <span className="text-muted-foreground">(image: {t.header})</span>}</Label><Input id="tp-header" disabled={locked || t.header_type === "image"} value={t.header ?? ""} onChange={(e) => update({ header: e.target.value || null })} placeholder="Optional, 60 characters" /></div>
          <div className="col-span-2 flex flex-col gap-1.5 md:col-span-4">
            <Label htmlFor="tp-body">Body <span className="text-muted-foreground">· {t.body.length}/1024 · use {"{{1}}"}, {"{{2}}"}… for values</span></Label>
            <Textarea id="tp-body" disabled={locked} rows={4} value={t.body} onChange={(e) => update({ body: e.target.value })} />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5 md:col-span-4"><Label htmlFor="tp-footer">Footer</Label><Input id="tp-footer" disabled={locked} value={t.footer ?? ""} onChange={(e) => update({ footer: e.target.value || null })} /></div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Example values (Meta reviews these)</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {vars.map((n) => (
              <div key={n} className="flex items-center gap-2">
                <Mono className="w-10 text-xs text-muted-foreground">{`{{${n}}}`}</Mono>
                <Input aria-label={`Example for {{${n}}}`} value={t.samples[n - 1] ?? ""} onChange={(e) => { const s = [...t.samples]; s[n - 1] = e.target.value; update({ samples: s }); }} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Buttons</Label>
          {t.buttons.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <StatusPill tone="neutral" size="xs" dot={false}>{b.type === "quick_reply" ? "Quick reply" : b.type === "url" ? "Link" : "Call"}</StatusPill>
              <Input aria-label={`Button ${i + 1}`} disabled={locked} value={b.text} onChange={(e) => update({ buttons: t.buttons.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} className="max-w-[240px]" />
              {!locked && <Button size="icon-sm" variant="ghost" aria-label="Remove button" onClick={() => update({ buttons: t.buttons.filter((_, j) => j !== i) })}><Trash2 /></Button>}
            </div>
          ))}
          {!locked && t.buttons.length < 3 && <Button size="sm" variant="ghost" className="self-start" onClick={() => update({ buttons: [...t.buttons, { type: "quick_reply", text: "Reply" }] })}><Plus data-icon="inline-start" /> Add quick reply</Button>}
        </div>

        {errors.length > 0 && !locked && <ul className="rounded-md border border-half-day/40 bg-half-day/10 p-2 text-xs" aria-label="Problems">{errors.map((e) => <li key={e}>• {e}</li>)}</ul>}
        {!locked && (
          <div className="flex justify-end">
            <Button disabled={errors.length > 0} onClick={() => { update({ status: "pending", rejection_reason: undefined }); toast.success(`${t.name} submitted to Meta`, { description: "Utility templates are usually reviewed within minutes." }); }}><Send data-icon="inline-start" /> Submit for approval</Button>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="eyebrow">Preview</span>
        <PhoneFrame
          title={BOT.name}
          label="Template preview"
          lines={[{
            id: "p", from: "us", header: t.header_type === "image" ? null : t.header, image: t.header_type === "image" ? scenePhoto("fire", "Photo of the scene") : null,
            text: render(t.body, t.samples), footer: t.footer, time: "14:02",
            buttons: t.buttons.map((b) => ({ kind: b.type === "quick_reply" ? "reply" : b.type === "url" ? "url" : "call", text: b.text })),
          }]}
        />
      </div>
    </div>
  );
}
