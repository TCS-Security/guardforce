import { useState } from "react";
import { View } from "react-native";
import { setPin } from "@/data/store";
import { useT } from "@/i18n";
import { Banner, NumberPad, PinDots, Screen } from "@/ui/components";
import { errorText } from "@/ui/labels";

export function SetPin({ onDone, onBack }: { onDone: () => void; onBack?: () => void }) {
  const t = useT();
  const [first, setFirst] = useState(""); const [second, setSecond] = useState(""); const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const reset = () => { setFirst(""); setSecond(""); setConfirming(false); };
  const onDigit = (d: string) => {
    setError(null);
    if (!confirming) { const f = first + d; setFirst(f); if (f.length === 4) setConfirming(true); return; }
    const s = second + d; setSecond(s);
    if (s.length < 4) return;
    if (s !== first) { setError(t("pin_mismatch")); reset(); return; }
    setBusy(true);
    setPin(first).then(onDone).catch((e) => { setError(errorText(e)); reset(); }).finally(() => setBusy(false));
  };
  return (
    <Screen eyebrow={t("pin_set_eyebrow")} title={confirming ? t("pin_confirm_title") : t("pin_set_title")} description={t("pin_set_body")} onBack={onBack} scroll={false}
      bottom={<NumberPad onDigit={onDigit} onBackspace={() => (confirming ? setSecond((s) => s.slice(0, -1)) : setFirst((f) => f.slice(0, -1)))} disabled={busy} />}>
      <View style={{ alignItems: "center" }}><PinDots length={4} filled={(confirming ? second : first).length} error={!!error} /></View>
      {error ? <Banner text={error} tone="signal" /> : null}
    </Screen>
  );
}
