import { t } from "@/i18n";
import type { Tone } from "@/ui/theme";

/** Shift lifecycle → label/tone, mirroring the dashboard's status map. */
export const shiftStatus = (s: string): [string, Tone] =>
  s === "in_progress" ? [t("sup_on_duty"), "present"]
    : s === "completed" ? [t("sup_completed"), "olive"]
      : s === "void_location_off" ? [t("sup_void"), "absent"]
        : s === "absent" ? [t("sup_no_show"), "absent"]
          : s === "cancelled" ? [t("sup_cancelled"), "neutral"]
            : [t("sup_scheduled"), "neutral"];

/** How much the shift's own evidence can be trusted. */
export const trust = (value: string | null | undefined): [string, Tone] =>
  value === "suspicious" ? [t("sup_trust_suspicious"), "absent"]
    : value === "flagged" ? [t("sup_trust_flagged"), "halfDay"]
      : [t("sup_trust_clean"), "present"];

export const alertTone = (severity: string): Tone => (severity === "critical" ? "absent" : "halfDay");
