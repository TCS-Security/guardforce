import { useRouter } from "expo-router";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { requestOtp } from "@/data/store";
import { toE164 } from "@/domain/phone";
import { useT } from "@/i18n";
import { Banner, BigButton, Body, Screen, TextButton } from "@/ui/components";
import { errorText } from "@/ui/labels";
import { fonts, radius } from "@/ui/theme";
import { usePalette } from "@/ui/usePalette";

export default function PhoneScreen() {
  const t = useT(); const p = usePalette(); const router = useRouter();
  const [phone, setPhone] = useState(""); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async () => {
    const e164 = toE164(phone);
    if (!e164) { setError(t("phone_invalid")); return; }
    setBusy(true); setError(null);
    try { await requestOtp(e164); router.push("/otp"); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <Screen eyebrow={t("onboarding_eyebrow")} title={t("onboarding_title")} description={t("onboarding_body")} bottom={<BigButton text={t("send_otp")} onPress={submit} loading={busy} />}>
      <View>
        <Body muted size={13}>{t("phone_label")}</Body>
        <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: error ? p.destructive : p.border, borderRadius: radius.md, backgroundColor: p.card, paddingHorizontal: 14, height: 56, marginTop: 6 }}>
          <Body muted>{t("phone_prefix")} </Body>
          <TextInput value={phone} onChangeText={(v) => setPhone(v.replace(/[^\d+]/g, "").slice(0, 13))} keyboardType="phone-pad" placeholder={t("phone_hint")} placeholderTextColor={p.muted}
            style={{ flex: 1, fontFamily: fonts.mono, fontSize: 20, color: p.ink }} autoFocus />
        </View>
      </View>
      {error ? <Banner text={error} tone="signal" /> : null}
      <View style={{ alignItems: "center", marginTop: 8 }}><TextButton text={t("staff_login_link")} onPress={() => router.push("/staff-login" as never)} /></View>
    </Screen>
  );
}
