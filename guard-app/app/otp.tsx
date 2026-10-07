import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { requestOtp, useStore, verifyOtp } from "@/data/store";
import { displayPhone } from "@/domain/phone";
import { useT } from "@/i18n";
import { Banner, Mono, NumberPad, PinDots, Screen, TextButton } from "@/ui/components";
import { errorText } from "@/ui/labels";
import { usePalette } from "@/ui/usePalette";

export default function OtpScreen() {
  const t = useT(); const p = usePalette(); const router = useRouter();
  const phone = useStore((s) => s.pendingPhone) ?? "";
  const [code, setCode] = useState(""); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (code.length !== 6 || busy) return;
    setBusy(true); setError(null);
    verifyOtp(code).catch((e) => { setError(errorText(e)); setCode(""); }).finally(() => setBusy(false));
  }, [code]);
  return (
    <Screen eyebrow={t("otp_eyebrow")} title={t("otp_title")} description={t("otp_body", displayPhone(phone))} onBack={() => router.back()} scroll={false}
      bottom={<>
        <NumberPad onDigit={(d) => setCode((c) => (c.length < 6 ? c + d : c))} onBackspace={() => setCode((c) => c.slice(0, -1))} disabled={busy} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <TextButton text={t("otp_resend")} onPress={() => { void requestOtp(phone).catch(() => undefined); }} />
          <TextButton text={t("otp_change_number")} onPress={() => router.back()} />
        </View>
      </>}>
      <View style={{ alignItems: "center" }}>
        <PinDots length={6} filled={code.length} error={!!error} />
        <Mono size={28} color={p.ink}>{code.padEnd(6, "·").replace(/(.{3})(.{3})/, "$1  $2")}</Mono>
      </View>
      {error ? <Banner text={error} tone="signal" /> : null}
    </Screen>
  );
}
