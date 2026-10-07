import { Linking } from "react-native";
import { env } from "@/api/supabase";
import { useStore } from "@/data/store";
import { useT } from "@/i18n";
import { BigButton, Screen } from "@/ui/components";

export default function ForceUpdateScreen() {
  const t = useT(); const min = useStore((s) => s.me?.config?.min_app_version ?? "");
  return <Screen eyebrow={t("brand_eyebrow")} title={t("update_title")} description={t("update_body", min, env.appVersion)} bottom={<BigButton text={t("update_button")} onPress={() => { void Linking.openURL(env.playStoreUrl); }} />} />;
}
