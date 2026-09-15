import { landingRoute } from "../auth/gate";

test("each auth stage lands where it must", () => {
  expect(landingRoute("signed_out", false, false, false, null)).toBe("/phone");
  expect(landingRoute("needs_claim", false, false, false, null)).toBe("/claim");
  expect(landingRoute("needs_pin", false, false, false, null)).toBe("/set-pin");
  expect(landingRoute("locked", true, true, false, null)).toBe("/lock");
});
test("ready sessions pass the update, block, permission and selfie gates in that order", () => {
  expect(landingRoute("ready", false, false, true, "suspended")).toBe("/update");
  expect(landingRoute("ready", false, false, false, "suspended")).toBe("/blocked");
  expect(landingRoute("ready", false, false, false, null)).toBe("/permissions");
  expect(landingRoute("ready", true, false, false, null)).toBe("/reg-selfie");
  expect(landingRoute("ready", true, true, false, null)).toBeNull();
});
