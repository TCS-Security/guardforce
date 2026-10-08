/**
 * Our own sales, run on the same pipeline: loads the TCS Leads sheet (security agencies we sell
 * GuardWatch to) into an internal "GuardWatch Sales" tenant.
 *
 *   bun scripts/sales/import-tcs-leads.ts [--target local|cloud] [--notes <research_notes/agency-clients>] [--owner-email you@x] [--owner-name "Name"]
 *
 * The sheet snapshot and research live outside git (they hold call notes with people's names).
 *
 * - Creates the tenant and its owner login the first time (prints the password once).
 * - Hot / Warm / Cold comes from the sheet's P marks: P0 = Hot, P1 = Warm, P2-P4 = Cold, blank = Warm.
 * - "Current software" and the reasons come from our research of each agency's website
 *   (research_notes/agency-clients). Existing call notes become the first history entry.
 * - Re-running adds only rows not imported yet (keyed by sheet row), so progress is never overwritten.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
import { randomBytes } from "node:crypto";

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const target = arg("target") ?? "local";
const ownerEmail = arg("owner-email") ?? "sales@guardwatch.test";
const ownerName = arg("owner-name") ?? "GuardWatch Sales";
const notesDir = resolve(arg("notes") ?? join(HERE, "../../../research_notes/agency-clients"));

function env(file: string) {
  const out: Record<string, string> = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m) out[m[1]!] = m[2]!;
  }
  return out;
}
function connection() {
  if (target === "cloud") {
    const e = env(resolve(HERE, "../../../.env"));
    if (!e.SUPABASE_PROJECT_REF || !e.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Cloud credentials missing from the repo-root .env");
    return { url: `https://${e.SUPABASE_PROJECT_REF}.supabase.co`, key: e.SUPABASE_SERVICE_ROLE_KEY };
  }
  const e = env(resolve(HERE, "../../.env.local"));
  return { url: e.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", key: e.SUPABASE_SERVICE_ROLE_KEY! };
}

/** Minimal RFC 4180 CSV parser (quoted fields, doubled quotes, CRLF). */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift()!.map((h) => h.trim());
  return rows.filter((r) => r.some((v) => v.trim())).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const sheet = parseCsv(readFileSync(join(notesDir, "tcs_leads_snapshot_2026-10-08.csv"), "utf8"));
const summary = parseCsv(readFileSync(join(notesDir, "agency_summary.csv"), "utf8"));
// agency_summary "sheet row" is the spreadsheet row (header = row 1); "4 / 63" lists duplicates.
const bySheetRow = new Map<number, Record<string, string>>();
for (const s of summary) for (const r of (s["sheet row"] ?? "").split("/")) if (r.trim()) bySheetRow.set(Number(r.trim()), s);

function labelFrom(q: string): "hot" | "warm" | "cold" {
  const m = q.match(/\bp\s?([0-5])\b/i);
  if (m) return m[1] === "0" ? "hot" : m[1] === "1" ? "warm" : "cold";
  if (/\b(nah+|stale|hehe|out of service)\b/i.test(q)) return "cold";
  return "warm";
}
function softwareFrom(note: string, research?: Record<string, string>): { name: string | null; level: "none" | "weak" | "strong" | null } {
  if (/raksham/i.test(note) && !/doesn'?t seem to have raksham/i.test(note)) return { name: "Raksham", level: "strong" };
  if (/in-?house software/i.test(note)) return { name: "In-house software", level: "strong" };
  if (/own app|already has app/i.test(note)) return { name: "Own app", level: "strong" };
  if (/complicated tech/i.test(note)) return { name: "Own tech systems", level: "strong" };
  const sw = research?.software;
  if (sw === "Present") return { name: "Has guard software", level: "strong" };
  if (sw === "Mid") return { name: "Some tech, no proper app", level: "weak" };
  if (sw === "Absent") return { name: "None seen", level: "none" };
  if (/doesn'?t seem to have raksham|lacks tech/i.test(note)) return { name: "None seen", level: "none" };
  return { name: null, level: null };
}
function phoneKind(p: string): "mobile" | "office" {
  const d = p.replace(/\D/g, "").replace(/^0+/, "");
  return d.startsWith("80") && p.trim().startsWith("080") ? "office" : "mobile";
}

const { url, key } = connection();
const db = createClient(url, key, { auth: { persistSession: false } });

// ---------------------------------------------------------------------------
// Tenant + owner
// ---------------------------------------------------------------------------
let { data: agency } = await db.from("agencies").select("id,name").eq("slug", "guardwatch-sales").maybeSingle();
let ownerId: string;
if (!agency) {
  const { data: created, error } = await db
    .from("agencies")
    .insert({ name: "GuardWatch Sales", slug: "guardwatch-sales", city: "Bengaluru", plan: "pilot", status: "active", notes: "Internal: our own sales pipeline (TCS Leads)." })
    .select("id,name")
    .single();
  if (error) throw error;
  agency = created;
  console.log(`Created tenant ${agency.name} (${agency.id})`);
}
const { data: existingOwner } = await db.from("profiles").select("id").eq("agency_id", agency.id).eq("role", "owner").maybeSingle();
if (existingOwner) {
  ownerId = existingOwner.id;
} else {
  const password = randomBytes(9).toString("base64url");
  const { data: user, error } = await db.auth.admin.createUser({ email: ownerEmail, password, email_confirm: true });
  if (error || !user.user) throw new Error(`Owner login: ${error?.message}`);
  const { data: role } = await db.from("roles").select("id").eq("agency_id", agency.id).eq("system_key", "owner").single();
  const { error: pErr } = await db.from("profiles").insert({
    id: user.user.id, agency_id: agency.id, role: "owner", role_id: role?.id ?? null, all_sites: true, full_name: ownerName, email: ownerEmail,
  });
  if (pErr) throw pErr;
  ownerId = user.user.id;
  console.log(`\nOwner login created: ${ownerEmail} / ${password}  (shown once; change it after signing in)\n`);
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------
const { data: already } = await db.from("leads").select("extra").eq("agency_id", agency.id).eq("source", "sheet");
const done = new Set((already ?? []).map((l) => Number((l.extra as { sheet_row?: number })?.sheet_row)));
const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

let added = 0;
for (let i = 0; i < sheet.length; i++) {
  const r = sheet[i]!;
  const sheetRow = i + 2;
  if (done.has(sheetRow) || !r.name) continue;
  const quality = r["Lead Quality"] ?? r["Lead Quality "] ?? "";
  const callNote = r["Call notes"] ?? "";
  const research = bySheetRow.get(sheetRow);
  const sw = softwareFrom(`${quality} ${callNote}`, research);
  const label = labelFrom(quality);

  const reasons: { kind: string; text: string; source: string; url?: string | null }[] = [];
  if (sw.level === "none") reasons.push({ kind: "incumbent", text: "No guard software seen on their website", source: "Our research", url: r.website || null });
  if (sw.level === "weak") reasons.push({ kind: "incumbent", text: "Claims some tech (GPS / attendance) but no proper guard app", source: "Our research", url: r.website || null });
  if (sw.level === "strong") reasons.push({ kind: "incumbent", text: `Already uses ${sw.name}; harder sell`, source: "Our research" });
  if (research?.["client mix (classified only)"]) {
    reasons.push({ kind: "note", text: `Their clients: ${research["client mix (classified only)"]}${research["agency type"] ? ` (${research["agency type"]})` : ""}`, source: "Agency website", url: r.website || null });
  }
  // The sheet's own comment, without the bare P mark (the Hot/Warm/Cold label already says that).
  const comment = quality.replace(/[.,]?\s*\bp\s?[0-5]\b[.,]?/gi, " ").replace(/\s+/g, " ").trim().replace(/^[.,\s]+|[.,\s]+$/g, "");
  if (comment && !/^(nah+|stale|hehe|can)$/i.test(comment)) reasons.push({ kind: "note", text: `Our note: ${comment}`, source: "Our sheet" });
  const employees = Number(r.employees);
  if (employees > 0) reasons.push({ kind: "size", text: `About ${employees.toLocaleString("en-IN")} staff (${r.employees_source || "website"})`, source: "Agency website", url: r.website || null });
  if (Number(r.reviews) >= 100) reasons.push({ kind: "note", text: `${r.reviews} Google reviews (${r.rating}★): an established local name`, source: "Google Maps", url: r.maps_url || null });

  const followUp = /call later|to call|follow ?up|meeting|call .*\d|monday|tuesday|wednesday|thursday|friday|saturday/i.test(callNote) || label === "hot" ? today : null;
  const lat = Number(r.lat), lng = Number(r.lng);

  const { data: lead, error } = await db
    .from("leads")
    .insert({
      agency_id: agency.id,
      name: r.name.split("|")[0]!.trim(),
      segment: "agency",
      address: r.address || null,
      locality: r.locality || null,
      city: "Bengaluru",
      lat: Number.isFinite(lat) && lat ? lat : null,
      lng: Number.isFinite(lng) && lng ? lng : null,
      website: r.website || null,
      size_value: employees > 0 ? employees : null,
      size_unit: employees > 0 ? "guards" : null,
      incumbent_agency: sw.name,
      incumbent_software: sw.level,
      incumbent_source: sw.name ? "Our research" : null,
      label,
      reasons,
      stage: callNote ? "called" : "new",
      owner_id: ownerId,
      next_follow_up: followUp,
      source: "sheet",
      source_url: r.maps_url || null,
      extra: { sheet_row: sheetRow, place_id: r.place_id || null, rating: r.rating || null, reviews: r.reviews || null },
      created_by: ownerId,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Row ${sheetRow}: ${error.message}`);

  if (r.phone) {
    await db.from("lead_numbers").insert({
      agency_id: agency.id, lead_id: lead.id, kind: phoneKind(r.phone), value: r.phone, label: "Main number", source: "google_maps", source_url: r.maps_url || null,
    });
  }
  await db.from("lead_activities").insert({ agency_id: agency.id, lead_id: lead.id, kind: "created", body: `Imported from the TCS Leads sheet (row ${sheetRow})`, created_by: ownerId });
  if (callNote) {
    await db.from("lead_activities").insert({ agency_id: agency.id, lead_id: lead.id, kind: "note", body: `From the sheet: ${callNote}`, created_by: ownerId });
  }
  added++;
}
console.log(`Imported ${added} new leads into ${agency.name} on ${target} (${done.size} were already there).`);
