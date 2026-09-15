import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { AppState, ToastAndroid, useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { env } from "@/api/supabase";
import { needsUpdate } from "@/domain/semver";
import { prefs } from "@/auth/prefs";
import { onSyncIssue } from "@/data/sync";
import { bootstrap, refreshAll, registerDevice, syncNow, useStore } from "@/data/store";
import { refreshStaffAll } from "@/data/staffStore";
import { errorText } from "@/ui/labels";
import { ApiError } from "@/api/errors";
import { landingRoute } from "@/auth/gate";
import { dark, light } from "@/ui/theme";

SplashScreen.preventAutoHideAsync().catch(() => undefined);
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });

const GATES = new Set(["phone", "otp", "staff-login", "claim", "set-pin", "lock", "permissions", "reg-selfie", "update", "blocked"]);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    bricolage_grotesque: require("../assets/fonts/bricolage_grotesque.ttf"),
    schibsted_grotesk: require("../assets/fonts/schibsted_grotesk.ttf"),
    jetbrains_mono: require("../assets/fonts/jetbrains_mono.ttf"),
  });
  const stage = useStore((s) => s.stage);
  const me = useStore((s) => s.me);
  const router = useRouter();
  const segments = useSegments();
  const scheme = useColorScheme();

  useEffect(() => { void bootstrap(); }, []);
  useEffect(() => { if (fontsLoaded && stage !== "loading") SplashScreen.hideAsync().catch(() => undefined); }, [fontsLoaded, stage]);

  // Route gate: every stage change lands where it must.
  useEffect(() => {
    if (stage === "loading") return;
    (async () => {
      const blocked = me && (me.agency.status === "suspended" || me.agency.status === "churned") ? "suspended" : me?.guard.status === "inactive" ? "inactive" : null;
      const target = landingRoute(stage, await prefs.permissionsDone(), !me || !!me.guard.registration_selfie_path, needsUpdate(env.appVersion, me?.config?.min_app_version), blocked);
      const current = segments[0] ?? "";
      if (target === "/supervisor") { if (current !== "supervisor") router.replace("/supervisor" as never); return; }
      if (target) { if (`/${current}` !== target && !(target === "/phone" && (current === "otp" || current === "staff-login"))) router.replace(target as never); }
      else if (current === "" || GATES.has(current)) router.replace("/home");
    })();
  }, [stage, me?.guard.registration_selfie_path, me?.config?.min_app_version, me?.agency.status, me?.guard.status]);

  // Staff mode: refresh the supervisor bundle on open and on every foreground.
  useEffect(() => {
    if (stage !== "staff") return;
    void refreshStaffAll();
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") void refreshStaffAll(); });
    return () => sub.remove();
  }, [stage]);

  // Ready: refresh, sync, register the install; keep syncing while the app lives.
  useEffect(() => {
    if (stage !== "ready") return;
    void (async () => { await refreshAll(); await syncNow(); await registerDevice(null); })();
    const timer = setInterval(() => { void syncNow(); }, 180_000);
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") { void refreshAll(); void syncNow(); } });
    return () => { clearInterval(timer); sub.remove(); };
  }, [stage]);

  useEffect(() => { const off = onSyncIssue((code) => ToastAndroid.show(errorText(new ApiError(code, code)), ToastAndroid.LONG)); return () => { off(); }; }, []);

  if (!fontsLoaded) return null;
  const p = scheme === "dark" ? dark : light;
  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.paper }, animation: "fade" }} />
    </SafeAreaProvider>
  );
}
