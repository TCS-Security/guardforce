import { useRouter } from "expo-router";
import { Alert, Pressable, View } from "react-native";
import { env } from "@/api/supabase";
import { useStaff } from "@/data/staffStore";
import { signOut } from "@/data/store";
import { useI18n, useT } from "@/i18n";
import { Body, KvRow, Mono, Screen, SecondaryButton, Section } from "@/ui/components";
import { usePalette } from "@/ui/usePalette";

export default function SupervisorAccountScreen() {
  const t = useT(); const p = usePalette(); const router = useRouter();
  const me = useStaff((s) => s.me); const { lang, setLang } = useI18n();
  const chip = (k: "en" | "hi", label: string) => (
    <Pressable key={k} onPress={() => setLang(k)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: lang === k ? p.olive : p.border, backgroundColor: lang === k ? p.oliveSoft : p.card }}><Body>{label}</Body></Pressable>
  );
  return (
    <Screen eyebrow={t("sup_profile_eyebrow")} title={me?.profile.full_name ?? ""} description={me?.profile.role_name ?? me?.profile.role ?? null} onBack={() => router.back()}>
      <KvRow label={t("sup_profile_name")} value={me?.profile.full_name ?? "–"} />
      <KvRow label={t("staff_login_email")} value={me?.profile.email ?? "–"} mono />
      <KvRow label={t("sup_profile_role")} value={me?.profile.role_name ?? me?.profile.role ?? "–"} />
      <KvRow label={t("sup_profile_sites")} value={me?.profile.all_sites ? t("sup_all_sites") : (me?.sites.map((s) => s.name).join(", ") || "–")} />
      <KvRow label={t("profile_agency")} value={me?.agency.name ?? "–"} />

      <Section title={t("profile_language")} />
      <View style={{ flexDirection: "row", gap: 8 }}>{chip("en", t("profile_language_en"))}{chip("hi", t("profile_language_hi"))}</View>

      <Section title="" />
      <SecondaryButton text={t("profile_sign_out")} onPress={() => Alert.alert(t("profile_sign_out"), t("profile_sign_out_confirm"), [{ text: t("cancel"), style: "cancel" }, { text: t("profile_sign_out"), style: "destructive", onPress: () => { void signOut(); } }])} />
      <Mono>{t("profile_version", env.appVersion, env.otaChannel)}</Mono>
    </Screen>
  );
}
