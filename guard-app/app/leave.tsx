import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { guardApi } from "@/api/guardApi";
import type { LeaveBalance, LeaveRequest } from "@/api/types";
import { cancelLeave, time, useStore } from "@/data/store";
import { useT } from "@/i18n";
import { Banner, BigButton, Body, Card, EmptyState, Loading, Mono, Pill, Screen, Section, TextButton, Tile, Title } from "@/ui/components";
import { errorText, leave as leaveLabel, leaveType } from "@/ui/labels";

export default function LeaveScreen() {
  const t = useT(); const router = useRouter(); const tt = time();
  const guardId = useStore((s) => s.me?.guard.id);
  const [balance, setBalance] = useState<LeaveBalance | null>(null); const [requests, setRequests] = useState<LeaveRequest[] | null>(null); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!guardId) return;
    try { setBalance(await guardApi.leaveBalance(guardId, new Date().getFullYear())); setRequests(await guardApi.listLeave(guardId)); setError(null); }
    catch (e) { setError(errorText(e)); setRequests((r) => r ?? []); }
  }, [guardId]);
  useEffect(() => { void load(); }, [load]);
  const b = balance ?? { year: 0, casual_total: 12, earned_total: 15, casual_used: 0, earned_used: 0, unpaid_used: 0 };
  return (
    <Screen eyebrow={t("leave_eyebrow")} title={t("leave_title")} onBack={() => router.back()} bottom={<BigButton text={t("leave_apply")} onPress={() => router.push("/leave-apply" as never)} />}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Tile label={t("leave_casual")} value={String(b.casual_total - b.casual_used)} sub={t("leave_balance_left", b.casual_total - b.casual_used, b.casual_total)} />
        <Tile label={t("leave_earned")} value={String(b.earned_total - b.earned_used)} sub={t("leave_balance_left", b.earned_total - b.earned_used, b.earned_total)} />
        <Tile label={t("leave_unpaid")} value={String(b.unpaid_used)} />
      </View>
      {error ? <Banner text={error} tone="signal" /> : null}
      <Section title={t("leave_eyebrow")} />
      {requests == null ? <Loading /> : !requests.length ? <EmptyState text={t("leave_empty")} /> : requests.map((lr) => {
        const [label, tone] = leaveLabel(lr.status);
        return (
          <Card key={lr.id}>
            <View style={{ flexDirection: "row", alignItems: "center" }}><View style={{ flex: 1 }}><Title>{leaveType(lr.type)}</Title></View><Pill text={label} tone={tone} /></View>
            <View style={{ marginTop: 4 }}><Mono>{lr.start_date === lr.end_date ? tt.day(lr.start_date) : `${tt.day(lr.start_date)} → ${tt.day(lr.end_date)}`}</Mono></View>
            {lr.reason ? <Body muted size={13}>{lr.reason}</Body> : null}
            {lr.decision_note ? <Body size={13}>{`“${lr.decision_note}”`}</Body> : null}
            {lr.status === "pending" ? <TextButton text={t("leave_cancel")} onPress={() => { void cancelLeave(lr.id).catch(() => undefined).then(load); }} /> : null}
          </Card>
        );
      })}
    </Screen>
  );
}
