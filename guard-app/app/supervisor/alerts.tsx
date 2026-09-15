import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { staffApi } from "@/api/staffApi";
import type { AlertItem } from "@/api/staffTypes";
import { refreshStaffHome, staffTime, useStaff } from "@/data/staffStore";
import { useT } from "@/i18n";
import { Banner, Body, Card, Dot, EmptyState, Mono, Screen, SecondaryButton, Title } from "@/ui/components";
import { errorText, relative } from "@/ui/labels";
import { CallChip } from "@/ui/supervisor/monitor/controls";
import { alertTone } from "@/ui/supervisor/monitor/labels";

export default function AlertsScreen() {
  const t = useT(); const router = useRouter(); const tt = staffTime();
  const alerts = useStaff((s) => s.home?.alerts ?? []);
  const [acked, setAcked] = useState<string[]>([]); const [error, setError] = useState<string | null>(null);
  useEffect(() => { void refreshStaffHome(); }, []);
  const open = alerts.filter((a) => !acked.includes(a.id));

  const acknowledge = async (a: AlertItem) => {
    setAcked((prev) => [...prev, a.id]);
    try { await staffApi.acknowledgeEvent(a.id); setError(null); await refreshStaffHome(); }
    catch (e) { setError(errorText(e)); setAcked((prev) => prev.filter((id) => id !== a.id)); }
  };

  return (
    <Screen eyebrow={t("sup_alerts_eyebrow")} title={t("sup_alerts")} onBack={() => router.back()}>
      {error ? <Banner text={error} tone="signal" /> : null}
      {!open.length ? <EmptyState text={t("sup_alerts_none")} /> : open.map((a) => (
        <Card key={a.id} onPress={a.shift_id && a.site_id ? () => router.push({ pathname: "/supervisor/shift/[id]", params: { id: a.shift_id ?? "", site: a.site_id ?? "", date: a.created_at.slice(0, 10) } } as never) : undefined}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Dot tone={alertTone(a.severity)} />
            <View style={{ flex: 1 }}><Title>{a.title}</Title></View>
            <Mono>{relative(tt.relative(Date.parse(a.created_at)))}</Mono>
          </View>
          <View style={{ marginTop: 4 }}><Mono>{[a.site_name, a.guard_name].filter(Boolean).join(" · ")}</Mono></View>
          {typeof a.payload?.body === "string" ? <Body muted size={13} style={{ marginTop: 4 }}>{a.payload.body}</Body> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 }}>
            {a.guard_phone ? <CallChip phone={a.guard_phone} /> : null}
            <View style={{ flex: 1 }}><SecondaryButton text={t("sup_ack")} onPress={() => { void acknowledge(a); }} /></View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
