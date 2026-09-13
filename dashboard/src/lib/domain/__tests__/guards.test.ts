import { describe, it, expect } from "vitest";
import {
  normalizePhone, isValidIndianMobile, nextEmployeeCode, inviteDeepLink, whatsappUrl, smsUrl,
  clampShareDays, shareExpiresAt, shareState, shareDaysLeft, kycObjectPath,
  SHARE_EXPIRY_DEFAULT_DAYS, SHARE_EXPIRY_MAX_DAYS,
} from "../guards";

describe("normalizePhone", () => {
  it("strips punctuation, +91 and leading 0", () => {
    expect(normalizePhone("+91 99000 00001")).toBe("9900000001");
    expect(normalizePhone("099000-00001")).toBe("9900000001");
    expect(normalizePhone("9900000001")).toBe("9900000001");
  });
  it("returns digits as-is when it cannot recognise a prefix", () => {
    expect(normalizePhone("12345")).toBe("12345");
    expect(normalizePhone("")).toBe("");
  });
});

describe("isValidIndianMobile", () => {
  it.each(["9900000001", "6000000000", "+91 78901 23456", "07890123456"])("accepts %s", (p) => {
    expect(isValidIndianMobile(p)).toBe(true);
  });
  it.each(["5900000001", "990000000", "99000000012", "abcdefghij", "", "0000000000"])("rejects %s", (p) => {
    expect(isValidIndianMobile(p)).toBe(false);
  });
});

describe("nextEmployeeCode", () => {
  it("continues the dominant series and keeps the padding", () => {
    expect(nextEmployeeCode(["SSS-001", "SSS-002", "SSS-016"])).toBe("SSS-017");
    expect(nextEmployeeCode(["SSS-099"])).toBe("SSS-100");
    expect(nextEmployeeCode(["G-9"])).toBe("G-10");
  });
  it("ignores blanks, nulls and codes without a number", () => {
    expect(nextEmployeeCode([null, undefined, "  ", "temp", "SSS-004"])).toBe("SSS-005");
  });
  it("prefers the most common prefix", () => {
    expect(nextEmployeeCode(["OLD-900", "SSS-001", "SSS-002"])).toBe("SSS-003");
  });
  it("falls back when there is nothing to continue", () => {
    expect(nextEmployeeCode([], "SSS-")).toBe("SSS-001");
    expect(nextEmployeeCode([])).toBe("GRD-001");
  });
});

describe("invite links", () => {
  it("builds the app deep link", () => {
    expect(inviteDeepLink("abc123")).toBe("guardforce://invite/abc123");
  });
  it("builds wa.me and sms links with the 91 country code and encoded body", () => {
    expect(whatsappUrl("+91 99000 00001", "hi there")).toBe("https://wa.me/919900000001?text=hi%20there");
    expect(smsUrl("9900000001", "hi there")).toBe("sms:+919900000001?&body=hi%20there");
  });
});

describe("share expiry math", () => {
  const now = new Date("2026-09-13T10:00:00Z");

  it("clamps the requested lifetime to 1..90 days, defaulting to 30", () => {
    expect(clampShareDays(undefined)).toBe(SHARE_EXPIRY_DEFAULT_DAYS);
    expect(clampShareDays(Number.NaN)).toBe(SHARE_EXPIRY_DEFAULT_DAYS);
    expect(clampShareDays(0)).toBe(1);
    expect(clampShareDays(-5)).toBe(1);
    expect(clampShareDays(45)).toBe(45);
    expect(clampShareDays(120)).toBe(SHARE_EXPIRY_MAX_DAYS);
  });

  it("computes the expiry instant from the clamped lifetime", () => {
    expect(shareExpiresAt(30, now).toISOString()).toBe("2026-10-13T10:00:00.000Z");
    expect(shareExpiresAt(1000, now).toISOString()).toBe(shareExpiresAt(90, now).toISOString());
  });

  it("classifies revoked before expired", () => {
    expect(shareState({ expires_at: "2026-10-13T10:00:00Z" }, now)).toBe("active");
    expect(shareState({ expires_at: "2026-09-01T10:00:00Z" }, now)).toBe("expired");
    expect(shareState({ expires_at: "2026-10-13T10:00:00Z", revoked_at: "2026-09-12T00:00:00Z" }, now)).toBe("revoked");
    expect(shareState({ expires_at: "2026-09-01T10:00:00Z", revoked_at: "2026-08-30T00:00:00Z" }, now)).toBe("revoked");
  });

  it("counts whole days left and never goes negative", () => {
    expect(shareDaysLeft("2026-09-23T10:00:00Z", now)).toBe(10);
    expect(shareDaysLeft("2026-09-13T22:00:00Z", now)).toBe(1);
    expect(shareDaysLeft("2026-09-01T10:00:00Z", now)).toBe(0);
  });
});

describe("kycObjectPath", () => {
  it("namespaces by agency and guard key and timestamps the object", () => {
    const at = new Date("2026-09-13T10:00:00Z");
    expect(kycObjectPath("agency-1", "SSS-017", "aadhaar", "scan of card.PNG", at))
      .toBe(`agency-1/kyc/SSS-017/aadhaar-${at.getTime()}.png`);
  });
  it("sanitises the key and copes with extension-less names", () => {
    const at = new Date("2026-09-13T10:00:00Z");
    expect(kycObjectPath("a", "SSS 17/x", "pan", "scan", at)).toBe(`a/kyc/SSS_17_x/pan-${at.getTime()}.bin`);
  });
});
