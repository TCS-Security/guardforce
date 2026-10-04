import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { guardApi } from "@/api/guardApi";
import type { NotificationItem } from "@/api/types";
import { refreshHome, time, useStore } from "@/data/store";
import { useT } from "@/i18n";
import { Banner, Body, Card, Dot, EmptyState, Loading, Mono, Screen, TextButton, Title } from "@/ui/components";
import { errorText, relative } from "@/ui/labels";

export default function NotificationsScreen() {
  const t = useT(); const router = useRouter(); const tt = time();
  const guardId = useStore((s) => s.me?.guard.id);
  const [items, setItems] = useState<NotificationItem[] | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (guardId) guardApi.listNotifications(guardId).then(setItems).catch((e) => { setError(errorText(e)); setItems([]); }); }, [guardId]);
  const unread = items?.filter((n) => !n.read_at) ?? [];
  return (
    <Screen eyebrow={t("notifications_eyebrow")} title={t("notifications_title")} onBack={() => router.back()}
      header={unread.length ? <TextButton text={t("notifications_mark_read")} onPress={async () => { await guardApi.markNotificationsRead(unread.map((n) => n.id)).catch(() => undefined); setItems(items!.map((n) => ({ ...n, read_at: n.read_at ?? tt.nowIso() }))); void refreshHome(); }} /> : null}>
      {error ? <Banner text={error} tone="signal" /> : null}
      {items == null ? <Loading /> : !items.length ? <EmptyState text={t("notifications_empty")} /> : items.map((n) => (
        <Card key={n.id}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {!n.read_at ? <Dot tone="signal" /> : null}
            <View style={{ flex: 1 }}><Title>{n.title}</Title></View>
            <Mono>{relative(tt.relative(Date.parse(n.created_at)))}</Mono>
          </View>
          {n.body ? <Body muted style={{ marginTop: 4 }}>{n.body}</Body> : null}
        </Card>
      ))}
    </Screen>
  );
}
