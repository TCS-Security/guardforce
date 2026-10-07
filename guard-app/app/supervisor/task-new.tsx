import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Switch, TextInput, ToastAndroid, View } from "react-native";
import { staffApi } from "@/api/staffApi";
import type { GuardListItem } from "@/api/staffTypes";
import { staffTime, staffZone, useStaff } from "@/data/staffStore";
import { useT } from "@/i18n";
import { Banner, BigButton, Body, Pill, Screen, SecondaryButton } from "@/ui/components";
import { errorText } from "@/ui/labels";
import { fonts, radius } from "@/ui/theme";
import { usePalette } from "@/ui/usePalette";

/** "Today at HH:MM" in the agency's timezone, as an ISO string with the right offset for that day. */
function dueAtIso(dateIso: string, time: Date | null, zone: string): string | null {
  if (!time) return null;
  const hh = String(time.getHours()).padStart(2, "0");
  const mm = String(time.getMinutes()).padStart(2, "0");
  const probe = new Date(`${dateIso}T12:00:00Z`);
  const offsetPart = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(probe).find((x) => x.type === "timeZoneName")?.value ?? "GMT+05:30";
  const offset = offsetPart === "GMT" ? "+00:00" : offsetPart.replace("GMT", "");
  return `${dateIso}T${hh}:${mm}:00${offset}`;
}

export default function NewTaskScreen() {
  const t = useT(); const p = usePalette(); const router = useRouter(); const tt = staffTime();
  const me = useStaff((s) => s.me);
  const sites = me?.sites ?? [];
  const [siteId, setSiteId] = useState<string | null>(sites[0]?.id ?? null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueTime, setDueTime] = useState<Date | null>(null);
  const [pickingTime, setPickingTime] = useState(false);
  const [photoRequired, setPhotoRequired] = useState(true);
  const [guards, setGuards] = useState<GuardListItem[] | null>(null);
  const [guardIds, setGuardIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) return;
    setGuards(null); setGuardIds([]);
    staffApi.guards(siteId)
      .then((list) => setGuards([...list].sort((a, b) => Number(b.on_duty) - Number(a.on_duty))))
      .catch(() => setGuards([]));
  }, [siteId]);

  const canSubmit = title.trim().length > 0 && guardIds.length > 0 && !!siteId;

  const submit = async () => {
    if (!siteId || !title.trim()) return;
    if (!guardIds.length) { setError(t("sup_task_no_guards")); return; }
    setBusy(true); setError(null);
    try {
      await staffApi.createTask({ siteId, title: title.trim(), description: description.trim() || null, dueAt: dueAtIso(tt.todayIso(), dueTime, staffZone()), photoRequired, guardIds });
      ToastAndroid.show(t("sup_task_created"), ToastAndroid.SHORT);
      router.back();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  const inputStyle = { borderWidth: 1, borderColor: p.border, borderRadius: radius.md, backgroundColor: p.card, padding: 12, fontFamily: fonts.body, fontSize: 15, color: p.ink };

  const toggleGuard = (id: string) => setGuardIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <Screen eyebrow={t("sup_task_eyebrow")} title={t("sup_task_title")} onBack={() => router.back()}
      bottom={<BigButton text={t("sup_task_submit")} disabled={!canSubmit} loading={busy} onPress={() => { void submit(); }} />}>
      <Body muted size={12}>{t("sup_field_site")}</Body>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {sites.map((s) => (
          <Pressable key={s.id} onPress={() => setSiteId(s.id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: siteId === s.id ? p.olive : p.border, backgroundColor: siteId === s.id ? p.oliveSoft : p.card }}>
            <Body>{s.name}</Body>
          </Pressable>
        ))}
      </View>

      <Body muted size={12}>{t("sup_task_name")}</Body>
      <TextInput value={title} onChangeText={setTitle} placeholder={t("sup_task_name")} placeholderTextColor={p.muted} style={inputStyle} />

      <Body muted size={12}>{t("sup_task_desc")}</Body>
      <TextInput value={description} onChangeText={setDescription} placeholder={t("sup_task_desc")} placeholderTextColor={p.muted} multiline style={[inputStyle, { minHeight: 72, textAlignVertical: "top" }]} />

      <Body muted size={12}>{t("sup_task_due")}</Body>
      <SecondaryButton text={dueTime ? tt.clock(dueTime.getTime()) : t("sup_task_due")} onPress={() => setPickingTime(true)} />
      {pickingTime ? (
        <DateTimePicker value={dueTime ?? new Date()} mode="time" onChange={(_, d) => { setPickingTime(false); if (d) setDueTime(d); }} />
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 }}>
        <Body>{t("sup_task_photo")}</Body>
        <Switch value={photoRequired} onValueChange={setPhotoRequired} />
      </View>

      <Body muted size={12}>{t("sup_task_assignees")}</Body>
      {guards == null ? null : !guards.length ? <Body muted size={13}>{t("sup_guards_none")}</Body> : (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {guards.map((g) => (
            <Pressable key={g.id} onPress={() => toggleGuard(g.id)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: guardIds.includes(g.id) ? p.olive : p.border, backgroundColor: guardIds.includes(g.id) ? p.oliveSoft : p.card }}>
              <Body>{g.full_name}</Body>
              {g.on_duty ? <Pill text={t("sup_on_duty")} tone="present" /> : null}
            </Pressable>
          ))}
        </View>
      )}

      {error ? <Banner text={error} tone="signal" /> : null}
    </Screen>
  );
}
