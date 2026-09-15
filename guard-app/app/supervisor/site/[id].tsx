import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { staffApi } from "@/api/staffApi";
import type { SiteShift } from "@/api/staffTypes";
import { staffTime, useStaff } from "@/data/staffStore";
import { useT } from "@/i18n";
import { Banner, Body, Card, EmptyState, Loading, Mono, Pill, Screen, Section, Title } from "@/ui/components";
import { attendance, errorText, flag, flagTone, relative } from "@/ui/labels";
import { shiftStatus } from "@/ui/supervisor/monitor/labels";
import { Counts, DaySelector } from "@/ui/supervisor/monitor/controls";

export default function SiteDayScreen() {
  const t = useT(); const router = useRouter(); const tt = staffTime();
  const { id } = useLocalSearchParams<{ id: string }>();
  const site = useStaff((s) => s.me?.sites.find((x) => x.id === id));
  const [date, setDate] = useState(tt.todayIso());
  const [shifts, setShifts] = useState<SiteShift[] | null>(null); const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setShifts(null);
    try { setShifts(await staffApi.siteShifts(id, date)); setError(null); }
    catch (e) { setError(errorText(e)); setShifts([]); }
  }, [id, date]);
  useEffect(() => { void load(); }, [load]);

  const list = shifts ?? [];
  const onSite = list.filter((s) => s.status === "in_progress").length;
  const late = list.filter((s) => s.late_by_min > 0).length;
  const absent = list.filter((s) => s.status === "absent" || s.attendance === "absent").length;

  return (
    <Screen eyebrow={t("sup_site_eyebrow")} title={site?.name ?? ""} description={[site?.client_name, site?.address].filter(Boolean).join(" · ") || null} onBack={() => router.back()}>
      <DaySelector date={date} label={tt.day(date)} onChange={setDate} />
      <Counts items={[
        { label: t("sup_scheduled"), value: list.length },
        { label: t("sup_present"), value: onSite, tone: "present" },
        { label: t("sup_late"), value: late, tone: late ? "halfDay" : undefined },
        { label: t("sup_absent"), value: absent, tone: absent ? "absent" : undefined },
      ]} />
      {error ? <Banner text={error} tone="signal" /> : null}
      <Section title={t("sup_shifts_today")} />
      {shifts == null ? <Loading /> : !list.length ? <EmptyState text={t("sup_no_shifts")} /> : list.map((s) => (
        <ShiftCard key={s.id} shift={s} onPress={() => router.push({ pathname: "/supervisor/shift/[id]", params: { id: s.id, site: id, date } } as never)} />
      ))}
    </Screen>
  );
}

function ShiftCard({ shift, onPress }: { shift: SiteShift; onPress: () => void }) {
  const t = useT(); const tt = staffTime();
  const [statusLabel, statusTone] = shiftStatus(shift.status);
  const [attLabel, attTone] = attendance(shift.attendance);
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}><Title>{shift.guard_name}</Title></View>
        <Pill text={statusLabel} tone={statusTone} />
      </View>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
        {shift.employee_code ? <Mono>{shift.employee_code}</Mono> : null}
        <Mono>{`${tt.clock(shift.scheduled_start)} → ${tt.clock(shift.scheduled_end)}`}</Mono>
        {shift.shift_type ? <Body muted size={13}>{shift.shift_type}</Body> : null}
      </View>
      <View style={{ flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        {shift.attendance && shift.attendance !== "pending" ? <Pill text={attLabel} tone={attTone} /> : null}
        {shift.late_by_min > 0 ? <Pill text={t("home_late", shift.late_by_min)} tone="halfDay" /> : null}
        {shift.flags.map((f) => <Pill key={f} text={flag(f)} tone={flagTone(f)} />)}
      </View>
      {shift.status === "in_progress" ? (
        <View style={{ flexDirection: "row", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          <Mono>{shift.in_fence_now === false ? t("sup_outside") : t("sup_on_duty")}</Mono>
          {shift.last_seen_at ? <Mono>{t("sup_last_seen", relative(tt.relative(Date.parse(shift.last_seen_at))))}</Mono> : null}
          {shift.battery_pct != null ? <Mono>{`${shift.battery_pct}%`}</Mono> : null}
        </View>
      ) : null}
    </Card>
  );
}
