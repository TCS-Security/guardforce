import type { ConfigContext, ExpoConfig } from "expo/config";

// app.json holds the static config; environment variables override the backend coordinates so
// one checkout can build against the local stack (default), a phone on the LAN, or the cloud
// project: GF_SUPABASE_URL=http://192.168.0.105:54321 bun expo run:android
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  extra: {
    ...config.extra,
    supabaseUrl: process.env.GF_SUPABASE_URL ?? config.extra?.supabaseUrl,
    supabaseAnonKey: process.env.GF_SUPABASE_ANON_KEY ?? config.extra?.supabaseAnonKey,
    otaChannel: process.env.GF_OTA_CHANNEL ?? config.extra?.otaChannel,
  },
});
