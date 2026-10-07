/**
 * Bulk import for the property masters (asked for on the call: adding tenants one at a time
 * is the part nobody will do). Paste rows from a spreadsheet — tab or comma separated, with a
 * header row — and get back the rows that will be created plus a line-numbered list of the
 * ones that will not, before anything is written.
 */

export type ImportColumn = { key: string; label: string; required: boolean; pattern?: RegExp; hint?: string };

export const TENANT_COLUMNS: ImportColumn[] = [
  { key: "name", label: "Company", required: true },
  { key: "code", label: "Code", required: true, pattern: /^[A-Z0-9-]{3,12}$/, hint: "3–12 capitals, digits or dashes" },
  { key: "floor", label: "Floor code", required: true },
  { key: "unit", label: "Unit", required: true },
  { key: "contact", label: "Contact person", required: true },
  { key: "phone", label: "Phone", required: true, pattern: /^(\+?91)?[6-9]\d{9}$/, hint: "10-digit mobile" },
  { key: "email", label: "Email", required: false, pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/, hint: "name@company.com" },
];

export const FLOOR_COLUMNS: ImportColumn[] = [
  { key: "name", label: "Floor", required: true },
  { key: "code", label: "Code", required: true, pattern: /^[A-Z0-9-]{2,12}$/, hint: "2–12 capitals, digits or dashes" },
  { key: "tower", label: "Tower code", required: true },
  { key: "lat", label: "Latitude", required: false, pattern: /^-?\d{1,2}\.\d+$/, hint: "e.g. 12.9354" },
  { key: "lng", label: "Longitude", required: false, pattern: /^-?\d{1,3}\.\d+$/, hint: "e.g. 77.6925" },
  { key: "radius", label: "Radius (m)", required: false, pattern: /^\d{1,3}$/, hint: "10–200" },
];

export type ImportResult = {
  rows: Record<string, string>[];
  errors: { line: number; message: string }[];
  unknownHeaders: string[];
};

function split(line: string): string[] {
  // Spreadsheet pastes are tab separated; CSV files are comma separated with optional quotes.
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  const out: string[] = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted;
    } else if (ch === "," && !quoted) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function parseImport(text: string, columns: ImportColumn[], existingCodes: string[] = []): ImportResult {
  const lines = text.split(/\r?\n/).map((l, i) => ({ l, n: i + 1 })).filter(({ l }) => l.trim() !== "");
  if (lines.length === 0) return { rows: [], errors: [{ line: 0, message: "Nothing to import — paste a header row and at least one row." }], unknownHeaders: [] };

  const header = split(lines[0]!.l);
  const index = new Map<string, number>();
  const unknownHeaders: string[] = [];
  header.forEach((h, i) => {
    const col = columns.find((c) => norm(c.label) === norm(h) || norm(c.key) === norm(h));
    if (col) index.set(col.key, i);
    else if (h) unknownHeaders.push(h);
  });
  const missing = columns.filter((c) => c.required && !index.has(c.key));
  if (missing.length) {
    return { rows: [], errors: [{ line: lines[0]!.n, message: `Header is missing ${missing.map((c) => `“${c.label}”`).join(", ")}.` }], unknownHeaders };
  }

  const seen = new Set(existingCodes.map((c) => c.toUpperCase()));
  const rows: Record<string, string>[] = [];
  const errors: ImportResult["errors"] = [];
  for (const { l, n } of lines.slice(1)) {
    const cells = split(l);
    const row: Record<string, string> = {};
    const problems: string[] = [];
    for (const c of columns) {
      const i = index.get(c.key);
      let v = i == null ? "" : (cells[i] ?? "");
      if (c.key === "code") v = v.toUpperCase();
      if (c.key === "phone") v = v.replace(/[\s-]/g, "");
      row[c.key] = v;
      if (c.required && !v) problems.push(`${c.label} is empty`);
      else if (v && c.pattern && !c.pattern.test(v)) problems.push(`${c.label} “${v}” should be ${c.hint ?? "valid"}`);
    }
    if (row.code && seen.has(row.code)) problems.push(`code ${row.code} already exists`);
    if (problems.length) errors.push({ line: n, message: problems.join("; ") });
    else {
      seen.add(row.code!);
      rows.push(row);
    }
  }
  return { rows, errors, unknownHeaders };
}

export function templateFor(columns: ImportColumn[], sample: string[][]): string {
  return [columns.map((c) => c.label).join(","), ...sample.map((r) => r.join(","))].join("\n");
}
