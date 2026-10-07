import { describe, expect, it } from "vitest";
import { telHref } from "../sos-board";

describe("telHref", () => {
  it("adds India's country code to a 10-digit number", () => {
    expect(telHref("9900000001")).toBe("tel:+919900000001");
    expect(telHref("99000 00001")).toBe("tel:+919900000001");
  });

  it("keeps a number that already carries it", () => {
    expect(telHref("919876543210")).toBe("tel:+919876543210");
    expect(telHref("+91 98765 43210")).toBe("tel:+919876543210");
  });
});
