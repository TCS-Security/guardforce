import { Linking, Pressable, TextInput, View } from "react-native";
import { useT } from "@/i18n";
import { Body, Mono, SecondaryButton, TextButton } from "@/ui/components";
import { fonts, radius, toneColor, type Tone } from "@/ui/theme";
import { usePalette } from "@/ui/usePalette";

/** Single-choice chip row: the one selection control the supervisor screens use. */
export function Chips<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (key: T) => void }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => (
        <Pressable key={o.key} onPress={() => onChange(o.key)}
          style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: value === o.key ? p.olive : p.border, backgroundColor: value === o.key ? p.oliveSoft : p.card }}>
          <Body>{o.label}</Body>
        </Pressable>
      ))}
    </View>
  );
}

export function Input({ value, onChangeText, placeholder, multiline = true }: { value: string; onChangeText: (v: string) => void; placeholder: string; multiline?: boolean }) {
  const p = usePalette();
  return (
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={p.muted} multiline={multiline}
      style={{ minHeight: multiline ? 88 : 48, borderWidth: 1, borderColor: p.border, borderRadius: radius.md, backgroundColor: p.card, padding: 12, fontFamily: fonts.body, fontSize: 15, color: p.ink, textAlignVertical: multiline ? "top" : "center" }} />
  );
}

/** Previous / next around a mono date. The supervisor's whole day navigation. */
export function DaySelector({ date, label, onChange }: { date: string; label: string; onChange: (date: string) => void }) {
  const t = useT(); const p = usePalette();
  const shift = (days: number) => {
    const next = new Date(Date.parse(date + "T12:00:00Z") + days * 86_400_000);
    onChange(next.toISOString().slice(0, 10));
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: p.border, borderRadius: radius.md, paddingHorizontal: 8 }}>
      <TextButton text={`←  ${t("sup_prev_day")}`} onPress={() => shift(-1)} />
      <Mono color={p.ink}>{label}</Mono>
      <TextButton text={`${t("sup_next_day")}  →`} onPress={() => shift(1)} />
    </View>
  );
}

export function CallButton({ phone }: { phone: string }) {
  const t = useT();
  return <SecondaryButton text={t("sup_call")} onPress={() => { void Linking.openURL(`tel:${phone}`); }} />;
}

/** Compact call affordance for list rows. */
export function CallChip({ phone }: { phone: string }) {
  const t = useT(); const p = usePalette();
  return (
    <Pressable onPress={() => { void Linking.openURL(`tel:${phone}`); }} hitSlop={8}
      style={({ pressed }) => ({ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: p.olive, backgroundColor: pressed ? p.oliveSoft : "transparent" })}>
      <Body size={13} style={{ color: p.olive, fontWeight: "600" }}>{t("sup_call")}</Body>
    </Pressable>
  );
}

/** Four numbers side by side inside a card — the site's shape at a glance. */
export function Counts({ items }: { items: { label: string; value: number; tone?: Tone }[] }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      {items.map((it) => (
        <View key={it.label} style={{ flex: 1 }}>
          <Mono size={11}>{it.label.toUpperCase()}</Mono>
          <Body size={22} style={{ fontFamily: fonts.display, color: it.tone ? toneColor(p, it.tone) : p.ink, lineHeight: 28 }}>{String(it.value)}</Body>
        </View>
      ))}
    </View>
  );
}
