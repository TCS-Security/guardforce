import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, radius, toneColor, type Tone } from "./theme";
import { usePalette } from "./usePalette";

export function Eyebrow({ children, color, style }: { children: string; color?: string; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return <Text style={[{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.3, color: color ?? p.muted, textTransform: "uppercase" }, style as object]}>{children}</Text>;
}

export function Display({ children, size = 28 }: { children: string; size?: number }) {
  const p = usePalette();
  return <Text style={{ fontFamily: fonts.display, fontSize: size, lineHeight: size * 1.12, color: p.ink, letterSpacing: -0.3 }}>{children}</Text>;
}

export function Body({ children, muted, style, size = 15 }: { children: React.ReactNode; muted?: boolean; style?: object; size?: number }) {
  const p = usePalette();
  return <Text style={[{ fontFamily: fonts.body, fontSize: size, lineHeight: size * 1.4, color: muted ? p.muted : p.ink }, style]}>{children}</Text>;
}

export function Title({ children, style }: { children: React.ReactNode; style?: object }) {
  const p = usePalette();
  return <Text style={[{ fontFamily: fonts.body, fontSize: 16, fontWeight: "600", color: p.ink }, style]}>{children}</Text>;
}

export function Mono({ children, color, size = 13 }: { children: React.ReactNode; color?: string; size?: number }) {
  const p = usePalette();
  return <Text style={{ fontFamily: fonts.mono, fontSize: size, color: color ?? p.muted }}>{children}</Text>;
}

export function Pill({ text, tone }: { text: string; tone: Tone }) {
  const p = usePalette(); const c = toneColor(p, tone);
  return (
    <View style={{ backgroundColor: c + "1F", borderColor: c + "59", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" }}>
      <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: c }}>{text}</Text>
    </View>
  );
}

export function Dot({ tone, size = 8 }: { tone: Tone; size?: number }) {
  const p = usePalette();
  return <View style={{ width: size, height: size, borderRadius: size, backgroundColor: toneColor(p, tone) }} />;
}

export function Card({ children, onPress, style }: { children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  const base = { backgroundColor: p.card, borderColor: p.border, borderWidth: 1, borderRadius: radius.md, padding: 16 };
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.8 : 1 }, style]}>{children}</Pressable> : <View style={[base, style]}>{children}</View>;
}

export function Tile({ label, value, tone, sub, style }: { label: string; value: string; tone?: Tone; sub?: string; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return (
    <View style={[{ flex: 1, backgroundColor: p.card, borderColor: p.border, borderWidth: 1, borderRadius: radius.md, padding: 14 }, style]}>
      <Eyebrow>{label}</Eyebrow>
      <Text style={{ fontFamily: fonts.display, fontSize: 24, marginTop: 6, color: tone ? toneColor(p, tone) : p.ink }}>{value}</Text>
      {sub ? <Body muted size={13}>{sub}</Body> : null}
    </View>
  );
}

export function Section({ title, right }: { title: string; right?: React.ReactNode }) {
  const p = usePalette();
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: p.border, paddingTop: 12, paddingBottom: 6, flexDirection: "row", alignItems: "center" }}>
      <View style={{ flex: 1 }}><Eyebrow>{title}</Eyebrow></View>
      {right}
    </View>
  );
}

export function KvRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: "row", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: p.border + "99" }}>
      <View style={{ width: 120 }}><Body muted>{label}</Body></View>
      <View style={{ flex: 1 }}>{mono ? <Mono color={p.ink}>{value}</Mono> : <Body>{value}</Body>}</View>
    </View>
  );
}

export function Banner({ text, tone, action }: { text: string; tone: Tone; action?: React.ReactNode }) {
  const p = usePalette(); const c = toneColor(p, tone);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c + "1F", borderColor: c + "66", borderWidth: 1, borderRadius: radius.sm, padding: 12 }}>
      <Dot tone={tone} />
      <View style={{ flex: 1 }}><Body style={{ fontWeight: "500" }}>{text}</Body></View>
      {action}
    </View>
  );
}

/** The one big control on every action screen. */
export function BigButton({ text, onPress, disabled, tone = "olive", loading }: { text: string; onPress: () => void; disabled?: boolean; tone?: Tone; loading?: boolean }) {
  const p = usePalette(); const c = toneColor(p, tone);
  const off = disabled || loading;
  return (
    <Pressable onPress={onPress} disabled={off} style={({ pressed }) => ({ height: 64, borderRadius: radius.md, backgroundColor: c, opacity: off ? 0.4 : pressed ? 0.85 : 1, alignItems: "center", justifyContent: "center" })}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.body, fontSize: 19, fontWeight: "600", color: "#fff" }}>{text}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ text, onPress, disabled }: { text: string; onPress: () => void; disabled?: boolean }) {
  const p = usePalette();
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => ({ height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: p.border, backgroundColor: p.card, opacity: disabled ? 0.5 : pressed ? 0.8 : 1, alignItems: "center", justifyContent: "center" })}>
      <Text style={{ fontFamily: fonts.body, fontSize: 16, fontWeight: "600", color: p.ink }}>{text}</Text>
    </Pressable>
  );
}

export function TextButton({ text, onPress }: { text: string; onPress: () => void }) {
  const p = usePalette();
  return <Pressable onPress={onPress} hitSlop={8} style={{ paddingVertical: 8, paddingHorizontal: 4 }}><Text style={{ fontFamily: fonts.body, fontSize: 15, fontWeight: "600", color: p.olive }}>{text}</Text></Pressable>;
}

export function EmptyState({ text }: { text: string }) {
  const p = usePalette();
  return <View style={{ borderWidth: 1, borderColor: p.border, borderRadius: radius.md, padding: 24, alignItems: "center" }}><Body muted style={{ textAlign: "center" }}>{text}</Body></View>;
}

export function Loading() {
  const p = usePalette();
  return <View style={{ padding: 32, alignItems: "center" }}><ActivityIndicator color={p.olive} /></View>;
}

/** eyebrow → display title → description, scrolling content, pinned bottom actions. */
export function Screen({ eyebrow, title, description, onBack, header, bottom, children, scroll = true }: {
  eyebrow: string; title: string; description?: string | null; onBack?: () => void; header?: React.ReactNode; bottom?: React.ReactNode; children?: React.ReactNode; scroll?: boolean;
}) {
  const p = usePalette(); const insets = useSafeAreaInsets();
  const content = <View style={{ paddingHorizontal: 20, gap: 12 }}>{children}<View style={{ height: 16 }} /></View>;
  return (
    <View style={{ flex: 1, backgroundColor: p.paper, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{ paddingHorizontal: 20, paddingTop: onBack ? 4 : 20 }}>
        {onBack ? <Pressable onPress={onBack} hitSlop={12} style={{ paddingVertical: 10, alignSelf: "flex-start" }}><Text style={{ fontFamily: fonts.body, fontSize: 18, color: p.ink }}>←</Text></Pressable> : null}
        <Eyebrow>{eyebrow}</Eyebrow>
        <View style={{ height: 6 }} />
        <Display>{title}</Display>
        {description ? <><View style={{ height: 6 }} /><Body muted>{description}</Body></> : null}
        {header}
        <View style={{ height: 16 }} />
      </View>
      {scroll ? <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">{content}</ScrollView> : <View style={{ flex: 1 }}>{content}</View>}
      {bottom ? <View style={{ paddingHorizontal: 20, paddingVertical: 12, gap: 8 }}>{bottom}</View> : null}
    </View>
  );
}

export function PinDots({ length, filled, error }: { length: number; filled: number; error?: boolean }) {
  const p = usePalette(); const c = error ? p.destructive : p.olive;
  return (
    <View style={{ flexDirection: "row", gap: 14, paddingVertical: 12, justifyContent: "center" }}>
      {Array.from({ length }).map((_, i) => <View key={i} style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: c, backgroundColor: i < filled ? c : p.card }} />)}
    </View>
  );
}

/** Big-key numeric pad: one thumb, outdoors, in a hurry. */
export function NumberPad({ onDigit, onBackspace, disabled }: { onDigit: (d: string) => void; onBackspace: () => void; disabled?: boolean }) {
  const p = usePalette();
  const rows = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["", "0", "⌫"]];
  return (
    <View style={{ gap: 10 }}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row", gap: 10 }}>
          {row.map((k, ki) => k === "" ? <View key={ki} style={{ flex: 1 }} /> : (
            <Pressable key={ki} disabled={disabled} onPress={() => (k === "⌫" ? onBackspace() : onDigit(k))}
              style={({ pressed }) => ({ flex: 1, height: 64, borderRadius: radius.md, borderWidth: 1, borderColor: p.border, backgroundColor: pressed ? p.accent : p.card, alignItems: "center", justifyContent: "center" })}>
              <Text style={{ fontFamily: fonts.display, fontSize: 24, color: k === "⌫" ? p.muted : p.ink }}>{k}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", gap: 8 } });
