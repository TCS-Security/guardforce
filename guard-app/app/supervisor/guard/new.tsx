import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { ApiError } from "@/api/errors";
import { staffApi } from "@/api/staffApi";
import { useStaff } from "@/data/staffStore";
import { tenDigits } from "@/domain/phone";
import { useT } from "@/i18n";
import { Banner, BigButton, Body, Screen } from "@/ui/components";
import { errorText } from "@/ui/labels";
import { fonts, radius } from "@/ui/theme";
import { usePalette } from "@/ui/usePalette";

export default function NewGuardScreen() {
  const t = useT(); const p = usePalette(); const router = useRouter();
  const me = useStaff((s) => s.me);
  const sites = me?.sites ?? [];
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [post, setPost] = useState("");
  const [siteId, setSiteId] = useState<string | null>(sites[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = tenDigits(phone);
  const phoneInvalid = phone.trim().length > 0 && !digits;
  const canSubmit = name.trim().length > 0 && !!digits && !!siteId;

  const submit = async () => {
    if (!canSubmit || !digits) return;
    setBusy(true); setError(null);
    try {
      const id = await staffApi.addGuard({ fullName: name.trim(), phone: digits, designation: post.trim() || null, siteId });
      router.replace({ pathname: "/supervisor/guard/[id]", params: { id } } as never);
    } catch (e) {
      setError(e instanceof ApiError && e.code === "GUARD_PHONE_EXISTS" ? t("sup_guard_exists") : errorText(e));
    } finally { setBusy(false); }
  };

  const inputStyle = { borderWidth: 1, borderColor: p.border, borderRadius: radius.md, backgroundColor: p.card, padding: 12, fontFamily: fonts.body, fontSize: 15, color: p.ink };

  return (
    <Screen eyebrow={t("sup_new_guard_eyebrow")} title={t("sup_new_guard_title")} description={t("sup_new_guard_body")} onBack={() => router.back()}
      bottom={<BigButton text={t("sup_create")} disabled={!canSubmit} loading={busy} onPress={submit} />}>
      <Body muted size={12}>{t("sup_field_name")}</Body>
      <TextInput value={name} onChangeText={setName} placeholder={t("sup_field_name")} placeholderTextColor={p.muted} style={inputStyle} />

      <Body muted size={12}>{t("sup_field_phone")}</Body>
      <TextInput value={phone} onChangeText={setPhone} placeholder={t("phone_hint")} placeholderTextColor={p.muted} keyboardType="phone-pad" style={inputStyle} />
      {phoneInvalid ? <Banner text={t("phone_invalid")} tone="signal" /> : null}
      <Body muted size={13}>{t("sup_invite_hint")}</Body>

      <Body muted size={12}>{t("sup_field_post")}</Body>
      <TextInput value={post} onChangeText={setPost} placeholder={t("sup_field_post")} placeholderTextColor={p.muted} style={inputStyle} />

      <Body muted size={12}>{t("sup_field_site")}</Body>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {sites.map((s) => (
          <Pressable key={s.id} onPress={() => setSiteId(s.id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: siteId === s.id ? p.olive : p.border, backgroundColor: siteId === s.id ? p.oliveSoft : p.card }}>
            <Body>{s.name}</Body>
          </Pressable>
        ))}
      </View>

      {error ? <Banner text={error} tone="signal" /> : null}
    </Screen>
  );
}
