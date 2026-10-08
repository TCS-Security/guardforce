/**
 * One-time load of the shared prospect list (Sales → Find new leads).
 *
 *   bun scripts/sales/import-prospects.ts [--target local|cloud] [--dir <folder>] [--dry]
 *
 * Reads every *.json file in the data folder (default: ../research_notes/sales-pipeline/data),
 * each an array in the format described in SCHEMA.md there, works out Hot / Warm / Cold with the
 * same rules the app uses (src/lib/domain/sales.ts), folds agency-index clients into the matching
 * map record when they are the same place, and upserts into public.prospects on (source, source_ref).
 *
 * Organisation-level facts only: the format has no field for a person, and nothing here adds one.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
import { assessLead, guardsFromSize, type IncumbentSoftware, type Segment, type SizeUnit } from "../../src/lib/domain/sales";
import { haversineMeters } from "../../src/lib/domain/geo";

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const target = arg("target") ?? "local";
const dry = args.includes("--dry");
const dir = resolve(arg("dir") ?? join(HERE, "../../../research_notes/sales-pipeline/data"));

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
    const ref = e.SUPABASE_PROJECT_REF;
    if (!ref || !e.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Cloud credentials missing from the repo-root .env");
    return { url: `https://${ref}.supabase.co`, key: e.SUPABASE_SERVICE_ROLE_KEY };
  }
  const e = env(resolve(HERE, "../../.env.local"));
  return { url: e.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", key: e.SUPABASE_SERVICE_ROLE_KEY! };
}

type Raw = {
  source: string;
  source_ref: string;
  source_url?: string | null;
  name: string;
  segment: string;
  address?: string | null;
  locality?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  size_value?: number | null;
  size_unit?: string | null;
  phone?: string | null;
  website?: string | null;
  developer?: string | null;
  completion_on?: string | null;
  registered_on?: string | null;
  tender_closes_on?: string | null;
  tender_ends_on?: string | null;
  tender_value_inr?: number | null;
  tender_guards?: number | null;
  incumbent_agency?: string | null;
  incumbent_source_url?: string | null;
  incumbent_software?: string | null;
  notes?: string | null;
};

const SEGMENTS = new Set([
  "apartment", "developer_project", "factory", "office", "it_park", "hospital", "school", "college",
  "hotel", "mall", "jeweller", "govt", "warehouse", "bank", "other",
]);
const UNITS = new Set(["flats", "beds", "students", "rooms", "acres", "sq_ft", "guards"]);
const SOURCES = new Set(["rera", "gem", "osm", "kpme", "nabh", "agency_index", "manual"]);
const NATIONAL = /\b(SIS|Security and Intelligence Services|G4S|Allied Universal|Securitas|Tops?grup|Tops Security|Peregrine|ISS)\b/i;

const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").replace(/\b(pvt|ltd|private|limited|the|bangalore|bengaluru)\b/g, "").replace(/\s+/g, " ").trim();
const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
const inIndia = (lat: number | null, lng: number | null) => lat != null && lng != null && lat > 6 && lat < 37 && lng > 68 && lng < 98;

function software(r: Raw): IncumbentSoftware | null {
  if (!r.incumbent_agency) return null;
  if (NATIONAL.test(r.incumbent_agency)) return "national";
  const s = (r.incumbent_software ?? r.notes ?? "").toLowerCase();
  if (/present|strong/.test(s)) return "strong";
  if (/\bmid\b|weak/.test(s)) return "weak";
  if (/absent|none/.test(s)) return "none";
  return null;
}

function clean(r: Raw) {
  const lat = num(r.lat);
  const lng = num(r.lng);
  const segment = SEGMENTS.has(r.segment) ? (r.segment as Segment) : "other";
  const sizeUnit = r.size_unit && UNITS.has(r.size_unit) ? (r.size_unit as SizeUnit) : null;
  const sizeValue = sizeUnit ? num(r.size_value) : null;
  return {
    source: SOURCES.has(r.source) ? r.source : "manual",
    source_ref: String(r.source_ref).slice(0, 200),
    source_url: r.source_url ?? null,
    name: r.name.trim().slice(0, 200),
    segment,
    address: r.address?.trim() || null,
    locality: r.locality?.trim() || null,
    city: r.city?.trim() || "Bengaluru",
    lat: inIndia(lat, lng) ? lat : null,
    lng: inIndia(lat, lng) ? lng : null,
    size_value: sizeValue && sizeValue > 0 ? sizeValue : null,
    size_unit: sizeValue && sizeValue > 0 ? sizeUnit : null,
    phone: r.phone?.trim() || null,
    website: r.website?.trim() || null,
    developer: r.developer?.trim() || null,
    completion_on: date(r.completion_on),
    registered_on: date(r.registered_on),
    tender_closes_on: date(r.tender_closes_on),
    tender_ends_on: date(r.tender_ends_on),
    tender_value_inr: num(r.tender_value_inr),
    tender_guards: num(r.tender_guards),
    incumbent_agency: r.incumbent_agency?.trim() || null,
    incumbent_software: software(r),
    incumbent_source_url: r.incumbent_source_url ?? null,
    notes: r.notes?.slice(0, 500) ?? null,
  };
}
type Row = ReturnType<typeof clean>;

function label(row: Row) {
  const a = assessLead({
    segment: row.segment,
    size_value: row.size_value,
    size_unit: row.size_unit as SizeUnit | null,
    completion_on: row.completion_on,
    tender_closes_on: row.tender_closes_on,
    tender_ends_on: row.tender_ends_on,
    tender_value_inr: row.tender_value_inr,
    tender_guards: row.tender_guards,
    incumbent_agency: row.incumbent_agency,
    incumbent_software: row.incumbent_software,
    incumbent_source: row.incumbent_agency ? "agency_index" : null,
    source: row.source,
    source_url: row.source_url,
  });
  return {
    label: a.label,
    reasons: a.reasons,
    est_guards: guardsFromSize({ segment: row.segment, size_value: row.size_value, size_unit: row.size_unit as SizeUnit | null, tender_guards: row.tender_guards, tender_value_inr: row.tender_value_inr }),
  };
}

// ---------------------------------------------------------------------------

const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
if (files.length === 0) throw new Error(`No .json files in ${dir}`);
let rows: Row[] = [];
for (const f of files) {
  const data = JSON.parse(readFileSync(join(dir, f), "utf8")) as Raw[];
  if (!Array.isArray(data)) continue;
  const good = data.filter((r) => r && r.name && r.source_ref && r.source && r.segment).map(clean);
  console.log(`${f}: ${good.length} of ${data.length} usable`);
  rows.push(...good);
}

// Same (source, source_ref) twice: keep the later one.
rows = [...new Map(rows.map((r) => [`${r.source}|${r.source_ref}`, r])).values()];

// Agency-index clients that are the same place as a map/registry record: copy the incumbent onto
// that record and drop the duplicate.
const agencyRows = rows.filter((r) => r.source === "agency_index");
const others = rows.filter((r) => r.source !== "agency_index");
const byName = new Map<string, Row[]>();
for (const r of others) {
  const k = norm(r.name);
  if (!k) continue;
  byName.set(k, [...(byName.get(k) ?? []), r]);
}
let folded = 0;
const keptAgency: Row[] = [];
for (const a of agencyRows) {
  const candidates = byName.get(norm(a.name)) ?? [];
  const match = candidates.find(
    (c) => a.lat == null || c.lat == null || haversineMeters(a.lat, a.lng!, c.lat, c.lng!) < 400,
  );
  if (match && !match.incumbent_agency) {
    match.incumbent_agency = a.incumbent_agency;
    match.incumbent_software = a.incumbent_software;
    match.incumbent_source_url = a.incumbent_source_url;
    folded++;
  } else {
    keptAgency.push(a);
  }
}
rows = [...others, ...keptAgency];

const final = rows.map((r) => ({ ...r, ...label(r) }));
const tally = final.reduce<Record<string, number>>((t, r) => ((t[`${r.source}:${r.label}`] = (t[`${r.source}:${r.label}`] ?? 0) + 1), t), {});
console.log(`\n${final.length} prospects (${folded} agency-index clients folded into map records)`);
console.log(tally);

if (dry) process.exit(0);

const { url, key } = connection();
const supabase = createClient(url, key, { auth: { persistSession: false } });
let written = 0;
for (let i = 0; i < final.length; i += 500) {
  const batch = final.slice(i, i + 500);
  const { error } = await supabase.from("prospects").upsert(batch, { onConflict: "source,source_ref" });
  if (error) throw new Error(`Batch ${i / 500 + 1}: ${error.message}`);
  written += batch.length;
  process.stdout.write(`\rwritten ${written}/${final.length}`);
}
console.log(`\nDone: ${written} prospects upserted into ${target}.`);
