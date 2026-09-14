# GuardForce guard app (Android)

Kotlin + Jetpack Compose. The guard's shift is enforced from this phone: selfie + GPS check-in,
continuous tracking in a foreground service, patrols with photo proof, tasks, leave, and an
offline outbox so every action survives a dead network and a reboot.

## Build

```
export JAVA_HOME=~/.jdks/temurin-21 ANDROID_HOME=~/Android/Sdk   # JDK 17+ and SDK 35
cd android
./gradlew :app:assembleDebug            # app/build/outputs/apk/debug/app-debug.apk
./gradlew :app:testDebugUnitTest        # domain unit tests
```

Backend coordinates come from `-Pgf.supabaseUrl=… -Pgf.supabaseAnonKey=…`, `local.properties`,
or `GF_SUPABASE_URL` / `GF_SUPABASE_ANON_KEY`. The default points an emulator at the local
Supabase stack (`http://10.0.2.2:54321`). For a physical phone on the LAN pass your machine's IP;
debug builds allow cleartext to `192.168.*` (`res/xml/network_security_config_debug.xml`).

Push needs a Firebase project: drop `app/google-services.json` in place and the plugin is applied
automatically. Without it the app still builds and simply registers the install without a token.

## Demo login

Any seeded guard phone (`99000 00001` … `99000 00016`) with OTP `123456` locally
(`supabase/config.toml` `[auth.sms.test_otp]`). First sign-in claims the guard row and asks for a
PIN; later launches unlock with the PIN (or fingerprint).

## Shape

| Package | Role |
|---|---|
| `api/` | Thin REST client for GoTrue, PostgREST, Storage. `GuardApi` is the contract; `SupabaseGuardApi` the only implementation. |
| `auth/` | `SessionStore` (EncryptedSharedPreferences) and the `AuthManager` state machine: signed out → needs claim → needs PIN → locked → ready. |
| `domain/` | Pure logic, unit tested: fence distance (radius/polygon + leeway), adaptive ping cadence, duty state, version and phone parsing. |
| `data/` | Room (`outbox`, `pings`, `local_shifts`, `trail_points`, `cache`, `overrides`), `SyncEngine` (drains the outbox in order, flushes pings in batches), WorkManager scheduling, `GuardRepository`. |
| `tracking/` | `TrackingService` foreground service (fused location, location-off detection and 30-min warnings, patrol trail, patrol-due reminders), `BootReceiver`. |
| `media/` | CameraX capture, JPEG compression to the agency's KB caps. |
| `push/` | FCM service and device registration. |
| `ui/` | Compose screens, theme mirroring the dashboard tokens, navigation. |

## Server contract

Everything the app writes goes through SQL functions (`supabase/migrations/0003_functions.sql`,
`0007_…`, `0011_guard_app.sql`): `claim_guard_account`, `guard_me`, `guard_home`, `set_guard_pin`,
`verify_guard_pin`, `register_device`, `check_in`, `ingest_pings`, `report_location_state`,
`report_tamper`, `check_out`, `start_patrol`, `complete_patrol`, `start_task`, `complete_task`,
`apply_leave`, `cancel_leave`, `set_registration_selfie`. Reads for history, leave and
notifications are plain table selects under RLS. `dashboard/e2e/guard-app.spec.ts` drives this
contract end to end as a real guard session.

## Over-the-air

There is no code OTA for a native app; what ships over the air is behaviour: the rules live in SQL,
and `app_config` (min version, ping cadence, image caps, feature flags) is read on every launch.
`min_app_version` forces an update screen. That is why the manifest claims the full permission
surface (background location, camera, notifications, exact alarms, NFC, Bluetooth scan, phone
dial) on day one.
