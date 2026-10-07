import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { guardApi } from "@/api/guardApi";
import type { ShiftRecord } from "@/api/types";
import { time, useStore } from "@/data/store";
import { useT } from "@/i18n";
import { Banner, Body, Card, EmptyState, Loading, Mono, Pill, Screen, Tile, Title } from "@/ui/components";
import { attendance, duration, errorText, flag, flagTone } from "@/ui/labels";

export default function HistoryScreen() {
  const t = useT(); const router = useRouter(); const tt = time();
  const guardId = useStore((s) => s.me?.guard.id);
  const [shifts, setShifts] = useState<ShiftRecord[] | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!guardId) return;
    guardApi.listShifts(guardId, tt.dateOffset(-30), tt.todayIso()).then(setShifts).catch((e) => { setError(errorText(e)); setShifts([]); });
  }, [guardId]);
  const done = (shifts ?? []).filter((s) => ["completed", "void_location_off", "absent"].includes(s.status));
  return (
    <Screen eyebrow={t("history_eyebrow")} title={t("history_title")} onBack={() => router.back()}>
      {error ? <Banner text={error} tone="signal" /> : null}
      {shifts == null ? <Loading /> : !shifts.length ? <EmptyState text={t("history_empty")} /> : <>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Tile label={t("attendance_present")} value={String(done.filter((s) => s.attendance === "present").length)} tone="present" />
          <Tile label={t("attendance_half_day")} value={String(done.filter((s) => s.attendance === "half_day").length)} tone="halfDay" />
          <Tile label={t("attendance_absent")} value={String(done.filter((s) => s.attendance === "absent").length)} tone="absent" />
        </View>
        {shifts.map((s) => {
          const [label, tone] = attendance(s.attendance);
          return (
            <Card key={s.id}>
              <View style={{ flexDirection: "row", alignItems: "center" }}><View style={{ flex: 1 }}><Title>{tt.day(s.shift_date)}</Title></View>{s.status === "scheduled" ? <Pill text={t("patrol_status_scheduled")} tone="neutral" /> : <Pill text={label} tone={tone} />}</View>
              <Body muted size={13}>{s.sites?.name ?? ""}</Body>
              <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
                <Mono>{`${tt.clock(s.started_at ?? s.scheduled_start)} → ${tt.clock(s.ended_at ?? s.scheduled_end)}`}</Mono>
                {s.worked_minutes > 0 ? <Mono>{duration(s.worked_minutes * 60)}</Mono> : null}
                {s.away_seconds > 60 ? <Mono>{t("home_away", duration(s.away_seconds))}</Mono> : null}
              </View>
              {s.flags.length ? <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>{s.flags.slice(0, 3).map((f) => <Pill key={f} text={flag(f)} tone={flagTone(f)} />)}</View> : null}
            </Card>
          );
        })}
      </>}
    </Screen>
  );
}
