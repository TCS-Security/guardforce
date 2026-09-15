# GuardForce guard app (Expo / React Native)

The guard's shift is enforced from this phone: selfie + GPS check-in, continuous tracking in a
native foreground service, patrols with photo proof, tasks, leave, and an offline outbox so every
action survives a dead network and a reboot. Screens are TypeScript and ship over the air with
EAS Update; the tracking service is a local Expo module in Kotlin and changes rarely.

## Run on your phone (fast loop)

```
cd guard-app && bun install
export JAVA_HOME=~/.jdks/temurin-21 ANDROID_HOME=~/Android/Sdk
GF_SUPABASE_URL=http://<your-lan-ip>:54321 bun expo run:android     # builds and installs the dev client once
bun start                                                           # then: JS reloads over Wi-Fi on every save
```

`expo run:android` needs a phone on USB with USB debugging on (or a running emulator). After the
first install you only need `bun start`; the dev client connects to Metro over the LAN. Rebuild the
native client only when `modules/`, `app.json` plugins or native dependencies change.

Backend coordinates: `GF_SUPABASE_URL` / `GF_SUPABASE_ANON_KEY` (see `app.config.ts`); the default
points an emulator at the local stack (`10.0.2.2`). Debug builds allow cleartext HTTP.

Demo login: any seeded guard phone (`99000 00001` … `99000 00016`) with OTP `123456` locally
(`supabase/config.toml` `[auth.sms.test_otp]`), then choose a PIN.

## Supervisor mode

Owners and supervisors sign in with their dashboard email and password ("Supervisor or owner?"
on the phone screen). `staff_me()` decides the mode; a guard-kind profile is refused with
NOT_STAFF. Screens under `app/supervisor/`: site board with required vs on-site and open alerts,
site day view, shift detail with exception and attendance correction, alerts with acknowledge
and call, leave inbox, guard list, add guard, guard record with camera capture of the reference
photo and KYC documents (access-logged on view), roster day with ad-hoc assignment, task
assignment, account. Every action is gated by the same permission keys as the dashboard
(`useCan("roster:write")` etc.), so a custom role sees exactly what the owner allowed. The
backend contract is `src/api/staffApi.ts` ↔ `supabase/migrations/0012_supervisor_app.sql`,
tested end to end in `dashboard/e2e/supervisor-app.spec.ts`.

## Checks

```
bun run typecheck && bun run lint && bun run test      # tsc, eslint, jest (domain + gate)
bun expo prebuild --platform android --clean            # regenerates android/ (gitignored, CNG)
```

The server contract is tested for real in `dashboard/e2e/guard-app.spec.ts`, which signs in as a
guard with phone + OTP and runs check-in → pings → patrol → task → leave → check-out under RLS.

## Shape

| Path | Role |
|---|---|
| `app/` | expo-router screens. `_layout.tsx` owns the auth gate (`src/auth/gate.ts`) and the sync loop. |
| `src/api/` | `supabase.ts` (client, SecureStore session), `guardApi.ts` (every RPC and read), `errors.ts` (PL/pgSQL tokens → `ApiError`). |
| `src/auth/` | Identity facts and the local PIN hash in SecureStore; the route gate. |
| `src/domain/` | Pure, unit-tested: fence distance (mirrors `site_distance_m`), duty state, versions, phone parsing, time. |
| `src/data/` | `db.ts` (expo-sqlite: outbox, local shift, pings, cache, overrides), `sync.ts` (drain native → outbox in order → pings), `store.ts` (zustand; auth stage, me/home, every write). |
| `src/ui/` | Theme mirroring the dashboard tokens, components, camera (CameraX via expo-camera) with KB-cap compression, GPS fix hook. |
| `src/i18n/` | English and Hindi strings (generated from the original Android XML), `useT()`. |
| `modules/guard-tracking/` | Local Expo module (Kotlin): foreground service with fused location, adaptive cadence, location-off detection and warnings, boot restart, a SQLite record store JS drains. |

## How tracking and sync fit together

The native service records pings, location on/off transitions and patrol trail points into its
own SQLite store and needs no auth. JS (`sync.ts`) drains that store into the outbox every three
minutes while the app process lives, on every foreground, and after every write, then replays the
outbox strictly in order and flushes pings once the shift's server id is known. If the process is
killed, the service keeps recording and the buffer is drained the next time the app opens.

## Over-the-air

`app_config` (min version, ping cadence, image caps, feature flags) is read on every launch;
`min_app_version` forces an update. JS changes ship with `eas update --channel production`; native
changes (this module, new native packages) need a Play release. The manifest claims the full
permission surface on day one so the native release cadence can stay slow.
