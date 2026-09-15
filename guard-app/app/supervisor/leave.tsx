import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ToastAndroid, View } from "react-native";
import { staffApi } from "@/api/staffApi";
import type { LeaveInboxItem } from "@/api/staffTypes";
import { refreshStaffHome, staffTime, useCan } from "@/data/staffStore";
import { useT } from "@/i18n";
import { Banner, BigButton, Body, Card, EmptyState, Loading, Mono, Screen, SecondaryButton, Title } from "@/ui/components";
import { errorText, leaveType } from "@/ui/labels";
import { Input } from "@/ui/supervisor/monitor/controls";

export default function LeaveInboxScreen() {
  const t = useT(); const router = useRouter();
  const canDecide = useCan("leave:decide");
  const [items, setItems] = useState<LeaveInboxItem[] | null>(null); const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canDecide) { setItems([]); return; }
    staffApi.leaveInbox().then(setItems).catch((e) => { setError(errorText(e)); setItems([]); });
  }, [canDecide]);

  const decided = (id: string) => { setItems((prev) => (prev ?? []).filter((i) => i.id !== id)); ToastAndroid.show(t("sup_leave_decided"), ToastAndroid.SHORT); void refreshStaffHome(); };

  return (
    <Screen eyebrow={t("sup_leave_eyebrow")} title={t("sup_leave_title")} onBack={() => router.back()}>
      {error ? <Banner text={error} tone="signal" /> : null}
      {!canDecide ? <EmptyState text={t("sup_leave_none")} /> : items == null ? <Loading /> : !items.length ? <EmptyState text={t("sup_leave_none")} />
        : items.map((item) => <LeaveCard key={item.id} item={item} onDecided={() => decided(item.id)} onError={setError} />)}
    </Screen>
  );
}

function LeaveCard({ item, onDecided, onError }: { item: LeaveInboxItem; onDecided: () => void; onError: (message: string) => void }) {
  const t = useT(); const tt = staffTime();
  const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  const decide = async (approve: boolean) => {
    setBusy(true);
    try { await staffApi.decideLeave(item.id, approve, note.trim() || null); onDecided(); }
    catch (e) { onError(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <Card>
      <Title>{item.guard_name}</Title>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
        <Body muted size={13}>{leaveType(item.type)}</Body>
        <Mono>{item.start_date === item.end_date ? tt.day(item.start_date) : `${tt.day(item.start_date)} → ${tt.day(item.end_date)}`}</Mono>
        {item.site_name ? <Body muted size={13}>{item.site_name}</Body> : null}
      </View>
      {item.reason ? <Body style={{ marginTop: 6 }}>{item.reason}</Body> : null}
      <View style={{ marginTop: 6 }}><Mono>{t("sup_leave_balance", item.casual_left ?? "–", item.earned_left ?? "–")}</Mono></View>
      <View style={{ height: 12 }} />
      <Input value={note} onChangeText={setNote} placeholder={t("sup_leave_note")} multiline={false} />
      <View style={{ height: 12 }} />
      <BigButton text={t("sup_approve")} loading={busy} onPress={() => { void decide(true); }} />
      <View style={{ height: 8 }} />
      <SecondaryButton text={t("sup_decline")} disabled={busy} onPress={() => { void decide(false); }} />
    </Card>
  );
}
