import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ToastAndroid, View } from "react-native";
import { staffApi } from "@/api/staffApi";
import type { SiteShift } from "@/api/staffTypes";
import { refreshStaffHome, staffTime, useCan, useStaff } from "@/data/staffStore";
import { useT } from "@/i18n";
import { Banner, BigButton, Body, Card, Eyebrow, KvRow, Loading, Mono, Pill, Screen, SecondaryButton, Section, Title } from "@/ui/components";
import { attendance as attendanceLabel, duration, errorText, flag, flagTone, relative } from "@/ui/labels";
import { CallButton, Chips, Input } from "@/ui/supervisor/monitor/controls";
import { shiftStatus, trust } from "@/ui/supervisor/monitor/labels";
import { radius } from "@/ui/theme";
import { usePalette } from "@/ui/usePalette";

type Form = "none" | "exception" | "correct";

export default function ShiftScreen() {
  const t = useT(); const p = usePalette(); const router = useRouter(); const tt = staffTime();
  const { id, site, date } = useLocalSearchParams<{ id: string; site: string; date: string }>();
  const siteName = useStaff((s) => s.me?.sites.find((x) => x.id === site)?.name ?? "");
  const canCorrect = useCan("attendance:correct");
  const [shift, setShift] = useState<SiteShift | null>(null); const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>("none");
  const [selfies, setSelfies] = useState<{ start?: string; end?: string }>({});

  const load = useCallback(async () => {
    if (!site || !date || !id) { setLoading(false); return; }
    setLoading(true);
    try { const rows = await staffApi.siteShifts(site, date); setShift(rows.find((r) => r.id === id) ?? null); setError(null); }
    catch (e) { setError(errorText(e)); }
    finally { setLoading(false); }
  }, [site, date, id]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let alive = true;
    const sign = async (path: string | null | undefined) => (path ? staffApi.signedUrl("selfies", path).catch(() => undefined) : undefined);
    void (async () => {
      const [start, end] = await Promise.all([sign(shift?.start_selfie_path), sign(shift?.end_selfie_path)]);
      if (alive) setSelfies({ start, end });
    })();
    return () => { alive = false; };
  }, [shift?.start_selfie_path, shift?.end_selfie_path]);

  const after = async (message: string) => {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    setForm("none");
    await load();
    await refreshStaffHome();
  };

  if (loading && !shift) return <Screen eyebrow={t("sup_shift_eyebrow")} title="" onBack={() => router.back()}><Loading /></Screen>;
  if (!shift) return <Screen eyebrow={t("sup_shift_eyebrow")} title={t("sup_no_shifts")} onBack={() => router.back()}>{error ? <Banner text={error} tone="signal" /> : null}</Screen>;

  const [statusLabel, statusTone] = shiftStatus(shift.status);
  const [trustLabel, trustTone] = trust(shift.trust);
  const locationTrouble = shift.status === "void_location_off" || shift.location_off_seconds > 0 || shift.flags.includes("LOCATION_OFF");

  return (
    <Screen eyebrow={t("sup_shift_eyebrow")} title={shift.guard_name} description={[siteName, tt.day(date)].filter(Boolean).join(" · ")} onBack={() => router.back()}
      header={<View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}><Pill text={statusLabel} tone={statusTone} /><Pill text={trustLabel} tone={trustTone} /></View>}>
      {error ? <Banner text={error} tone="signal" /> : null}
      {shift.exception_reason ? <Banner text={`${t("sup_exception_logged")} · ${shift.exception_reason}`} tone="olive" /> : null}
      {shift.override_reason ? <Banner text={`${t("sup_override_logged")} · ${shift.override_reason}`} tone="olive" /> : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1 }}><KvRow label={t("sup_shift_in")} value={tt.clock(shift.start_captured_at ?? shift.started_at)} mono /></View>
        {shift.late_by_min > 0 ? <Pill text={t("home_late", shift.late_by_min)} tone="halfDay" /> : null}
      </View>
      <KvRow label={t("sup_shift_out")} value={tt.clock(shift.ended_at)} mono />
      <KvRow label={t("sup_shift_worked")} value={duration(shift.worked_minutes * 60)} mono />
      <KvRow label={t("sup_shift_away")} value={duration(shift.away_seconds)} mono />
      {shift.attendance && shift.attendance !== "pending" ? <KvRow label={t("sup_attendance")} value={attendanceLabel(shift.attendance)[0]} /> : null}
      {shift.location_off_seconds > 0 ? <KvRow label={t("sup_location_off")} value={duration(shift.location_off_seconds)} mono /> : null}
      {shift.status === "in_progress" ? (
        <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
          <Mono>{shift.in_fence_now === false ? t("sup_outside") : t("sup_on_duty")}</Mono>
          {shift.last_seen_at ? <Mono>{t("sup_last_seen", relative(tt.relative(Date.parse(shift.last_seen_at))))}</Mono> : null}
          {shift.battery_pct != null ? <Mono>{`${shift.battery_pct}%`}</Mono> : null}
        </View>
      ) : null}

      {shift.flags.length ? <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>{shift.flags.map((f) => <Pill key={f} text={flag(f)} tone={flagTone(f)} />)}</View> : null}

      {selfies.start || selfies.end ? (
        <>
          <Section title={t("sup_shift_selfies")} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            {(["start", "end"] as const).map((k) => selfies[k] ? (
              <View key={k} style={{ flex: 1, gap: 4 }}>
                <Eyebrow>{k === "start" ? t("sup_shift_start_selfie") : t("sup_shift_end_selfie")}</Eyebrow>
                <Image source={{ uri: selfies[k] }} style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: p.accent }} contentFit="cover" />
              </View>
            ) : null)}
          </View>
        </>
      ) : null}

      {shift.guard_phone ? <CallButton phone={shift.guard_phone} /> : null}

      {canCorrect ? (
        <>
          <Section title="" />
          {form !== "correct" ? <SecondaryButton text={t("sup_exception")} disabled={!locationTrouble} onPress={() => setForm(form === "exception" ? "none" : "exception")} /> : null}
          {form === "exception" ? <ExceptionForm shiftId={shift.id} onDone={() => after(t("sup_exception_done"))} /> : null}
          {form !== "exception" ? <SecondaryButton text={t("sup_correct")} onPress={() => setForm(form === "correct" ? "none" : "correct")} /> : null}
          {form === "correct" ? <CorrectForm shiftId={shift.id} current={shift.attendance} onDone={() => after(t("sup_correct_done"))} /> : null}
        </>
      ) : null}
    </Screen>
  );
}

function ExceptionForm({ shiftId, onDone }: { shiftId: string; onDone: () => Promise<void> | void }) {
  const t = useT();
  const [category, setCategory] = useState("device_failure");
  const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  return (
    <Card>
      <Title>{t("sup_exception")}</Title>
      <Body muted size={13} style={{ marginTop: 4 }}>{t("sup_exception_body")}</Body>
      <View style={{ height: 12 }} />
      <Eyebrow>{t("sup_exception_category")}</Eyebrow>
      <View style={{ height: 8 }} />
      <Chips value={category} onChange={setCategory} options={[
        { key: "device_failure", label: t("sup_cat_device_failure") },
        { key: "gps_failure", label: t("sup_cat_gps_failure") },
        { key: "network", label: t("sup_cat_network") },
        { key: "other", label: t("sup_cat_other") },
      ]} />
      <View style={{ height: 12 }} />
      <Input value={reason} onChangeText={setReason} placeholder={t("sup_exception_reason")} />
      {error ? <><View style={{ height: 8 }} /><Banner text={error} tone="signal" /></> : null}
      <View style={{ height: 12 }} />
      <BigButton text={t("sup_exception")} loading={busy} disabled={reason.trim().length < 10} onPress={async () => {
        setBusy(true); setError(null);
        try { await staffApi.logShiftException(shiftId, reason.trim(), category); await onDone(); }
        catch (e) { setError(errorText(e)); } finally { setBusy(false); }
      }} />
    </Card>
  );
}

function CorrectForm({ shiftId, current, onDone }: { shiftId: string; current: string; onDone: () => Promise<void> | void }) {
  const t = useT();
  const [value, setValue] = useState(current === "pending" ? "present" : current);
  const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  return (
    <Card>
      <Title>{t("sup_correct")}</Title>
      <Body muted size={13} style={{ marginTop: 4 }}>{t("sup_correct_body")}</Body>
      <View style={{ height: 12 }} />
      <Chips value={value} onChange={setValue} options={["present", "half_day", "absent", "on_leave"].map((k) => ({ key: k, label: attendanceLabel(k)[0] }))} />
      <View style={{ height: 12 }} />
      <Input value={reason} onChangeText={setReason} placeholder={t("sup_correct_reason")} />
      {error ? <><View style={{ height: 8 }} /><Banner text={error} tone="signal" /></> : null}
      <View style={{ height: 12 }} />
      <BigButton text={t("sup_correct")} loading={busy} disabled={reason.trim().length < 5} onPress={async () => {
        setBusy(true); setError(null);
        try { await staffApi.overrideAttendance(shiftId, value, reason.trim()); await onDone(); }
        catch (e) { setError(errorText(e)); } finally { setBusy(false); }
      }} />
    </Card>
  );
}
