import * as IntentLauncher from "expo-intent-launcher";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { refreshAll, time, useStore } from "@/data/store";
import type { DutyState } from "@/domain/duty";
import { useT } from "@/i18n";
import { Banner, BigButton, Body, Card, Display, Dot, Eyebrow, Mono, Pill, Screen, Section, TextButton, Tile, Title } from "@/ui/components";
import { attendance, duration, flag, flagTone, kycGap, patrol as patrolLabel, relative } from "@/ui/labels";

export default function HomeScreen() {
  const t = useT(); const router = useRouter();
  const me = useStore((s) => s.me); const home = useStore((s) => s.home); const duty = useStore((s) => s.duty);
  const live = useStore((s) => s.tracking); const online = useStore((s) => s.online); const pending = useStore((s) => s.pending);
  const tt = time();
  useEffect(() => { void refreshAll(); }, []);
  const onDuty = duty?.kind === "on_duty" || duty?.kind === "starting_offline";
  const go = (path: string) => () => router.push(path as never);
  const fenceText = live.inFence === true ? t("home_in_fence") : live.inFence === false ? t("home_out_fence", Math.round(live.distanceOutsideM ?? 0)) : t("home_fence_unknown");

  return (
    <Screen eyebrow={t("home_eyebrow_today", tt.todayLong())} title={me?.guard.full_name ?? ""} description={[me?.guard.designation, me?.site?.name].filter(Boolean).join(" · ") || null}
      header={<View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        {!online ? <Pill text={t("offline_banner")} tone="neutral" /> : null}
        {pending > 0 ? <Pill text={t("home_pending_sync", pending)} tone="halfDay" /> : online ? <Pill text={t("home_synced")} tone="present" /> : null}
      </View>}>
      {onDuty && live.locationEnabled === false ? <Banner text={t("home_location_off")} tone="signal" action={<TextButton text={t("home_turn_on")} onPress={() => { void IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS); }} />} /> : null}
      {me && me.kyc_missing.length ? <Banner text={t("home_kyc_incomplete", me.kyc_missing.map(kycGap).join(", "))} tone="halfDay" /> : null}

      <DutyCard duty={duty} onStart={go("/checkin")} onEnd={go("/checkout")} />

      {onDuty ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Tile label="GPS" value={fenceText} tone={live.inFence === true ? "present" : live.inFence === false ? "signal" : "neutral"} sub={live.lastFixMs ? t("home_last_ping", relative(tt.relative(live.lastFixMs))) : undefined} />
          <Tile label={t("home_battery", 0).split(" ")[0]} value={`${live.batteryPct ?? "–"}%`} tone={(live.batteryPct ?? 100) < 15 ? "signal" : undefined} sub={live.intervalS ? `${live.intervalS}s` : undefined} />
        </View>
      ) : null}

      <Section title={t("home_patrols")} right={<TextButton text="→" onPress={go("/patrols")} />} />
      {!home?.patrols.length ? <Body muted>{onDuty ? t("home_patrols_none") : t("patrols_need_shift")}</Body> : home.patrols.slice(0, 3).map((p) => {
        const [label, tone] = patrolLabel(p.status);
        return (
          <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
            <Dot tone={tone} /><View style={{ flex: 1 }}><Body size={16}>{p.route_name ?? "Patrol"}</Body></View><Mono>{tt.clock(p.expected_at)}</Mono><Pill text={label} tone={tone} />
          </View>
        );
      })}

      <Section title={t("home_tasks")} right={<TextButton text="→" onPress={go("/tasks")} />} />
      {!home?.tasks.length ? <Body muted>{t("home_tasks_none")}</Body> : home.tasks.slice(0, 3).map((task) => (
        <View key={task.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}><View style={{ flex: 1 }}><Body size={16}>{task.title}</Body></View><Mono>{task.due_at ? tt.clock(task.due_at) : ""}</Mono></View>
      ))}

      <Section title="" />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Card style={{ flex: 1 }} onPress={go("/leave")}><Title>{t("home_leave")}</Title></Card>
        <Card style={{ flex: 1 }} onPress={go("/history")}><Title>{t("home_history")}</Title></Card>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Card style={{ flex: 1 }} onPress={go("/notifications")}><Title>{t("home_notifications")}{home?.unread_notifications ? ` · ${home.unread_notifications}` : ""}</Title></Card>
        <Card style={{ flex: 1 }} onPress={go("/profile")}><Title>{t("home_profile")}</Title></Card>
      </View>
    </Screen>
  );
}

function DutyCard({ duty, onStart, onEnd }: { duty: DutyState | null; onStart: () => void; onEnd: () => void }) {
  const t = useT(); const tt = time();
  if (!duty) return <Card><Body>{t("loading")}</Body></Card>;
  switch (duty.kind) {
    case "no_shift": return <Card><Eyebrow>{t("home_no_shift_title")}</Eyebrow><View style={{ height: 6 }} /><Body muted>{t("home_no_shift_body")}</Body>{duty.canStartAdHoc ? <><View style={{ height: 14 }} /><BigButton text={t("home_start_shift")} onPress={onStart} /></> : null}</Card>;
    case "upcoming": case "ready": return (
      <Card>
        <Eyebrow>{t("home_upcoming_title")}</Eyebrow><View style={{ height: 4 }} />
        <Display size={24}>{t("home_scheduled", tt.clock(duty.shift.scheduled_start), tt.clock(duty.shift.scheduled_end))}</Display>
        <Body muted>{[duty.shift.shift_type, duty.shift.site_name].filter(Boolean).join(" · ")}</Body>
        <View style={{ height: 14 }} /><BigButton text={t("home_start_shift")} onPress={onStart} tone={duty.kind === "ready" ? "olive" : "neutral"} />
      </Card>
    );
    case "starting_offline": return <Card><Eyebrow>{t("home_on_duty")}</Eyebrow><View style={{ height: 4 }} /><Display size={24}>{t("home_since", tt.clock(duty.sinceMs))}</Display><View style={{ height: 6 }} /><Pill text={t("checkin_queued")} tone="halfDay" /><View style={{ height: 14 }} /><BigButton text={t("home_end_shift")} onPress={onEnd} tone="signal" /></Card>;
    case "on_duty": {
      const s = duty.shift;
      return (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Dot tone="present" /><Eyebrow>{t("home_on_duty")}</Eyebrow></View>
          <View style={{ height: 4 }} /><Display size={24}>{t("home_since", tt.clock(duty.sinceMs))}</Display>
          {s ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {s.scheduled_end ? <Mono>{"→ " + tt.clock(s.scheduled_end)}</Mono> : null}
            {s.late_by_min > 0 ? <Pill text={t("home_late", s.late_by_min)} tone="halfDay" /> : null}
            {s.away_seconds > 0 ? <Pill text={t("home_away", duration(s.away_seconds))} tone="halfDay" /> : null}
            {s.flags.filter((f) => f !== "LATE_START").map((f) => <Pill key={f} text={flag(f)} tone={flagTone(f)} />)}
          </View> : null}
          <View style={{ height: 14 }} /><BigButton text={t("home_end_shift")} onPress={onEnd} tone="signal" />
        </Card>
      );
    }
    case "ending_offline": return <Card><Eyebrow>{t("home_shift_ended")}</Eyebrow><View style={{ height: 6 }} /><Pill text={t("checkin_queued")} tone="halfDay" /></Card>;
    case "ended": {
      const [label, tone] = attendance(duty.shift.attendance);
      return (
        <Card>
          <Eyebrow>{t("home_shift_ended")}</Eyebrow><View style={{ height: 4 }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Display size={20}>{t("home_worked", duration(duty.shift.worked_minutes * 60))}</Display><Pill text={label} tone={tone} /></View>
          {duty.shift.status === "void_location_off" ? <><View style={{ height: 6 }} /><Banner text={t("home_void")} tone="signal" /></> : null}
          {duty.shift.away_seconds > 0 ? <><View style={{ height: 4 }} /><Mono>{t("home_away", duration(duty.shift.away_seconds))}</Mono></> : null}
        </Card>
      );
    }
  }
}
