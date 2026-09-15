import { ApiError, toApiError } from "../api/errors";
import { displayPhone, tenDigits, toE164 } from "../domain/phone";
import { compareVersions, needsUpdate } from "../domain/semver";

test("semver orders numerically", () => {
  expect(compareVersions("1.10.0", "1.9.9")).toBeGreaterThan(0);
  expect(compareVersions("1.2", "1.2.0")).toBe(0);
  expect(needsUpdate("1.0.0", "1.1.0")).toBe(true);
  expect(needsUpdate("1.1.0", "1.1.0")).toBe(false);
  expect(needsUpdate("1.0.0", null)).toBe(false);
});
test("phone accepts the formats guards type and rejects the rest", () => {
  expect(tenDigits("+91 99000 00001")).toBe("9900000001");
  expect(tenDigits("09900000001")).toBe("9900000001");
  expect(tenDigits("00919900000001")).toBe("9900000001");
  expect(toE164("99000 00001")).toBe("+919900000001");
  expect(tenDigits("0801234567")).toBeNull();
  expect(tenDigits("12345")).toBeNull();
  expect(displayPhone("919900000001")).toBe("+91 99000 00001");
});
test("PL/pgSQL raises become domain-coded errors; network errors are retryable", () => {
  const e = toApiError({ message: "TAMPER_SUSPECTED: mock location provider detected", code: "P0002" });
  expect(e).toBeInstanceOf(ApiError); expect(e.code).toBe("TAMPER_SUSPECTED"); expect(e.retryable).toBe(false);
  expect(toApiError({ message: "NO_GUARD_FOR_PHONE", code: "P0013" }).code).toBe("NO_GUARD_FOR_PHONE");
  expect(toApiError(new TypeError("Network request failed")).retryable).toBe(true);
  expect(toApiError({ message: "boom", status: 503 }).retryable).toBe(true);
  expect(toApiError({ message: "Token has expired", status: 400 }).code).toBe("ERROR");
});
