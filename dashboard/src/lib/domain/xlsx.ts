/**
 * A tiny, dependency-free .xlsx writer.
 *
 * An .xlsx file is just a zip of a handful of XML parts, so we build the parts
 * by hand and deflate them with `node:zlib` rather than pulling a spreadsheet
 * library in. What we need from it is narrow and stable:
 *
 *   - typed cells (dates as real dates, numbers as real numbers) so Excel and
 *     Google Sheets can sum and sort a column instead of treating it as text,
 *   - a bold header row,
 *   - frozen header + frozen identity columns, so the pinned columns the
 *     dashboard shows survive the download,
 *   - sensible column widths and clickable hyperlinks (the map links).
 *
 * Server-only: route handlers call `toXlsx`. Nothing here touches the DOM.
 */
import { deflateRawSync } from "node:zlib";
import type { CsvColumn } from "./csv";

// ---------------------------------------------------------------------------
// Cell model
// ---------------------------------------------------------------------------

/**
 * What a single cell should become in the sheet. `serial` carries an Excel date
 * serial (days since 1899-12-30) plus which of our three date/time formats to
 * render it with — see `excelSerial` in `format.ts` for the timezone rule.
 */
export type XlsxCell =
  | { t: "text"; v: string }
  | { t: "number"; v: number }
  | { t: "serial"; v: number; fmt: "date" | "time" | "datetime" }
  | { t: "link"; v: string; href: string }
  | { t: "blank" };

/** Style indices into `cellXfs` below — keep in sync with `STYLES_XML`. */
const STYLE = { text: 0, header: 1, date: 2, time: 3, datetime: 4, link: 5 } as const;

const SERIAL_STYLE = { date: STYLE.date, time: STYLE.time, datetime: STYLE.datetime } as const;

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const CONTROL_CHARS = new RegExp("[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f]", "g");

export function escapeXml(value: string) {
  return value
    .replace(CONTROL_CHARS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 1 -> "A", 27 -> "AA". Muster rolls run past Z, so this has to be right. */
export function colLetter(index: number) {
  let n = index;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Excel refuses []:*?/\ in a sheet name and truncates past 31 characters. */
export function sheetTabName(name: string) {
  const cleaned = name.replace(/[[\]:*?/\\]/g, " ").trim();
  return (cleaned || "Sheet1").slice(0, 31);
}

// ---------------------------------------------------------------------------
// Static parts
// ---------------------------------------------------------------------------

const CONTENT_TYPES_XML = `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

const ROOT_RELS_XML = `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const WORKBOOK_RELS_XML = `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

/**
 * Number formats 164/165/166 are the founder's DD-MM-YY / HH:MM pair (never
 * seconds). The cellXfs order must match `STYLE` above.
 */
const STYLES_XML =
  `${XML_DECL}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="3">` +
  `<numFmt numFmtId="164" formatCode="DD-MM-YY"/>` +
  `<numFmt numFmtId="165" formatCode="HH:MM"/>` +
  `<numFmt numFmtId="166" formatCode="DD-MM-YY HH:MM"/>` +
  `</numFmts>` +
  `<fonts count="3">` +
  `<font><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><name val="Calibri"/></font>` +
  `<font><u/><color rgb="FF0563C1"/><sz val="11"/><name val="Calibri"/></font>` +
  `</fonts>` +
  `<fills count="3">` +
  `<fill><patternFill patternType="none"/></fill>` +
  `<fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFEDEDE4"/><bgColor indexed="64"/></patternFill></fill>` +
  `</fills>` +
  `<borders count="2">` +
  `<border><left/><right/><top/><bottom/><diagonal/></border>` +
  `<border><left/><right/><top/><bottom style="thin"><color rgb="FFB7B7A8"/></bottom><diagonal/></border>` +
  `</borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="6">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

// ---------------------------------------------------------------------------
// Sheet building
// ---------------------------------------------------------------------------

/** Falls back to the CSV `value()` when a column has no explicit xlsx `cell()`. */
function inferCell<T>(column: CsvColumn<T>, row: T): XlsxCell {
  if (column.cell) return column.cell(row);
  const link = column.link?.(row);
  if (link) return { t: "link", v: link.href, href: link.href };
  const v = column.value(row);
  if (v == null || v === "") return { t: "blank" };
  if (typeof v === "number") return Number.isFinite(v) ? { t: "number", v } : { t: "blank" };
  return { t: "text", v: String(v) };
}

function cellXml(ref: string, cell: XlsxCell, hyperlinks: { ref: string; href: string }[]) {
  switch (cell.t) {
    case "blank":
      return "";
    case "number":
      return `<c r="${ref}"><v>${cell.v}</v></c>`;
    case "serial":
      return `<c r="${ref}" s="${SERIAL_STYLE[cell.fmt]}"><v>${cell.v}</v></c>`;
    case "link":
      hyperlinks.push({ ref, href: cell.href });
      return `<c r="${ref}" s="${STYLE.link}" t="inlineStr"><is><t>${escapeXml(cell.v)}</t></is></c>`;
    default:
      return `<c r="${ref}" s="${STYLE.text}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.v)}</t></is></c>`;
  }
}

/** Widths come from the column definition; everything else gets a readable default. */
function colsXml<T>(columns: CsvColumn<T>[]) {
  const parts = columns.map((c, i) => {
    const px = c.width ?? (c.align === "right" ? 90 : 130);
    const chars = Math.min(60, Math.max(6, Math.round(px / 7.5)));
    return `<col min="${i + 1}" max="${i + 1}" width="${chars}" customWidth="1"/>`;
  });
  return parts.length === 0 ? "" : `<cols>${parts.join("")}</cols>`;
}

function sheetXml<T>(rows: T[], columns: CsvColumn<T>[], freezeCols: number) {
  const hyperlinks: { ref: string; href: string }[] = [];
  const body: string[] = [];

  const head = columns
    .map((c, i) => `<c r="${colLetter(i + 1)}1" s="${STYLE.header}" t="inlineStr"><is><t>${escapeXml(c.header)}</t></is></c>`)
    .join("");
  body.push(`<row r="1" ht="18" customHeight="1">${head}</row>`);

  rows.forEach((row, r) => {
    const n = r + 2;
    const cells = columns.map((c, i) => cellXml(`${colLetter(i + 1)}${n}`, inferCell(c, row), hyperlinks)).join("");
    body.push(`<row r="${n}">${cells}</row>`);
  });

  const lastCol = colLetter(Math.max(1, columns.length));
  const lastRow = rows.length + 1;
  const topLeft = `${colLetter(freezeCols + 1)}2`;
  const pane =
    `<pane${freezeCols > 0 ? ` xSplit="${freezeCols}"` : ""} ySplit="1" topLeftCell="${topLeft}" activePane="bottomRight" state="frozen"/>` +
    `<selection pane="bottomRight" activeCell="${topLeft}" sqref="${topLeft}"/>`;

  const links =
    hyperlinks.length === 0
      ? ""
      : `<hyperlinks>${hyperlinks.map((h, i) => `<hyperlink ref="${h.ref}" r:id="rHl${i + 1}"/>`).join("")}</hyperlinks>`;

  const xml =
    `${XML_DECL}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<dimension ref="A1:${lastCol}${lastRow}"/>` +
    `<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    colsXml(columns) +
    `<sheetData>${body.join("")}</sheetData>` +
    `<autoFilter ref="A1:${lastCol}${lastRow}"/>` +
    links +
    `</worksheet>`;

  const rels =
    hyperlinks.length === 0
      ? null
      : `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        hyperlinks
          .map(
            (h, i) =>
              `<Relationship Id="rHl${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(h.href)}" TargetMode="External"/>`,
          )
          .join("") +
        `</Relationships>`;

  return { xml, rels };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type XlsxOptions<T> = {
  rows: T[];
  columns: CsvColumn<T>[];
  /** Tab name; sanitised for you. */
  name: string;
  /**
   * How many leading columns stay frozen when you scroll right. Defaults to the
   * number of columns the dashboard pins, so the download matches the screen.
   */
  freezeCols?: number;
};

/** Builds a complete .xlsx workbook with one sheet. */
export function toXlsx<T>({ rows, columns, name, freezeCols }: XlsxOptions<T>): Uint8Array {
  const wanted = freezeCols ?? columns.filter((c) => c.pin).length;
  const frozen = Math.max(0, Math.min(wanted, Math.max(0, columns.length - 1)));
  const sheet = sheetXml(rows, columns, frozen);
  const workbook =
    `${XML_DECL}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${escapeXml(sheetTabName(name))}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const files: ZipEntry[] = [
    { name: "[Content_Types].xml", data: CONTENT_TYPES_XML },
    { name: "_rels/.rels", data: ROOT_RELS_XML },
    { name: "xl/workbook.xml", data: workbook },
    { name: "xl/_rels/workbook.xml.rels", data: WORKBOOK_RELS_XML },
    { name: "xl/styles.xml", data: STYLES_XML },
    { name: "xl/worksheets/sheet1.xml", data: sheet.xml },
  ];
  if (sheet.rels) files.push({ name: "xl/worksheets/_rels/sheet1.xml.rels", data: sheet.rels });
  return zip(files);
}

export const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function xlsxResponse(bytes: Uint8Array, filename: string) {
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-store",
    },
  });
}

// ---------------------------------------------------------------------------
// Minimal zip writer (deflate, no zip64 — report exports never reach 4 GB)
// ---------------------------------------------------------------------------

type ZipEntry = { name: string; data: string };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Fixed DOS timestamp (1980-01-01) keeps the output byte-for-byte reproducible. */
const DOS_TIME = 0;
const DOS_DATE = 33;

function zip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const raw = encoder.encode(entry.data);
    const deflated = new Uint8Array(deflateRawSync(raw));
    const crc = crc32(raw);

    const local = new Uint8Array(30 + nameBytes.length + deflated.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint16(8, 8, true); // deflate
    lv.setUint16(10, DOS_TIME, true);
    lv.setUint16(12, DOS_DATE, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, deflated.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(deflated, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 8, true);
    cv.setUint16(12, DOS_TIME, true);
    cv.setUint16(14, DOS_DATE, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, deflated.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length;
  }

  const centralSize = centrals.reduce((a, c) => a + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const total = offset + centralSize + end.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const chunk of [...locals, ...centrals, end]) {
    out.set(chunk, p);
    p += chunk.length;
  }
  return out;
}
