import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import type { OnDutyGuard, SiteSummary } from "@/api/staffTypes";
import { refreshStaffHome, staffTime, useCan, useStaff } from "@/data/staffStore";
import { useT } from "@/i18n";
import { Banner, Body, Card, Dot, Eyebrow, Loading, Mono, Pill, Screen, Section, TextButton, Title } from "@/ui/components";
import { relative } from "@/ui/labels";
import { CallChip, Counts } from "@/ui/supervisor/monitor/controls";
import { usePalette } from "@/ui/usePalette";

export default function SupervisorHomeScreen() {
  const t = useT(); const p = usePalette(); const router = useRouter(); const tt = staffTime();
  const me = useStaff((s) => s.me); const home = useStaff((s) => s.home); const online = useStaff((s) => s.online);
  const canTask = useCan("tasks:write"); const canLeave = useCan("leave:decide");
  useEffect(() => { void refreshStaffHome(); }, []);
  const go = (path: string) => () => router.push(path as never);
  const siteName = (id: string) => me?.sites.find((s) => s.id === id)?.name ?? "";

  return (
    <Screen eyebrow={t("sup_home_eyebrow", tt.todayLong())} title={t("sup_home_title")}
      header={<View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        {!online ? <Pill text={t("offline_banner")} tone="neutral" /> : null}
        {me ? <Pill text={me.agency.name} tone="olive" /> : null}
      </View>}>
      {home == null ? <Loading /> : null}

      {home?.alerts.length ? <Banner text={t("sup_alerts_open", home.alerts.length)} tone="signal" action={<TextButton text="→" onPress={go("/supervisor/alerts")} />} /> : null}
      {home?.pending_leave ? <LinkRow text={t("sup_pending_leave", home.pending_leave)} onPress={go("/supervisor/leave")} /> : null}
      {home?.missed_patrols_today ? <Body muted>{t("sup_missed_patrols", home.missed_patrols_today)}</Body> : null}

      {(home?.sites ?? []).map((s) => <SiteCard key={s.id} site={s} onPress={() => router.push({ pathname: "/supervisor/site/[id]", params: { id: s.id } } as never)} />)}

      <Section title={t("sup_on_duty_now")} />
      {!home?.on_duty.length ? <Body muted>{t("sup_nobody_on_duty")}</Body> : home.on_duty.map((g) => (
        <Pressable key={g.guard_id} disabled={!g.shift_id} onPress={() => router.push({ pathname: "/supervisor/shift/[id]", params: { id: g.shift_id ?? "", site: g.site_id, date: home.date } } as never)}
          style={({ pressed }) => ({ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.border + "99", opacity: pressed ? 0.8 : 1 })}>
          <OnDutyRow guard={g} siteName={siteName(g.site_id)} />
        </Pressable>
      ))}

      <Section title="" />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Card style={{ flex: 1 }} onPress={go("/supervisor/guards")}><Title>{t("sup_nav_guards")}</Title></Card>
        <Card style={{ flex: 1 }} onPress={go("/supervisor/roster")}><Title>{t("sup_nav_roster")}</Title></Card>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Card style={{ flex: 1 }} onPress={go("/supervisor/alerts")}><Title>{t("sup_nav_alerts")}{home?.alerts.length ? ` · ${home.alerts.length}` : ""}</Title></Card>
        {canLeave ? <Card style={{ flex: 1 }} onPress={go("/supervisor/leave")}><Title>{t("sup_nav_leave")}{home?.pending_leave ? ` · ${home.pending_leave}` : ""}</Title></Card> : <View style={{ flex: 1 }} />}
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {canTask ? <Card style={{ flex: 1 }} onPress={go("/supervisor/task-new")}><Title>{t("sup_nav_task")}</Title></Card> : <View style={{ flex: 1 }} />}
        <Card style={{ flex: 1 }} onPress={go("/supervisor/account")}><Title>{t("sup_nav_account")}</Title></Card>
      </View>
    </Screen>
  );
}

function LinkRow({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ flex: 1 }}><Body>{text}</Body></View><Mono>→</Mono>
    </Pressable>
  );
}

function SiteCard({ site, onPress }: { site: SiteSummary; onPress: () => void }) {
  const t = useT();
  const gap = site.guards_required - site.on_duty_now;
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}><Title>{site.name}</Title></View>
        <Pill text={gap > 0 ? t("sup_gap", gap) : t("sup_covered")} tone={gap > 0 ? "signal" : "present"} />
      </View>
      <View style={{ height: 10 }} />
      <Counts items={[
        { label: t("sup_required"), value: site.guards_required },
        { label: t("sup_present"), value: site.on_duty_now, tone: "present" },
        { label: t("sup_late"), value: site.late, tone: site.late ? "halfDay" : undefined },
        { label: t("sup_absent"), value: site.absent, tone: site.absent ? "absent" : undefined },
      ]} />
    </Card>
  );
}

function OnDutyRow({ guard, siteName }: { guard: OnDutyGuard; siteName: string }) {
  const t = useT(); const tt = staffTime();
  const tone = guard.in_fence === true ? "present" : guard.in_fence === false ? "signal" : "neutral";
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Dot tone={tone} />
        <View style={{ flex: 1 }}>
          <Body size={16}>{guard.guard_name}</Body>
          <Eyebrow>{siteName}</Eyebrow>
        </View>
        {guard.last_seen_at ? <Mono>{t("sup_last_seen", relative(tt.relative(Date.parse(guard.last_seen_at))))}</Mono> : null}
        {guard.battery_pct != null ? <Mono>{`${guard.battery_pct}%`}</Mono> : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {!guard.location_enabled ? <Pill text={t("sup_location_off")} tone="absent" /> : null}
        {guard.in_fence === false ? <Pill text={t("sup_outside")} tone="halfDay" /> : null}
        <View style={{ flex: 1 }} />
        {guard.guard_phone ? <CallChip phone={guard.guard_phone} /> : null}
      </View>
    </View>
  );
}
