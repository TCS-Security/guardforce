"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import {
  Building, ExternalLink, UserSearch, Mail, MapPin, MessageCircle, Navigation, Phone, PhoneCall, Plus, Search, ShieldQuestion,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormAlert } from "@/components/gf/form-alert";
import { Eyebrow } from "@/components/gf/eyebrow";
import { fmtDate, fmtDateTime } from "@/lib/domain/format";
import {
  CALL_OUTCOMES, LOST_REASONS, SEGMENTS, STAGES, assessLead, directionsUrl, displayReasons, fmtRupeesShort, linkedinSearchUrl, lookupGate,
  mapsSearchUrl, pitchLines, sizeText, sortNumbers, sourceName, telHref, whatsappHref, RUPEES_PER_GUARD_MONTH,
  type CallOutcome, type IncumbentSoftware, type LeadFacts, type Reason, type Segment, type SizeUnit, type Stage,
} from "@/lib/domain/sales";
import type { LeadDetail, LeadNumber } from "@/lib/data/sales";
import {
  addContact, findMobile, logNote, makeSite, moveLead, setDoNotCall, setFollowUp, setOwner, updateLeadFacts, type ActionState,
} from "@/app/(app)/sales/actions";
import { LabelPill, SOFTWARE_TEXT, segmentLabel } from "./bits";
import { LeadMap } from "./lead-map";

type Props = {
  detail: LeadDetail;
  team: { id: string; full_name: string }[];
  closeHref: string;
  canWrite: boolean;
  canLookup: boolean;
  canMakeSite: boolean;
  timezone: string;
};

/**
 * The lead card. Slides in from the right on a laptop, full screen on a phone. It answers, in
 * order: who and where, why this lead, whom to call on what number, what happened and what's next.
 */
export function LeadCard({ detail, team, closeHref, canWrite, canLookup, canMakeSite, timezone }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const { lead } = detail;

  function close() {
    setOpen(false);
    router.push(closeHref, { scroll: false });
  }

  const facts: LeadFacts = {
    segment: lead.segment as Segment,
    size_value: lead.size_value,
    size_unit: lead.size_unit as SizeUnit | null,
    completion_on: lead.completion_on,
    tender_closes_on: lead.tender_closes_on,
    tender_ends_on: lead.tender_ends_on,
    tender_value_inr: lead.tender_value_inr,
    tender_guards: lead.tender_guards,
    incumbent_agency: lead.incumbent_agency,
    incumbent_software: lead.incumbent_software as IncumbentSoftware | null,
    source: lead.source,
  };
  const assessment = assessLead(facts);
  const reasons = displayReasons(lead.reasons, detail.near);
  const pitch = pitchLines(reasons, lead.segment as Segment);
  const size = sizeText(facts);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent
        side="right"
        className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[620px]"
        aria-label={`Lead: ${lead.name}`}
      >
        {/* A: who and where */}
        <SheetHeader className="gap-2 border-b bg-card px-5 pt-5 pb-4">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <LabelPill label={lead.label as "hot" | "warm" | "cold"} />
            <StageMenu leadId={lead.id} stage={lead.stage as Stage} disabled={!canWrite} />
          </div>
          <SheetTitle className="font-display text-2xl leading-tight font-semibold tracking-tight">{lead.name}</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {[segmentLabel(lead.segment), size, lead.locality ?? lead.city].filter(Boolean).join(" · ")}
          </SheetDescription>
          <div className="mt-1 grid grid-cols-2 gap-3">
            <OwnerMenu leadId={lead.id} ownerId={lead.owner?.id ?? null} team={team} disabled={!canWrite} />
            <FollowUpPicker leadId={lead.id} value={lead.next_follow_up} disabled={!canWrite} />
          </div>
        </SheetHeader>

        <div className="flex flex-col divide-y">
          {/* B: why this lead */}
          <CardSection title="Why this lead">
            {reasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Not much known yet. Find out which agency guards it, and roughly how many guards it has. Fill it in under “Current agency”.
              </p>
            ) : (
              <ul className="space-y-2" aria-label="Why this lead">
                {reasons.map((r, i) => (
                  <ReasonRow key={i} reason={r} />
                ))}
              </ul>
            )}
            {assessment.guardsKnown && assessment.guards > 0 && !reasons.some((r) => r.kind === "size") && lead.segment !== "agency" && (
              <p className="mt-2 text-xs text-muted-foreground">
                About {assessment.guards} guards (≈ {fmtRupeesShort(assessment.guards * RUPEES_PER_GUARD_MONTH)}/month), estimated.
              </p>
            )}
            <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-3">
              <Eyebrow className="mb-1.5">What to say</Eyebrow>
              <ul className="space-y-1.5 text-sm">
                {pitch.map((line, i) => (
                  <li key={i}>“{line}”</li>
                ))}
              </ul>
            </div>
          </CardSection>

          {/* C: people and numbers */}
          <PeopleSection detail={detail} canWrite={canWrite} canLookup={canLookup} assessment={assessment} timezone={timezone} />

          {/* D: location */}
          <CardSection title="Location">
            <p className="text-sm">{[lead.address, lead.locality, lead.city].filter(Boolean).join(", ") || "Address not known yet"}</p>
            {lead.lat != null && lead.lng != null ? (
              <>
                <LeadMap lat={lead.lat} lng={lead.lng} name={lead.name} sites={detail.nearbySites} className="mt-3 h-44 overflow-hidden rounded-md border" />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <a href={directionsUrl(lead.lat, lead.lng)} target="_blank" rel="noreferrer" className={linkBtn}>
                    <Navigation className="size-3.5" /> Directions
                  </a>
                  <a href={mapsSearchUrl(lead.name, lead.address, lead.lat, lead.lng)} target="_blank" rel="noreferrer" className={linkBtn}>
                    <MapPin className="size-3.5" /> Open in Google Maps
                  </a>
                  {lead.website && (
                    <a href={lead.website} target="_blank" rel="noreferrer" className={linkBtn}>
                      <ExternalLink className="size-3.5" /> Website
                    </a>
                  )}
                </div>
                {detail.near && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Nearest of your sites: {detail.near.site.name}, {(detail.near.meters / 1000).toFixed(1)} km away.
                  </p>
                )}
              </>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                <a href={mapsSearchUrl(lead.name, lead.address)} target="_blank" rel="noreferrer" className={linkBtn}>
                  <MapPin className="size-3.5" /> Find on Google Maps
                </a>
                {lead.website && (
                  <a href={lead.website} target="_blank" rel="noreferrer" className={linkBtn}>
                    <ExternalLink className="size-3.5" /> Website
                  </a>
                )}
              </div>
            )}
          </CardSection>

          {/* E: current agency */}
          <AgencySection detail={detail} canWrite={canWrite} />

          {/* F: log and history */}
          <HistorySection detail={detail} canWrite={canWrite} timezone={timezone} />

          {/* G: won / lost */}
          {canWrite && lead.stage !== "won" && lead.stage !== "lost" && (
            <CardSection title="Done with this lead?">
              <div className="flex flex-wrap gap-2">
                {canMakeSite && lead.segment !== "agency" && <MakeSiteButton leadId={lead.id} hasLocation={lead.lat != null && lead.lng != null} />}
                <LostButton leadId={lead.id} />
              </div>
            </CardSection>
          )}
          {lead.stage === "won" && lead.won_site_id && (
            <CardSection title="Won">
              <a href={`/sites/${lead.won_site_id}`} className="text-sm font-medium text-primary hover:underline">Open the site in GuardWatch →</a>
            </CardSection>
          )}
          {lead.stage === "lost" && (
            <CardSection title="Lost">
              <p className="text-sm text-muted-foreground">Reason: {lead.lost_reason ?? "not given"}. Move it back to a stage above to work it again.</p>
            </CardSection>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

const linkBtn =
  "inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-2.5 text-xs font-medium hover:bg-muted";

function CardSection({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="px-5 py-4" aria-label={title}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="font-mono text-[11px] font-medium tracking-[0.14em] text-foreground/70 uppercase">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

function ReasonRow({ reason }: { reason: Reason }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span className="mt-0.5 text-present" aria-hidden>✓</span>
      <span className="flex-1 leading-snug">{reason.text}</span>
      {reason.url ? (
        <a href={reason.url} target="_blank" rel="noreferrer" className="shrink-0 font-mono text-[11px] text-muted-foreground hover:text-foreground hover:underline">
          {reason.source} ↗
        </a>
      ) : (
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{reason.source}</span>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Header controls
// ---------------------------------------------------------------------------

function StageMenu({ leadId, stage, disabled }: { leadId: string; stage: Stage; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [askLost, setAskLost] = useState(false);
  function go(to: Stage, reason?: string) {
    if (to === "lost" && !reason) {
      setAskLost(true);
      return;
    }
    startTransition(async () => {
      const res = await moveLead(leadId, to, reason);
      if (res?.error) toast.error(res.error);
      setAskLost(false);
    });
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={stage} onValueChange={(v) => go(v as Stage)} disabled={disabled || pending}>
        <SelectTrigger size="sm" className="h-7 w-[130px]" aria-label="Stage">
          <SelectValue>{(v: string) => `Stage: ${STAGES.find((s) => s.key === v)?.label ?? v}`}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {askLost && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Why was it lost?">
          <span className="text-xs text-muted-foreground">Why?</span>
          {LOST_REASONS.map((r) => (
            <Button key={r} size="xs" variant="outline" onClick={() => go("lost", r)} disabled={pending}>{r}</Button>
          ))}
        </div>
      )}
    </div>
  );
}

function OwnerMenu({ leadId, ownerId, team, disabled }: { leadId: string; ownerId: string | null; team: { id: string; full_name: string }[]; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">Owner</Label>
      <Select
        value={ownerId ?? "none"}
        disabled={disabled || pending}
        onValueChange={(v) =>
          startTransition(async () => {
            const res = await setOwner(leadId, v === "none" ? null : (v as string));
            if (res?.error) toast.error(res.error);
          })
        }
      >
        <SelectTrigger className="w-full" aria-label="Owner">
          <SelectValue>{(v: string) => team.find((t) => t.id === v)?.full_name ?? "Nobody yet"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nobody yet</SelectItem>
          {team.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function FollowUpPicker({ leadId, value, disabled }: { leadId: string; value: string | null; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="lead-follow-up" className="text-xs text-muted-foreground">Next follow-up</Label>
      <Input
        id="lead-follow-up"
        type="date"
        defaultValue={value ?? ""}
        disabled={disabled || pending}
        onChange={(e) =>
          startTransition(async () => {
            const res = await setFollowUp(leadId, e.target.value || null);
            if (res?.error) toast.error(res.error);
          })
        }
        className="font-mono text-xs"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// People and numbers
// ---------------------------------------------------------------------------

function sourceLine(n: LeadNumber, timezone: string) {
  const from = n.source === "rep" ? "added by your team" : `from ${sourceName(n.source)}`;
  const tried =
    n.status === "worked" && n.last_tried_at ? `worked ${fmtDate(n.last_tried_at, timezone, "d MMM")}`
    : n.status === "no_answer" && n.last_tried_at ? `no answer ${fmtDate(n.last_tried_at, timezone, "d MMM")}`
    : n.status === "wrong" ? "wrong number"
    : null;
  return [from, tried].filter(Boolean).join(" · ");
}

function PeopleSection({
  detail,
  canWrite,
  canLookup,
  assessment,
  timezone,
}: {
  detail: LeadDetail;
  canWrite: boolean;
  canLookup: boolean;
  assessment: ReturnType<typeof assessLead>;
  timezone: string;
}) {
  const { lead, contacts, numbers } = detail;
  const [calling, setCalling] = useState<LeadNumber | null>(null);
  const [adding, setAdding] = useState(false);
  const seg = SEGMENTS[lead.segment as Segment] ?? SEGMENTS.other;
  const people = contacts.filter((c) => !c.do_not_call);
  const blocked = contacts.filter((c) => c.do_not_call);
  const mainNumbers = sortNumbers(numbers.filter((n) => !n.contact_id));
  const gate = lookupGate({
    label: lead.label as "hot" | "warm" | "cold",
    guards: assessment.guards,
    guardsKnown: assessment.guardsKnown,
    incumbentSoftware: lead.incumbent_software as IncumbentSoftware | null,
    timing: assessment.timing,
    hasMobile: numbers.some((n) => n.kind === "mobile" && n.status !== "wrong" && n.contact_id),
    usedThisMonth: detail.lookupsThisMonth,
  });

  return (
    <CardSection title="People to call">
      {people.length === 0 && (
        <p className="mb-3 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Who to ask for: </span>
          {seg.whoToAsk}
        </p>
      )}
      <ul className="space-y-3" aria-label="People">
        {people.map((c) => {
          const nums = sortNumbers(numbers.filter((n) => n.contact_id === c.id));
          return (
            <li key={c.id} className="rounded-md border bg-card p-3" data-contact={c.full_name}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{c.full_name}</div>
                  <div className="text-sm text-muted-foreground">{c.designation ?? "Role not known"}</div>
                </div>
                {canWrite && <DoNotCallLink leadId={lead.id} contactId={c.id} />}
              </div>
              <NumberList nums={nums} whatsappOk={c.whatsapp_ok} onCall={canWrite ? setCalling : undefined} timezone={timezone} />
              {nums.length === 0 && <p className="mt-1.5 text-xs text-muted-foreground">No number yet.</p>}
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {c.source === "rep" ? "Added by your team" : c.source === "linkedin" ? "From LinkedIn (added by your team)" : `From ${sourceName(c.source)}`}
              </p>
            </li>
          );
        })}
      </ul>

      {mainNumbers.length > 0 && (
        <div className="mt-4">
          <Eyebrow className="mb-1.5">Main numbers</Eyebrow>
          <NumberList nums={mainNumbers} whatsappOk={false} onCall={canWrite ? setCalling : undefined} timezone={timezone} />
        </div>
      )}

      {calling && <CallOutcomePanel leadId={lead.id} number={calling} onDone={() => setCalling(null)} />}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {canWrite && (
          <Button size="sm" variant="outline" onClick={() => setAdding((a) => !a)}>
            <Plus data-icon="inline-start" /> Add person
          </Button>
        )}
        <a href={linkedinSearchUrl(lead.name, seg.designations[0])} target="_blank" rel="noreferrer" className={linkBtn}>
          <UserSearch className="size-3.5" /> Search on LinkedIn
        </a>
        {canLookup && gate.show && <FindMobileButton leadId={lead.id} allowed={gate.allowed} why={gate.why} />}
      </div>
      {adding && <AddPersonForm leadId={lead.id} segment={lead.segment as Segment} onDone={() => setAdding(false)} />}

      {blocked.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Do not call: {blocked.map((b) => b.full_name).join(", ")}.
        </p>
      )}
    </CardSection>
  );
}

function NumberList({
  nums,
  whatsappOk,
  onCall,
  timezone,
}: {
  nums: LeadNumber[];
  whatsappOk: boolean;
  onCall?: (n: LeadNumber) => void;
  timezone: string;
}) {
  return (
    <ul className="mt-2 space-y-1.5">
      {nums.map((n) => {
        const wa = n.kind === "mobile" && whatsappOk ? whatsappHref(n.value) : null;
        const wrong = n.status === "wrong";
        return (
          <li key={n.id} className="flex flex-wrap items-center gap-x-2 gap-y-1" data-number={n.value}>
            {n.kind === "email" ? <Mail className="size-3.5 text-muted-foreground" /> : <Phone className="size-3.5 text-muted-foreground" />}
            <span className={cn("font-mono text-sm", wrong && "text-muted-foreground line-through")}>{n.value}</span>
            <span className="text-xs text-muted-foreground">
              {n.label ?? (n.kind === "mobile" ? "mobile" : n.kind === "office" ? "office" : "email")}
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              {n.kind === "email" ? (
                <a href={`mailto:${n.value}`} className={linkBtn}>Email</a>
              ) : (
                <a
                  href={telHref(n.value)}
                  className={cn(linkBtn, !wrong && "border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90")}
                  onClick={() => onCall?.(n)}
                >
                  <PhoneCall className="size-3.5" /> Call
                </a>
              )}
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" className={linkBtn}>
                  <MessageCircle className="size-3.5" /> WhatsApp
                </a>
              )}
            </span>
            <span className="w-full pl-5 text-[11px] text-muted-foreground">{sourceLine(n, timezone)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function CallOutcomePanel({ leadId, number, onDone }: { leadId: string; number: LeadNumber; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(logNote, undefined);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  useEffect(() => {
    if (state?.ok) {
      toast.success("Call logged");
      onDone();
    }
  }, [state, onDone]);
  const [inTwoDays] = useState(() => new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10));
  return (
    <form action={action} className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-3" aria-label="How did the call go?">
      <input type="hidden" name="lead_id" value={leadId} />
      <input type="hidden" name="kind" value="call" />
      <input type="hidden" name="number_id" value={number.id} />
      <input type="hidden" name="outcome" value={outcome ?? ""} />
      <div className="mb-2 text-sm font-medium">How did the call to {number.value} go?</div>
      <div className="flex flex-wrap gap-1.5">
        {CALL_OUTCOMES.map((o) => (
          <Button
            key={o.key}
            type="button"
            size="sm"
            variant={outcome === o.key ? "default" : "outline"}
            onClick={() => setOutcome(o.key)}
            aria-pressed={outcome === o.key}
          >
            {o.label}
          </Button>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_150px]">
        <Input name="body" placeholder="What did they say? (optional)" aria-label="Call note" />
        <Input name="next_follow_up" type="date" defaultValue={inTwoDays} aria-label="Next follow-up" className="font-mono text-xs" />
      </div>
      {state?.error && <FormAlert className="mt-2">{state.error}</FormAlert>}
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" disabled={pending || !outcome}>Save call</Button>
      </div>
    </form>
  );
}

function AddPersonForm({ leadId, segment, onDone }: { leadId: string; segment: Segment; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addContact, undefined);
  const [designation, setDesignation] = useState("");
  const options = (SEGMENTS[segment] ?? SEGMENTS.other).designations;
  useEffect(() => {
    if (state?.ok) {
      toast.success("Person added");
      onDone();
    }
  }, [state, onDone]);
  return (
    <form action={action} className="mt-3 flex flex-col gap-3 rounded-md border p-3" aria-label="Add person">
      <input type="hidden" name="lead_id" value={leadId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ap-name">Name</Label>
          <Input id="ap-name" name="full_name" required placeholder="Full name" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ap-designation">Designation</Label>
          <Input id="ap-designation" name="designation" list="ap-designations" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder={options[0]} />
          <datalist id="ap-designations">
            {options.map((o) => <option key={o} value={o} />)}
          </datalist>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ap-mobile">Mobile</Label>
          <Input id="ap-mobile" name="mobile" inputMode="tel" placeholder="98450 12345" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ap-office">Office phone</Label>
          <Input id="ap-office" name="office" inputMode="tel" placeholder="080 4123 4567" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ap-email">Email</Label>
          <Input id="ap-email" name="email" type="email" placeholder="name@company.com" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ap-linkedin">LinkedIn profile (optional)</Label>
          <Input id="ap-linkedin" name="linkedin" placeholder="https://linkedin.com/in/…" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="whatsapp_ok" /> They said it's OK to WhatsApp them
      </label>
      {state?.error && <FormAlert>{state.error}</FormAlert>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" disabled={pending}>Save person</Button>
      </div>
    </form>
  );
}

function DoNotCallLink({ leadId, contactId }: { leadId: string; contactId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  if (!confirm) {
    return (
      <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground hover:underline" onClick={() => setConfirm(true)}>
        Do not call
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[11px]">
      Hide for good?
      <Button
        size="xs"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await setDoNotCall(leadId, contactId);
            if (res?.error) toast.error(res.error);
          })
        }
      >
        Yes
      </Button>
      <Button size="xs" variant="ghost" onClick={() => setConfirm(false)}>No</Button>
    </span>
  );
}

function FindMobileButton({ leadId, allowed, why }: { leadId: string; allowed: boolean; why: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <span className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={!allowed || pending}
        onClick={() =>
          startTransition(async () => {
            const res = await findMobile(leadId);
            if (res?.error) toast.error(res.error);
            else toast.success(res?.message ?? "Number found");
          })
        }
      >
        <Search data-icon="inline-start" /> Find mobile number
      </Button>
      <span className="text-[11px] text-muted-foreground">{why}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Current agency
// ---------------------------------------------------------------------------

function AgencySection({ detail, canWrite }: { detail: LeadDetail; canWrite: boolean }) {
  const { lead } = detail;
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(updateLeadFacts, undefined);
  useEffect(() => {
    if (state?.ok) {
      toast.success("Saved. Hot / Warm / Cold re-checked.");
      setEditing(false);
    }
  }, [state]);
  const isAgencyLead = lead.segment === "agency";
  const title = isAgencyLead ? "Current software" : "Current agency";
  const sw = lead.incumbent_software ? SOFTWARE_TEXT[lead.incumbent_software] : null;

  return (
    <CardSection
      title={title}
      actions={canWrite && !editing ? <Button size="xs" variant="ghost" onClick={() => setEditing(true)}>Edit</Button> : null}
    >
      {!editing && (
        <>
          {lead.incumbent_agency || lead.incumbent_software ? (
            <div className="flex items-start gap-2.5">
              <Building className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <div className="font-medium">{lead.incumbent_agency ?? "Name not known"}</div>
                {sw && <div className="text-sm text-muted-foreground">{isAgencyLead ? swAgencyText(lead.incumbent_software) : sw.text}</div>}
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  Source: {lead.incumbent_source ? sourceName(lead.incumbent_source) : "our research"}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 text-sm">
              <ShieldQuestion className="mt-0.5 size-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {isAgencyLead ? "Not known. Ask what they use for attendance and patrols today." : "Not known. Ask the guard at the gate which agency they're from, and fill it in here."}
              </span>
            </div>
          )}
          {lead.segment === "govt" && lead.tender_ends_on && (
            <p className="mt-2 text-xs text-muted-foreground">Contract ends around {fmtDate(`${lead.tender_ends_on}T12:00:00+05:30`)}.</p>
          )}
        </>
      )}
      {editing && (
        <form action={action} className="flex flex-col gap-3" aria-label={`Edit ${title.toLowerCase()}`}>
          <input type="hidden" name="lead_id" value={lead.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ag-name">{isAgencyLead ? "Software they use" : "Agency name"}</Label>
              <Input id="ag-name" name="incumbent_agency" defaultValue={lead.incumbent_agency ?? ""} placeholder={isAgencyLead ? "e.g. Raksham, own app, none" : "e.g. Shield Force Security"} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{isAgencyLead ? "How good is it?" : "Does that agency use an app?"}</Label>
              <Select name="incumbent_software" defaultValue={lead.incumbent_software ?? "unknown"}>
                <SelectTrigger className="w-full" aria-label="Software">
                  <SelectValue>
                    {(v: string) =>
                      ({ unknown: "Don't know", none: "No app", weak: "Basic tech only", strong: "Yes, proper guard software", national: "Big national firm" })[v] ?? "Don't know"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Don&apos;t know</SelectItem>
                  <SelectItem value="none">No app</SelectItem>
                  <SelectItem value="weak">Basic tech only</SelectItem>
                  <SelectItem value="strong">Yes, proper guard software</SelectItem>
                  {!isAgencyLead && <SelectItem value="national">Big national firm (SIS, G4S, Securitas…)</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            {!isAgencyLead && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ag-size">Size</Label>
                  <Input id="ag-size" name="size_value" inputMode="numeric" defaultValue={lead.size_value ?? ""} placeholder="e.g. 640" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Unit</Label>
                  <Select name="size_unit" defaultValue={lead.size_unit ?? "none"}>
                    <SelectTrigger className="w-full" aria-label="Size unit">
                      <SelectValue>{(v: string) => (v === "none" || !v ? "Pick a unit" : v === "sq_ft" ? "sq ft" : v)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Pick a unit</SelectItem>
                      {["guards", "flats", "beds", "students", "rooms", "acres", "sq_ft"].map((u) => (
                        <SelectItem key={u} value={u}>{u === "sq_ft" ? "sq ft" : u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          {state?.error && <FormAlert>{state.error}</FormAlert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={pending}>Save</Button>
          </div>
        </form>
      )}
    </CardSection>
  );
}

function swAgencyText(s: string | null) {
  return s === "none" ? "No software seen" : s === "weak" ? "Some tech, no proper guard app" : s === "strong" ? "Already uses guard software" : "";
}

// ---------------------------------------------------------------------------
// Log and history
// ---------------------------------------------------------------------------

function HistorySection({ detail, canWrite, timezone }: { detail: LeadDetail; canWrite: boolean; timezone: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(logNote, undefined);
  const [kind, setKind] = useState<"note" | "visit">("note");
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (state?.ok) {
      toast.success(kind === "visit" ? "Visit logged" : "Note saved");
      setFormKey((k) => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <CardSection title="Notes and history">
      {canWrite && (
        <form key={formKey} action={action} className="mb-4 flex flex-col gap-2" aria-label="Add a note">
          <input type="hidden" name="lead_id" value={detail.lead.id} />
          <input type="hidden" name="kind" value={kind} />
          <Textarea name="body" rows={2} placeholder="Add a note: what happened, what they need, who to meet…" aria-label="Note" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex rounded-md border p-0.5 text-xs" role="group" aria-label="Note type">
              {(["note", "visit"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  aria-pressed={kind === k}
                  className={cn("rounded px-2.5 py-1", kind === k ? "bg-secondary font-medium" : "text-muted-foreground")}
                >
                  {k === "note" ? "Note" : "Site visit"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="note-follow-up" className="text-xs text-muted-foreground">Next follow-up</Label>
              <Input id="note-follow-up" name="next_follow_up" type="date" defaultValue={detail.lead.next_follow_up ?? ""} className="h-8 w-[150px] font-mono text-xs" />
              <Button type="submit" size="sm" disabled={pending}>Save</Button>
            </div>
          </div>
          {state?.error && <FormAlert>{state.error}</FormAlert>}
        </form>
      )}
      {detail.activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <ol className="space-y-2.5" aria-label="History">
          {detail.activities.map((a) => (
            <li key={a.id} className="flex gap-3 text-sm">
              <span className="w-[92px] shrink-0 pt-0.5 font-mono text-[11px] text-muted-foreground">{fmtDateTime(a.created_at, timezone)}</span>
              <span className="flex-1">
                <span className="font-medium">{a.author?.full_name ?? "System"}</span>{" "}
                <span className="text-muted-foreground">{KIND_WORD[a.kind] ?? a.kind}</span>
                {a.body ? <span>: {a.body}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </CardSection>
  );
}

const KIND_WORD: Record<string, string> = {
  call: "called",
  visit: "visited",
  note: "noted",
  stage: "moved it",
  created: "added it",
  lookup: "looked up a number",
  update: "updated",
};

function MakeSiteButton({ leadId, hasLocation }: { leadId: string; hasLocation: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      title={hasLocation ? undefined : "Needs a map location; you'll be asked to create the site by hand."}
      onClick={() =>
        startTransition(async () => {
          const res = await makeSite(leadId);
          if (res?.error) toast.error(res.error);
        })
      }
    >
      Won: make this a site
    </Button>
  );
}

function LostButton({ leadId }: { leadId: string }) {
  const [ask, setAsk] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!ask) return <Button size="sm" variant="outline" onClick={() => setAsk(true)}>Mark as lost</Button>;
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Why was it lost?">
      <span className="text-sm text-muted-foreground">Why?</span>
      {LOST_REASONS.map((r) => (
        <Button
          key={r}
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await moveLead(leadId, "lost", r);
              if (res?.error) toast.error(res.error);
            })
          }
        >
          {r}
        </Button>
      ))}
    </div>
  );
}
