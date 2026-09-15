import * as LocalAuthentication from "expo-local-authentication";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { prefs } from "@/auth/prefs";
import { signOut, unlock, unlockWithDevice } from "@/data/store";
import { useT } from "@/i18n";
import { Banner, NumberPad, PinDots, Screen, TextButton } from "@/ui/components";

export default function LockScreen() {
  const t = useT();
  const [pin, setPinValue] = useState(""); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [name, setName] = useState(""); const [biometric, setBiometric] = useState(false);
  useEffect(() => {
    void prefs.guardName().then((n) => setName(n ?? ""));
    void (async () => setBiometric((await prefs.hasLocalPin()) && (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync())))();
  }, []);
  useEffect(() => {
    if (pin.length !== 4 || busy) return;
    setBusy(true);
    unlock(pin).then((ok) => { if (!ok) { setError(t("lock_wrong")); setPinValue(""); } }).finally(() => setBusy(false));
  }, [pin]);
  const runBiometric = async () => {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: t("lock_title"), cancelLabel: t("cancel") });
    if (r.success) await unlockWithDevice();
  };
  return (
    <Screen eyebrow={t("lock_eyebrow")} title={t("lock_title")} description={name ? t("lock_hello", name) : null} scroll={false}
      bottom={<>
        <NumberPad onDigit={(d) => { setError(null); setPinValue((v) => (v.length < 4 ? v + d : v)); }} onBackspace={() => setPinValue((v) => v.slice(0, -1))} disabled={busy} />
        <View style={{ alignItems: "center" }}>
          {biometric ? <TextButton text={t("lock_biometric")} onPress={() => { void runBiometric(); }} /> : null}
          <TextButton text={t("lock_forgot")} onPress={() => { void signOut(); }} />
        </View>
      </>}>
      <View style={{ alignItems: "center" }}><PinDots length={4} filled={pin.length} error={!!error} /></View>
      {error ? <Banner text={error} tone="signal" /> : null}
    </Screen>
  );
}
