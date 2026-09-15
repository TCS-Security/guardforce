import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput, ToastAndroid, View } from "react-native";
import { applyLeave, time } from "@/data/store";
import { useT } from "@/i18n";
import { Banner, BigButton, Body, Screen, SecondaryButton } from "@/ui/components";
import { errorText } from "@/ui/labels";
import { fonts, radius } from "@/ui/theme";
import { usePalette } from "@/ui/usePalette";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d; };

export default function ApplyLeaveScreen() {
  const t = useT(); const p = usePalette(); const router = useRouter(); const tt = time();
  const [type, setType] = useState("casual"); const [start, setStart] = useState(tomorrow()); const [end, setEnd] = useState(tomorrow());
  const [reason, setReason] = useState(""); const [picking, setPicking] = useState<"start" | "end" | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const invalid = end < start;
  return (
    <Screen eyebrow={t("leave_eyebrow")} title={t("leave_apply")} onBack={() => router.back()}
      bottom={<BigButton text={t("leave_submit")} loading={busy} disabled={invalid} onPress={async () => {
        setBusy(true); setError(null);
        try { await applyLeave(type, iso(start), iso(end), reason.trim() || null); ToastAndroid.show(t("leave_submitted"), ToastAndroid.SHORT); router.back(); }
        catch (e) { setError(errorText(e)); } finally { setBusy(false); }
      }} />}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["casual", "earned", "unpaid"] as const).map((k) => (
          <Pressable key={k} onPress={() => setType(k)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: type === k ? p.olive : p.border, backgroundColor: type === k ? p.oliveSoft : p.card }}>
            <Body>{k === "casual" ? t("leave_casual") : k === "earned" ? t("leave_earned") : t("leave_unpaid")}</Body>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Body muted size={12}>{t("leave_from")}</Body><SecondaryButton text={tt.day(iso(start))} onPress={() => setPicking("start")} /></View>
        <View style={{ flex: 1 }}><Body muted size={12}>{t("leave_to")}</Body><SecondaryButton text={tt.day(iso(end))} onPress={() => setPicking("end")} /></View>
      </View>
      {picking ? <DateTimePicker value={picking === "start" ? start : end} mode="date" minimumDate={new Date()} onChange={(_, d) => { setPicking(null); if (!d) return; if (picking === "start") { setStart(d); if (end < d) setEnd(d); } else setEnd(d); }} /> : null}
      {invalid ? <Banner text={t("leave_dates_invalid")} tone="signal" /> : null}
      <TextInput value={reason} onChangeText={setReason} placeholder={t("leave_reason")} placeholderTextColor={p.muted} multiline style={{ minHeight: 96, borderWidth: 1, borderColor: p.border, borderRadius: radius.md, backgroundColor: p.card, padding: 12, fontFamily: fonts.body, fontSize: 15, color: p.ink, textAlignVertical: "top" }} />
      {error ? <Banner text={error} tone="signal" /> : null}
    </Screen>
  );
}
