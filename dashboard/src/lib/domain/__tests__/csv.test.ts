import { describe, expect, it } from "vitest";
import { toCsv } from "../csv";

describe("toCsv", () => {
  it("escapes quotes, commas and newlines and prefixes a BOM", () => {
    const csv = toCsv([{ a: 'He said "hi", ok', b: 3 }, { a: "line\nbreak", b: null }], [
      { header: "Name", value: (r) => r.a },
      { header: "N", value: (r) => r.b },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"He said ""hi"", ok",3');
    expect(csv).toContain('"line\nbreak",');
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});
