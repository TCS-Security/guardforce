import { describe, expect, it } from "vitest";
import { inflateRawSync } from "node:zlib";
import type { CsvColumn } from "../csv";
import { colLetter, escapeXml, sheetTabName, toXlsx, XLSX_CONTENT_TYPE, xlsxResponse } from "../xlsx";

type Row = { guard: string; worked: number; day: number; map: string };

const columns: CsvColumn<Row>[] = [
  { header: "Guard", value: (r) => r.guard, pin: true },
  { header: "Worked (h)", value: (r) => r.worked, cell: (r) => ({ t: "number", v: r.worked }) },
  { header: "Date", value: (r) => "01-09-26", cell: (r) => ({ t: "serial", v: r.day, fmt: "date" }) },
  { header: "Check-in location", value: (r) => r.map, cell: (r) => ({ t: "link", v: "Open map", href: r.map }) },
];

const rows: Row[] = [
  { guard: "Ramesh Yadav", worked: 8.5, day: 46266, map: "https://www.google.com/maps?q=12.95,77.6" },
  { guard: 'Suresh "Gowda" <2>', worked: 4, day: 46267, map: "https://www.google.com/maps?q=12.96,77.61" },
];

/**
 * Reads a stored/deflated entry back out of the zip we produced. Only enough of the
 * central directory is parsed to prove the file is a real archive with the parts
 * Excel needs — if this can find them, so can a spreadsheet.
 */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Map<string, string>();
  // End of central directory: scan back for the signature.
  let eocd = bytes.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
  expect(eocd, "end-of-central-directory signature").toBeGreaterThanOrEqual(0);
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);

  for (let i = 0; i < count; i++) {
    expect(view.getUint32(p, true)).toBe(0x02014b50);
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const offset = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));

    const localNameLen = view.getUint16(offset + 26, true);
    const localExtraLen = view.getUint16(offset + 28, true);
    const start = offset + 30 + localNameLen + localExtraLen;
    const body = bytes.subarray(start, start + compressedSize);
    out.set(name, new TextDecoder().decode(method === 8 ? inflateRawSync(body) : body));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

describe("xlsx helpers", () => {
  it("escapes the XML metacharacters and strips control bytes", () => {
    expect(escapeXml('a & b < c > d "e"')).toBe("a &amp; b &lt; c &gt; d &quot;e&quot;");
    expect(escapeXml("clean\u0007text")).toBe("cleantext");
  });

  it("names columns the way a spreadsheet does", () => {
    // 1-based, like a spreadsheet: muster rolls run well past Z.
    expect([1, 2, 26, 27, 28, 52, 53].map(colLetter)).toEqual(["A", "B", "Z", "AA", "AB", "AZ", "BA"]);
  });

  it("sanitises sheet tab names Excel would reject", () => {
    expect(sheetTabName("Daily attendance")).toBe("Daily attendance");
    expect(sheetTabName("a/b:c*d?e[f]")).not.toMatch(/[/\\:*?[\]]/);
    expect(sheetTabName("x".repeat(60)).length).toBeLessThanOrEqual(31);
    expect(sheetTabName("")).not.toBe("");
  });
});

describe("toXlsx", () => {
  const files = unzip(toXlsx({ rows, columns, name: "Daily attendance" }));
  const sheet = files.get("xl/worksheets/sheet1.xml")!;

  it("produces a zip carrying every part a workbook needs", () => {
    for (const part of [
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
    ]) {
      expect(files.has(part), `missing ${part}`).toBe(true);
    }
    expect(files.get("xl/workbook.xml")).toContain('name="Daily attendance"');
  });

  it("starts with the zip magic bytes, so the browser sees a real file", () => {
    const bytes = toXlsx({ rows, columns, name: "s" });
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("writes a header row plus one row per record", () => {
    expect(sheet).toContain("<t>Guard</t>");
    expect((sheet.match(/<row /g) ?? []).length).toBe(rows.length + 1);
  });

  it("types numbers and dates as numbers and dates, not text", () => {
    // 8.5 is a bare numeric cell (no t="str"), and the date carries a date style.
    expect(sheet).toMatch(/<c r="B2"[^>]*><v>8\.5<\/v><\/c>/);
    expect(sheet).toMatch(/<c r="C2" s="\d+"><v>46266<\/v><\/c>/);
  });

  it("escapes text that would otherwise break the XML", () => {
    expect(sheet).toContain("Suresh &quot;Gowda&quot; &lt;2&gt;");
    expect(sheet).not.toContain('Suresh "Gowda" <2>');
  });

  it("keeps map links clickable", () => {
    const rels = files.get("xl/worksheets/_rels/sheet1.xml.rels")!;
    expect(sheet).toContain("<hyperlinks>");
    expect(rels).toContain("https://www.google.com/maps?q=12.95,77.6");
  });

  it("freezes the header and the pinned identity columns", () => {
    // One pinned column + the header row => split at B2.
    expect(sheet).toContain('<pane xSplit="1" ySplit="1" topLeftCell="B2"');
    expect(sheet).toContain('state="frozen"');
  });

  it("freezes only the header when nothing is pinned", () => {
    const plain = unzip(toXlsx({ rows, columns: [{ header: "Guard", value: (r) => r.guard }], name: "s" }));
    expect(plain.get("xl/worksheets/sheet1.xml")).toContain('ySplit="1"');
  });

  it("survives an empty row set", () => {
    const empty = unzip(toXlsx({ rows: [], columns, name: "s" }));
    expect((empty.get("xl/worksheets/sheet1.xml")!.match(/<row /g) ?? []).length).toBe(1);
  });
});

describe("xlsxResponse", () => {
  it("is served as a spreadsheet download", () => {
    const res = xlsxResponse(toXlsx({ rows, columns, name: "s" }), "daily-attendance.xlsx");
    expect(res.headers.get("Content-Type")).toBe(XLSX_CONTENT_TYPE);
    expect(res.headers.get("Content-Disposition")).toContain('filename="daily-attendance.xlsx"');
  });
});
