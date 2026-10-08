"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { deny, requireSession, type Session } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";
import { toLocalDate } from "@/lib/domain/format";
import {
  LOST_REASONS, assessLead, estimateGuards, lookupGate, stageAfterCall,
  type CallOutcome, type IncumbentSoftware, type LeadFacts, type Reason, type Segment, type SizeUnit, type Stage,
} from "@/lib/domain/sales";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

const SEGMENT_VALUES = [
  "apartment", "developer_project", "factory", "office", "it_park", "hospital", "school", "college",
  "hotel", "mall", "jeweller", "govt", "warehouse", "bank", "agency", "other",
] as const;
const STAGE_VALUES = ["new", "called", "meeting", "proposal", "won", "lost"] as const;

type Supabase = Awaited<ReturnType<typeof createClient>>;

function factsOf(row: Partial<Tables<"leads">> & { segment: string }): LeadFacts {
  return {
    segment: row.segment as Segment,
    size_value: row.size_value ?? null,
    size_unit: (row.size_unit as SizeUnit | null) ?? null,
    completion_on: row.completion_on ?? null,
    tender_closes_on: row.tender_closes_on ?? null,
    tender_ends_on: row.tender_ends_on ?? null,
    tender_value_inr: row.tender_value_inr ?? null,
    tender_guards: row.tender_guards ?? null,
    incumbent_agency: row.incumbent_agency ?? null,
    incumbent_software: (row.incumbent_software as IncumbentSoftware | null) ?? null,
    incumbent_source: row.incumbent_source ?? null,
    source: row.source ?? null,
    source_url: row.source_url ?? null,
  };
}

/**
 * Label and reasons for a lead. Security-agency leads (our own sales) keep the label the sheet
 * gave them and their notes; everything else is worked out from the facts, keeping any hand-written
 * "note" reasons.
 */
function relabel(row: Partial<Tables<"leads">> & { segment: string; label?: string; reasons?: unknown }) {
  const stored = Array.isArray(row.reasons) ? (row.reasons as Reason[]) : [];
  if (row.segment === "agency") return { label: (row.label ?? "warm") as "hot" | "warm" | "cold", reasons: stored };
  const a = assessLead(factsOf(row));
  const notes = stored.filter((r) => r.kind === "note");
  return { label: a.label, reasons: [...a.reasons, ...notes] };
}

async function logActivity(
  supabase: Supabase,
  session: Session,
  leadId: string,
  kind: Tables<"lead_activities">["kind"],
  body: string | null,
  extra: { outcome?: CallOutcome | null; contact_id?: string | null } = {},
) {
  await supabase.from("lead_activities").insert({
    agency_id: session.agency.id,
    lead_id: leadId,
    kind,
    body,
    outcome: extra.outcome ?? null,
    contact_id: extra.contact_id ?? null,
    created_by: session.userId,
  });
}

// The lead card lives on /sales (?lead=…), so revalidating the page refreshes both.
function done() {
  revalidatePath("/sales");
}

// ---------------------------------------------------------------------------
// Adding leads
// ---------------------------------------------------------------------------

/** Copy shared prospects into this agency's leads. */
export async function addProspects(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const denied = deny(session, "sales:write");
  if (denied) return denied;
  const ids = formData.getAll("prospect_id").map(String).filter((v) => /^[0-9a-f-]{36}$/i.test(v));
  if (ids.length === 0) return { error: "Tick at least one place to add." };

  const supabase = await createClient();
  const { data: prospects, error } = await supabase.from("prospects").select("*").in("id", ids.slice(0, 200));
  if (error) return { error: error.message };

  let added = 0;
  for (const p of prospects ?? []) {
    const base = {
      segment: p.segment,
      size_value: p.size_value,
      size_unit: p.size_unit,
      completion_on: p.completion_on,
      tender_closes_on: p.tender_closes_on,
      tender_ends_on: p.tender_ends_on,
      tender_value_inr: p.tender_value_inr,
      tender_guards: p.tender_guards,
      incumbent_agency: p.incumbent_agency,
      incumbent_software: p.incumbent_software,
      incumbent_source: p.incumbent_agency ? "agency_index" : null,
      source: p.source,
      source_url: p.source_url,
    };
    const { label, reasons } = relabel({ ...base, reasons: [] });
    const { data: lead, error: insertError } = await supabase
      .from("leads")
      .insert({
        ...base,
        agency_id: session.agency.id,
        prospect_id: p.id,
        name: p.name,
        address: p.address,
        locality: p.locality,
        city: p.city,
        lat: p.lat,
        lng: p.lng,
        website: p.website,
        developer: p.developer,
        label,
        reasons,
        owner_id: session.userId,
        created_by: session.userId,
        extra: p.notes ? { notes: p.notes } : {},
      })
      .select("id")
      .single();
    if (insertError) {
      if (insertError.code === "23505") continue; // already added
      return { error: insertError.message };
    }
    if (p.phone) {
      await supabase.from("lead_numbers").insert({
        agency_id: session.agency.id,
        lead_id: lead.id,
        kind: "office",
        value: p.phone,
        label: "Main number",
        source: p.source,
        source_url: p.source_url,
      });
    }
    await logActivity(supabase, session, lead.id, "created", `Added from ${p.source === "osm" ? "OpenStreetMap" : p.source.toUpperCase()}`);
    added++;
  }
  done();
  return { ok: true, message: added === 1 ? "1 lead added to your list." : `${added} leads added to your list.` };
}

const newLeadSchema = z.object({
  name: z.string().trim().min(2, "Give the lead a name"),
  segment: z.enum(SEGMENT_VALUES, { message: "Pick a type" }),
  address: z.string().trim().optional(),
  locality: z.string().trim().optional(),
  size_value: z.string().trim().optional(),
  size_unit: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  contact_name: z.string().trim().optional(),
  designation: z.string().trim().optional(),
  contact_phone: z.string().trim().optional(),
  incumbent_agency: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

/** A lead a rep adds by hand. */
export async function createLead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const denied = deny(session, "sales:write");
  if (denied) return denied;
  const parsed = newLeadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;
  const sizeValue = d.size_value ? Number(d.size_value) : null;
  const sizeUnit = sizeValue && d.size_unit && d.size_unit !== "none" ? (d.size_unit as SizeUnit) : null;

  const base = {
    segment: d.segment,
    size_value: sizeValue && Number.isFinite(sizeValue) ? sizeValue : null,
    size_unit: sizeUnit,
    incumbent_agency: d.incumbent_agency || null,
    incumbent_source: d.incumbent_agency ? "rep" : null,
    source: "manual",
  };
  const { label, reasons } = relabel({ ...base, reasons: [] });

  const supabase = await createClient();
  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      ...base,
      agency_id: session.agency.id,
      name: d.name,
      address: d.address || null,
      locality: d.locality || null,
      city: "Bengaluru",
      label,
      reasons,
      owner_id: session.userId,
      created_by: session.userId,
      next_follow_up: toLocalDate(new Date(), session.agency.timezone),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (d.phone) {
    await supabase.from("lead_numbers").insert({
      agency_id: session.agency.id, lead_id: lead.id, kind: "office", value: d.phone, label: "Main number", source: "rep",
    });
  }
  if (d.contact_name) {
    const { data: contact } = await supabase
      .from("lead_contacts")
      .insert({ agency_id: session.agency.id, lead_id: lead.id, full_name: d.contact_name, designation: d.designation || null, source: "rep", created_by: session.userId })
      .select("id")
      .single();
    if (contact && d.contact_phone) {
      await supabase.from("lead_numbers").insert({
        agency_id: session.agency.id, lead_id: lead.id, contact_id: contact.id, kind: "mobile", value: d.contact_phone, source: "rep",
      });
    }
  }
  await logActivity(supabase, session, lead.id, "created", d.note ? `Added by hand. ${d.note}` : "Added by hand");
  done();
  redirect(`/sales?lead=${lead.id}`);
}

// ---------------------------------------------------------------------------
// Working a lead
// ---------------------------------------------------------------------------

const STAGE_LABEL: Record<Stage, string> = { new: "New", called: "Called", meeting: "Meeting", proposal: "Proposal", won: "Won", lost: "Lost" };

/** Move a lead to another stage (board drag, or the stage menu). Lost needs a reason. */
export async function moveLead(leadId: string, stage: Stage, lostReason?: string): Promise<ActionState> {
  const session = await requireSession();
  const denied = deny(session, "sales:write");
  if (denied) return denied;
  if (!STAGE_VALUES.includes(stage)) return { error: "Unknown stage" };
  if (stage === "lost" && !(lostReason && (LOST_REASONS as readonly string[]).includes(lostReason))) {
    return { error: "Pick why the lead was lost." };
  }
  const supabase = await createClient();
  const { data: before } = await supabase.from("leads").select("stage").eq("id", leadId).maybeSingle();
  if (!before) return { error: "Lead not found" };
  if (before.stage === stage) return { ok: true };
  const { error } = await supabase
    .from("leads")
    .update({ stage, lost_reason: stage === "lost" ? lostReason : null })
    .eq("id", leadId);
  if (error) return { error: error.message };
  await logActivity(
    supabase, session, leadId, "stage",
    `Moved from ${STAGE_LABEL[before.stage as Stage]} to ${STAGE_LABEL[stage]}${stage === "lost" ? ` (${lostReason})` : ""}`,
  );
  done();
  return { ok: true };
}

export async function setOwner(leadId: string, ownerId: string | null): Promise<ActionState> {
  const session = await requireSession();
  const denied = deny(session, "sales:write");
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ owner_id: ownerId }).eq("id", leadId);
  if (error) return { error: error.message };
  done();
  return { ok: true };
}

export async function setFollowUp(leadId: string, date: string | null): Promise<ActionState> {
  const session = await requireSession();
  const denied = deny(session, "sales:write");
  if (denied) return denied;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick a date" };
  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ next_follow_up: date }).eq("id", leadId);
  if (error) return { error: error.message };
  done();
  return { ok: true };
}

const noteSchema = z.object({
  lead_id: z.string().uuid(),
  kind: z.enum(["call", "visit", "note"]),
  body: z.string().trim().optional(),
  outcome: z.enum(["reached", "no_answer", "wrong_number", "wrong_person"]).optional().or(z.literal("")),
  number_id: z.string().uuid().optional().or(z.literal("")),
  contact_id: z.string().uuid().optional().or(z.literal("")),
  next_follow_up: z.string().optional(),
});

/**
 * Log a call, visit or note. A call outcome also marks the number (worked / no answer / wrong)
 * and moves a New lead to Called. The next follow-up date is saved with it.
 */
export async function logNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const denied = deny(session, "sales:write");
  if (denied) return denied;
  const parsed = noteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;
  const outcome = (d.outcome || null) as CallOutcome | null;
  if (d.kind === "call" && !outcome) return { error: "How did the call go?" };
  if (d.kind !== "call" && !d.body) return { error: "Write a short note." };
  if (d.next_follow_up && !/^\d{4}-\d{2}-\d{2}$/.test(d.next_follow_up)) return { error: "Pick a follow-up date" };

  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("id,stage").eq("id", d.lead_id).maybeSingle();
  if (!lead) return { error: "Lead not found" };

  let contactId = d.contact_id || null;
  if (d.kind === "call" && d.number_id) {
    const status = outcome === "no_answer" ? "no_answer" : outcome === "wrong_number" ? "wrong" : "worked";
    const { data: num } = await supabase
      .from("lead_numbers")
      .update({ status, last_tried_at: new Date().toISOString() })
      .eq("id", d.number_id)
      .select("contact_id")
      .maybeSingle();
    contactId = contactId ?? num?.contact_id ?? null;
  }

  const outcomeText = outcome
    ? { reached: "Reached", no_answer: "No answer", wrong_number: "Wrong number", wrong_person: "Not the right person" }[outcome]
    : null;
  const body = [outcomeText, d.body].filter(Boolean).join(". ");
  await logActivity(supabase, session, lead.id, d.kind, body || null, { outcome, contact_id: contactId });

  const patch: Partial<Tables<"leads">> = {};
  if (d.next_follow_up !== undefined) patch.next_follow_up = d.next_follow_up || null;
  if (d.kind === "call" || d.kind === "visit") {
    const next = stageAfterCall(lead.stage as Stage);
    if (next !== lead.stage) patch.stage = next;
  }
  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("leads").update(patch).eq("id", lead.id);
    if (error) return { error: error.message };
    if (patch.stage) await logActivity(supabase, session, lead.id, "stage", "Moved from New to Called");
  }
  done();
  return { ok: true };
}

const contactSchema = z.object({
  lead_id: z.string().uuid(),
  full_name: z.string().trim().min(2, "Write the person's name"),
  designation: z.string().trim().optional(),
  mobile: z.string().trim().optional(),
  office: z.string().trim().optional(),
  email: z.string().trim().email("That email doesn't look right").optional().or(z.literal("")),
  whatsapp_ok: z.string().optional(),
  linkedin: z.string().trim().optional(),
});

export async function addContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const denied = deny(session, "sales:write");
  if (denied) return denied;
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;
  const supabase = await createClient();
  const { data: contact, error } = await supabase
    .from("lead_contacts")
    .insert({
      agency_id: session.agency.id,
      lead_id: d.lead_id,
      full_name: d.full_name,
      designation: d.designation || null,
      whatsapp_ok: d.whatsapp_ok === "on",
      source: d.linkedin ? "linkedin" : "rep",
      source_url: d.linkedin || null,
      created_by: session.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  const nums = [
    d.mobile ? { kind: "mobile" as const, value: d.mobile } : null,
    d.office ? { kind: "office" as const, value: d.office } : null,
    d.email ? { kind: "email" as const, value: d.email } : null,
  ].filter(Boolean) as { kind: "mobile" | "office" | "email"; value: string }[];
  if (nums.length > 0) {
    const { error: numError } = await supabase.from("lead_numbers").insert(
      nums.map((n) => ({ ...n, agency_id: session.agency.id, lead_id: d.lead_id, contact_id: contact.id, source: "rep" })),
    );
    if (numError) return { error: numError.message };
  }
  await logActivity(supabase, session, d.lead_id, "update", `Added ${d.full_name}${d.designation ? ` (${d.designation})` : ""}`);
  done();
  return { ok: true };
}

const numberSchema = z.object({
  lead_id: z.string().uuid(),
  contact_id: z.string().uuid().optional().or(z.literal("")),
  kind: z.enum(["mobile", "office", "email"]),
  value: z.string().trim().min(3, "Write the number"),
  label: z.string().trim().optional(),
});

export async function addNumber(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const denied = deny(session, "sales:write");
  if (denied) return denied;
  const parsed = numberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("lead_numbers").insert({
    agency_id: session.agency.id,
    lead_id: d.lead_id,
    contact_id: d.contact_id || null,
    kind: d.kind,
    value: d.value,
    label: d.label || null,
    source: "rep",
  });
  if (error) return { error: error.message };
  done();
  return { ok: true };
}

/** "Do not call": hides the person's numbers for good and records why in the history. */
export async function setDoNotCall(leadId: string, contactId: string): Promise<ActionState> {
  const session = await requireSession();
  const denied = deny(session, "sales:write");
  if (denied) return denied;
  const supabase = await createClient();
  const { data: c, error } = await supabase
    .from("lead_contacts")
    .update({ do_not_call: true, whatsapp_ok: false })
    .eq("id", contactId)
    .select("full_name")
    .maybeSingle();
  if (error) return { error: error.message };
  await logActivity(supabase, session, leadId, "update", `${c?.full_name ?? "Contact"} asked not to be called`);
  done();
  return { ok: true };
}

const agencySchema = z.object({
  lead_id: z.string().uuid(),
  incumbent_agency: z.string().trim().optional(),
  incumbent_software: z.enum(["unknown", "none", "weak", "strong", "national"]),
  size_value: z.string().trim().optional(),
  size_unit: z.string().trim().optional(),
});

/** Fill in or correct the current agency (and size). Hot / Warm / Cold is re-checked straight away. */
export async function updateLeadFacts(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const denied = deny(session, "sales:write");
  if (denied) return denied;
  const parsed = agencySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;
  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", d.lead_id).maybeSingle();
  if (!lead) return { error: "Lead not found" };

  const sizeValue = d.size_value ? Number(d.size_value) : null;
  const patch = {
    incumbent_agency: d.incumbent_agency || null,
    incumbent_software: d.incumbent_software === "unknown" ? null : d.incumbent_software,
    incumbent_source: d.incumbent_agency && d.incumbent_agency !== lead.incumbent_agency ? "rep" : lead.incumbent_source,
    size_value: sizeValue && Number.isFinite(sizeValue) ? sizeValue : lead.size_value,
    size_unit: sizeValue && d.size_unit && d.size_unit !== "none" ? (d.size_unit as SizeUnit) : lead.size_unit,
  };
  const { label, reasons } = relabel({ ...lead, ...patch });
  const { error } = await supabase.from("leads").update({ ...patch, label, reasons }).eq("id", lead.id);
  if (error) return { error: error.message };
  const changed = label !== lead.label ? ` Now ${label[0]!.toUpperCase()}${label.slice(1)}.` : "";
  await logActivity(
    supabase, session, lead.id, "update",
    `Current agency: ${patch.incumbent_agency ?? "not known"}${patch.incumbent_software ? ` (${softwareWord(patch.incumbent_software)})` : ""}.${changed}`,
  );
  done();
  return { ok: true };
}

function softwareWord(s: IncumbentSoftware) {
  return { none: "no app", weak: "basic tech only", strong: "has guard software", national: "national firm" }[s];
}

/** Won: create the GuardWatch site from the lead and link it. */
export async function makeSite(leadId: string): Promise<ActionState> {
  const session = await requireSession();
  const denied = deny(session, "sales:write") ?? deny(session, "sites:write");
  if (denied) return denied;
  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) return { error: "Lead not found" };
  if (lead.won_site_id) redirect(`/sites/${lead.won_site_id}`);
  if (lead.lat == null || lead.lng == null) return { error: "This lead has no map location yet. Create the site from Sites → New site." };

  const { guards } = estimateGuards(factsOf(lead));
  const { data: site, error } = await supabase
    .from("sites")
    .insert({
      agency_id: session.agency.id,
      name: lead.name,
      client_name: lead.developer ?? lead.name,
      address: lead.address,
      city: lead.city ?? "Bengaluru",
      lat: lead.lat,
      lng: lead.lng,
      guards_required: Math.max(1, guards || 1),
      notes: `Won through Sales (${new Date().toISOString().slice(0, 10)}).`,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  await supabase.from("leads").update({ stage: "won", won_site_id: site.id, lost_reason: null }).eq("id", leadId);
  await logActivity(supabase, session, leadId, "stage", "Won. Created the site in GuardWatch");
  revalidatePath("/sites");
  done();
  redirect(`/sites/${site.id}`);
}

// ---------------------------------------------------------------------------
// Paid mobile lookup
// ---------------------------------------------------------------------------

/**
 * "Find mobile number". Allowed only on the best leads, at most LOOKUP_MONTHLY_CAP a month per
 * agency, and only when a provider is configured (we pay; the key lives in our server env).
 */
export async function findMobile(leadId: string): Promise<ActionState> {
  const session = await requireSession();
  const denied = deny(session, "sales:lookup");
  if (denied) return denied;
  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) return { error: "Lead not found" };
  const { data: numbers } = await supabase.from("lead_numbers").select("kind,status,contact_id").eq("lead_id", leadId);
  const monthStart = `${toLocalDate(new Date(), session.agency.timezone).slice(0, 7)}-01T00:00:00+05:30`;
  const { count } = await supabase.from("lead_lookups").select("id", { count: "exact", head: true }).gte("created_at", monthStart);

  const a = assessLead(factsOf(lead));
  const gate = lookupGate({
    label: lead.label as "hot" | "warm" | "cold",
    guards: a.guards,
    guardsKnown: a.guardsKnown,
    incumbentSoftware: lead.incumbent_software as IncumbentSoftware | null,
    timing: a.timing,
    hasMobile: (numbers ?? []).some((n) => n.kind === "mobile" && n.status !== "wrong" && n.contact_id),
    usedThisMonth: count ?? 0,
  });
  if (!gate.allowed) return { error: gate.why };

  const provider = process.env.EASYLEADZ_API_KEY ? "easyleadz" : null;
  if (!provider) {
    return { error: "Paid number lookups aren't switched on yet. Use the free options (website, LinkedIn, reception) for now." };
  }
  // The provider adapter is added once the provider's terms for in-product use are signed.
  // Until then a configured key still does nothing, and no lookup is charged or counted.
  return { error: "The number provider isn't connected yet." };
}
