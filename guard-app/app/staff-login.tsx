import { useRouter } from "expo-router";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { staffSignIn } from "@/data/store";
import { useT } from "@/i18n";
import { Banner, BigButton, Body, Screen } from "@/ui/components";
import { errorText } from "@/ui/labels";
import { fonts, radius } from "@/ui/theme";
import { usePalette } from "@/ui/usePalette";

/** Owners and supervisors use their dashboard credentials. Phone OTP for staff can come later. */
export default function StaffLoginScreen() {
  const t = useT(); const p = usePalette(); const router = useRouter();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const field = { borderWidth: 1, borderColor: p.border, borderRadius: radius.md, backgroundColor: p.card, paddingHorizontal: 14, height: 56, fontFamily: fonts.body, fontSize: 17, color: p.ink } as const;
  return (
    <Screen eyebrow={t("staff_login_eyebrow")} title={t("staff_login_title")} description={t("staff_login_body")} onBack={() => router.back()}
      bottom={<BigButton text={t("staff_login_button")} loading={busy} disabled={!email || !password} onPress={async () => {
        setBusy(true); setError(null);
        try { await staffSignIn(email, password); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
      }} />}>
      <View><Body muted size={13}>{t("staff_login_email")}</Body><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={field} placeholderTextColor={p.muted} /></View>
      <View><Body muted size={13}>{t("staff_login_password")}</Body><TextInput value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" style={field} placeholderTextColor={p.muted} /></View>
      {error ? <Banner text={error} tone="signal" /> : null}
    </Screen>
  );
}
