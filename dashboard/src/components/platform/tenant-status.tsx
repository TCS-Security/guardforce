import type { Tone } from "@/lib/domain/status";

export const TENANT_STATUS: Record<"trial" | "active" | "suspended" | "churned", { label: string; tone: Tone; hint: string }> = {
  trial: { label: "Trial", tone: "half-day", hint: "Evaluating; full features, unbilled" },
  active: { label: "Active", tone: "present", hint: "Live customer" },
  suspended: { label: "Suspended", tone: "absent", hint: "Members are locked out; data is kept" },
  churned: { label: "Closed", tone: "neutral", hint: "Left the platform; data retained for the retention window" },
};

export const PLANS = [
  { value: "pilot", label: "Pilot", hint: "Design partner, unbilled" },
  { value: "starter", label: "Starter", hint: "Free up to 5 guards, 1 site" },
  { value: "growth", label: "Growth", hint: "Full P0 feature set" },
  { value: "scale", label: "Scale", hint: "Growth plus the P1 pack and API" },
] as const;
