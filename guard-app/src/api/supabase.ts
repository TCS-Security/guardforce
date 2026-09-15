import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { AppState } from "react-native";

const extra = (Constants.expoConfig?.extra ?? {}) as { supabaseUrl?: string; supabaseAnonKey?: string; otaChannel?: string; playStoreUrl?: string };
export const env = {
  supabaseUrl: extra.supabaseUrl ?? "http://10.0.2.2:54321",
  supabaseAnonKey: extra.supabaseAnonKey ?? "",
  otaChannel: extra.otaChannel ?? "production",
  playStoreUrl: extra.playStoreUrl ?? "",
  appVersion: Constants.expoConfig?.version ?? "1.0.0",
};

// The session lives in the Android keystore-backed SecureStore. (Android has no 2 KB limit; the
// warning only applies to iOS.)
const secureStorage = {
  getItem: (k: string) => SecureStore.getItemAsync(k),
  setItem: (k: string, v: string) => SecureStore.setItemAsync(k, v),
  removeItem: (k: string) => SecureStore.deleteItemAsync(k),
};

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: { storage: secureStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// Refresh tokens only while the app is in the foreground (the tracking service does not need auth).
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh();
});
