import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, View } from "react-native";
import { guardApi } from "@/api/guardApi";
import { env } from "@/api/supabase";
import { signOut, useStore } from "@/data/store";
import { displayPhone } from "@/domain/phone";
import { useI18n, useT } from "@/i18n";
import { Body, KvRow, Mono, Pill, Screen, SecondaryButton, Section, TextButton } from "@/ui/components";
import { docStatus, docType, kycGap } from "@/ui/labels";
import { radius } from "@/ui/theme";
import { usePalette } from "@/ui/usePalette";

export default function ProfileScreen() {
  const t = useT(); const p = usePalette(); const router = useRouter();
  const me = useStore((s) => s.me); const { lang, setLang } = useI18n();
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const g = me?.guard;
  useEffect(() => { if (g?.registration_selfie_path) guardApi.signedUrl("selfies", g.registration_selfie_path).then(setSelfieUrl).catch(() => undefined); }, [g?.registration_selfie_path]);
  const chip = (k: "en" | "hi", label: string) => (
    <Pressable onPress={() => setLang(k)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: lang === k ? p.olive : p.border, backgroundColor: lang === k ? p.oliveSoft : p.card }}><Body>{label}</Body></Pressable>
  );
  return (
    <Screen eyebrow={t("profile_eyebrow")} title={g?.full_name ?? ""} description={g?.designation ?? null} onBack={() => router.back()}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {selfieUrl ? <Image source={{ uri: selfieUrl }} style={{ width: 72, height: 72, borderRadius: radius.md }} contentFit="cover" /> : null}
        <TextButton text={t("profile_retake_selfie")} onPress={() => router.push({ pathname: "/reg-selfie", params: { again: "1" } } as never)} />
      </View>
      <KvRow label={t("profile_code")} value={g?.employee_code ?? "–"} mono />
      <KvRow label={t("profile_phone")} value={g?.phone ? displayPhone(g.phone) : "–"} mono />
      <KvRow label={t("profile_site")} value={me?.site?.name ?? "–"} />
      <KvRow label={t("profile_supervisor")} value={me?.supervisor?.name ?? "–"} />
      <KvRow label={t("profile_agency")} value={me?.agency.name ?? "–"} />
      {me?.supervisor?.phone ? <SecondaryButton text={t("profile_call_supervisor")} onPress={() => { void Linking.openURL(`tel:${me.supervisor!.phone}`); }} /> : null}

      <Section title={t("profile_kyc")} right={!me?.kyc_missing.length ? <Pill text={t("profile_kyc_complete")} tone="present" /> : undefined} />
      {["aadhaar", "pan", "police_verification", "guard_kyc", "marksheet"].map((type) => {
        const doc = me?.documents.find((d) => d.type === type);
        const [label, tone] = docStatus(doc?.has_file ? doc.status : null);
        return <View key={type} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: p.border + "99" }}><View style={{ flex: 1 }}><Body>{docType(type)}</Body></View><Pill text={label} tone={tone} /></View>;
      })}
      {me?.kyc_missing.length ? <Body muted size={13}>{t("profile_kyc_missing", me.kyc_missing.map(kycGap).join(", "))}</Body> : null}

      <Section title={t("profile_language")} />
      <View style={{ flexDirection: "row", gap: 8 }}>{chip("en", t("profile_language_en"))}{chip("hi", t("profile_language_hi"))}</View>

      <Section title="" />
      <SecondaryButton text={t("profile_change_pin")} onPress={() => router.push("/change-pin" as never)} />
      <SecondaryButton text={t("profile_sign_out")} onPress={() => Alert.alert(t("profile_sign_out"), t("profile_sign_out_confirm"), [{ text: t("cancel"), style: "cancel" }, { text: t("profile_sign_out"), style: "destructive", onPress: () => { void signOut(); } }])} />
      <Mono>{t("profile_version", env.appVersion, env.otaChannel)}</Mono>
    </Screen>
  );
}
