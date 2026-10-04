import { Camera as CameraApi } from "expo-camera";
import * as IntentLauncher from "expo-intent-launcher";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState, View } from "react-native";
import Constants from "expo-constants";
import { prefs } from "@/auth/prefs";
import { useT } from "@/i18n";
import { BigButton, Body, Card, Pill, Screen, TextButton, Title } from "@/ui/components";

type Perms = { fg: boolean; bg: boolean; camera: boolean; notif: boolean };

export default function PermissionsScreen() {
  const t = useT(); const router = useRouter();
  const [perms, setPerms] = useState<Perms>({ fg: false, bg: false, camera: false, notif: false });
  const check = useCallback(async () => {
    const [fg, bg, cam, notif] = await Promise.all([Location.getForegroundPermissionsAsync(), Location.getBackgroundPermissionsAsync(), CameraApi.getCameraPermissionsAsync(), Notifications.getPermissionsAsync()]);
    setPerms({ fg: fg.granted, bg: bg.granted, camera: cam.granted, notif: notif.granted });
  }, []);
  useEffect(() => { void check(); const sub = AppState.addEventListener("change", (s) => { if (s === "active") void check(); }); return () => sub.remove(); }, [check]);

  const pkg = Constants.expoConfig?.android?.package ?? "com.guardforce.guard";
  const row = (title: string, why: string, ok: boolean, ask: () => Promise<unknown>) => (
    <Card onPress={ok ? undefined : () => { void ask().then(check); }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}><Title>{title}</Title></View>
        <Pill text={ok ? t("perm_granted") : t("perm_grant")} tone={ok ? "present" : "olive"} />
      </View>
      <Body muted size={13} style={{ marginTop: 4 }}>{why}</Body>
    </Card>
  );
  const allCore = perms.fg && perms.camera && perms.notif;
  return (
    <Screen eyebrow={t("perm_eyebrow")} title={t("perm_title")} description={t("perm_body")}
      bottom={<BigButton text={t("perm_continue")} disabled={!allCore} onPress={async () => { await prefs.setPermissionsDone(true); router.replace("/home"); }} />}>
      {row(t("perm_location"), t("perm_location_why"), perms.fg && perms.bg, async () => { if (!perms.fg) await Location.requestForegroundPermissionsAsync(); else await Location.requestBackgroundPermissionsAsync(); })}
      {row(t("perm_camera"), t("perm_camera_why"), perms.camera, () => CameraApi.requestCameraPermissionsAsync())}
      {row(t("perm_notifications"), t("perm_notifications_why"), perms.notif, () => Notifications.requestPermissionsAsync())}
      {row(t("perm_battery"), t("perm_battery_why"), false, () => IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, { data: `package:${pkg}` }))}
      <TextButton text={t("perm_open_settings")} onPress={() => { void IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, { data: `package:${pkg}` }); }} />
    </Screen>
  );
}
