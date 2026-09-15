import { useEffect, useState } from "react";
import { claim, refreshMe, signOut } from "@/data/store";
import { useT } from "@/i18n";
import { Banner, BigButton, Screen, SecondaryButton } from "@/ui/components";
import { errorText } from "@/ui/labels";

/** Runs claim_guard_account after the OTP; the two ways it fails get a plain explanation. */
export default function ClaimScreen() {
  const t = useT();
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(true);
  const run = () => { setBusy(true); setError(null); claim().then(() => refreshMe()).catch((e) => setError(errorText(e))).finally(() => setBusy(false)); };
  useEffect(run, []);
  return (
    <Screen eyebrow={t("otp_eyebrow")} title={busy ? t("loading") : t("blocked_title")}
      bottom={!busy ? <><BigButton text={t("retry")} onPress={run} /><SecondaryButton text={t("profile_sign_out")} onPress={() => { void signOut(); }} /></> : null}>
      {error ? <Banner text={error} tone="signal" /> : null}
    </Screen>
  );
}
