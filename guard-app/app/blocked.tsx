import { signOut, useStore } from "@/data/store";
import { useT } from "@/i18n";
import { Banner, Screen, SecondaryButton } from "@/ui/components";

export default function BlockedScreen() {
  const t = useT(); const me = useStore((s) => s.me);
  const inactive = me?.guard.status === "inactive";
  return <Screen eyebrow={t("brand_eyebrow")} title={t("blocked_title")} bottom={<SecondaryButton text={t("profile_sign_out")} onPress={() => { void signOut(); }} />}><Banner text={inactive ? t("blocked_inactive") : t("blocked_suspended")} tone="signal" /></Screen>;
}
