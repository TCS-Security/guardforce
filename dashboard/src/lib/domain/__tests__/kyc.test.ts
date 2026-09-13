import { describe, expect, it } from "vitest";
import { kycGaps, kycComplete, kycProgress, maskAadhaar, maskPan } from "../kyc";

const guard = { phone_verified_at: "2026-01-01", registration_selfie_path: "x.jpg", designation: "Gate Guard" };
const doc = (type: string, status = "verified", file_path: string | null = "f") => ({ type, status, file_path }) as never;
const fullDocs = [doc("aadhaar"), doc("pan"), doc("police_verification"), doc("guard_kyc")];

describe("kycGaps (KYC-1)", () => {
  it("is complete with all mandatory items", () => {
    expect(kycGaps(guard, fullDocs)).toEqual([]);
    expect(kycComplete(guard, fullDocs)).toBe(true);
    expect(kycProgress(guard, fullDocs)).toBe(100);
  });
  it("lists every missing mandatory slot", () => {
    expect(kycGaps({ phone_verified_at: null, registration_selfie_path: null, designation: "" }, [])).toEqual([
      "phone_verification", "registration_selfie", "designation", "aadhaar", "pan", "police_verification", "guard_kyc",
    ]);
  });
  it("treats rejected or fileless docs as missing, pending as present", () => {
    expect(kycGaps(guard, [doc("aadhaar", "rejected"), doc("pan", "pending"), doc("police_verification", "verified", null), doc("guard_kyc")])).toEqual(["aadhaar", "police_verification"]);
  });
  it("ignores the optional marksheet", () => {
    expect(kycGaps(guard, [...fullDocs, doc("marksheet", "rejected")])).toEqual([]);
  });
  it("reports partial progress", () => {
    expect(kycProgress(guard, [doc("aadhaar"), doc("pan")])).toBe(71);
  });
});

describe("masking", () => {
  it("masks Aadhaar to the last 4", () => {
    expect(maskAadhaar("1234 5678 9012")).toBe("XXXX XXXX 9012");
    expect(maskAadhaar("12")).toBe("XXXX XXXX XXXX");
  });
  it("masks PAN keeping the numeric core", () => {
    expect(maskPan("abcde1234f")).toBe("XXXXX1234X");
    expect(maskPan("bad")).toBe("XXXXXXXXXX");
  });
});
