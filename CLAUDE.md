# GuardForce — working conventions

Guard management platform for Indian security agencies. Spec: `prd-v2-guard-platform.md` (source of truth), founder notes in `guard-crm-notes.md`.

## Layout
- `supabase/` — Postgres schema (`migrations/`), RPCs, RLS, storage buckets, demo `seed.sql`. Shared by the web dashboard and the Android guard app.
- `dashboard/` — Next.js 16 (App Router, Turbopack) + Tailwind v4 + shadcn (base-nova style, **Base UI** primitives, not Radix). Package manager: **bun**.
- `android/` — Kotlin + Compose guard app (`android/README.md`). Business rules stay in SQL and `app_config` is remote config, so behaviour changes ship without a Play release; the manifest claims the full permission surface up front.

## Local stack
```
supabase start --workdir /home/chirag/TCS      # local stack; Studio at :54323
supabase db reset --workdir /home/chirag/TCS   # re-apply migrations + seed
cd dashboard && bun run dev                    # http://localhost:3000
bun run typecheck && bun run test && bun run test:e2e
```
`supabase gen types typescript --local --workdir .. > src/lib/supabase/database.types.ts` after any schema change (`bun run db:types`).
Logins (password `guardforce`): `platform@guardforce.test` (our platform console), `owner@sentinel.test` (tenant owner), `priya@` / `arun@sentinel.test` (site-scoped supervisors), `owner@falcon.test` (second, empty tenant). Guard PIN `1234`. Never use `npx` (private registry); use `bun`/`bunx` and the brew `supabase` binary.

## Dashboard code conventions
- Server Components fetch data with `createClient()` from `@/lib/supabase/server` (RLS applies). Put loaders in `src/lib/data/<module>.ts`. Mutations are Server Actions in `actions.ts` next to the route, validated with zod, returning `{ error?: string }`; call `revalidatePath` after writes.
- Service role (`@/lib/supabase/admin`) only for: creating auth users, public share pages, signed storage URLs, monitors.
- Tenancy and access, in one paragraph. We are the SaaS provider: `platform_admins` are our staff, hold no tenant profile, and work in `/platform` through the service-role client behind `requirePlatformAdmin()`. Tenants are `agencies` with a lifecycle (`status`: trial/active/suspended/churned); `current_agency_id()` returns null for a suspended tenant, which is the single choke point every policy uses. Inside a tenant, access is **role × scope**: `roles` hold permission keys from `permission_catalogue` (four system roles seeded per tenant by trigger; Owner is immutable), `profiles.role_id` picks the role, and `profiles.all_sites` or `supervisor_sites` decides which sites the person sees. `profiles.role` is only the *kind* now: owner | staff | guard.
- `requireSession()` gives `{ profile, agency, role, siteIds, permissions, can(key), isOwner, isManager }`. Gate pages with `requirePermission(session, "x:read")` (404, never a hint), server actions with `const denied = deny(session, "x:write"); if (denied) return denied;`, and UI affordances with `session.can(...)`. RLS enforces the same keys via `has_permission()` in every write policy, so the app checks are for friendly errors, not security. The catalogue's TypeScript mirror is `src/lib/auth/permissions.ts`; the nav filters on `ROUTE_PERMISSION`. New permission = one row in the catalogue (migration) + one entry in the mirror + a policy that checks it.
- Domain rules live in SQL RPCs (`check_in`, `check_out`, `ingest_pings`, `report_location_state`, `log_shift_exception`, `override_attendance`, `start_patrol`, `complete_patrol`, `decide_leave`, `materialize_roster`, `run_monitors`, `site_day_summary`, `attendance_trend`, `guard_scorecard`, `resolve_profile_share`). Call them via `supabase.rpc(...)`; mirror pure logic in `src/lib/domain/*` with unit tests.
- Design system: read `src/app/globals.css` tokens and `src/components/gf/*` first. Use `PageHeader`, `StatTile`, `Section`, `StatusPill`/badges, `GuardAvatar`, `Mono`, `KvList`, `EmptyState`, `ButtonLink`. Fonts: Bricolage Grotesque (display: h1–h3, big numbers), Schibsted Grotesk (body), JetBrains Mono (timestamps, ids, eyebrows). Status colours are tokens: `present`, `half-day`, `absent`, `on-leave`, `signal` (alerts), `primary` (olive). Never use raw Tailwind palette colours for status.
- Look at `src/app/(app)/(overview)/page.tsx` for the reference page: eyebrow → display title → description → actions; tiles; sections with hairline headers; mono tabular numbers; `reveal` stagger via `--i`.
- Base UI gotchas: `<Button render={<Link/>}>` needs `nativeButton={false}` (use `ButtonLink`). `DropdownMenuLabel` must sit inside `DropdownMenuGroup`. `DropdownMenuItem`/`SheetTrigger`/`PopoverTrigger` take `render`. Selects: `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`.
- Maps: build on `src/components/map/base-map.tsx` (never instantiate MapLibre directly). It registers the worker from `/public/maplibre` — MapLibre derives that URL from its own module URL, which Turbopack rewrites, so without it every tile and GeoJSON source stays silently empty. It also probes the tile server and falls back to a flat canvas so fences still render offline. `bun run dev`/`build` sync the worker via `scripts/sync-maplibre-worker.mjs`. Fence geometry: `fenceGeometry()` in `src/lib/domain/geo.ts`.
- RLS: a read policy must decide from the row plus `sees_all_sites()` / `accessible_site_ids()`, never from the old role names (`current_role() in ('owner','admin')` silently excluded every-site staff). Never let one table's policy reference another table whose policy references back (tasks/task_assignments hit "infinite recursion in policy"); go through a `security definer` helper. A policy that calls a `stable` function reading the same table also breaks `INSERT ... RETURNING`, because the function cannot see the row being inserted — evaluate the rule against the candidate row instead.
- PL/pgSQL: never name a local variable after a column you also write (`flags`, `in_fence`); Postgres raises `column reference is ambiguous` the first time the function runs. Prefix locals with `v_`.
- Storage: buckets `kyc-docs`, `selfies`, `patrol-photos`, `task-photos` are private; object paths start with `<agency_id>/`. Serve via signed URLs (`createSignedUrl`, 10 min) from a server action or route handler; log KYC doc access in `document_access_logs`.
- Time: agency timezone (`agency.timezone`, IST). Use helpers in `src/lib/domain/format.ts`.
- Tests: unit (vitest, `*.test.ts(x)` beside code or in `__tests__`), e2e (Playwright in `dashboard/e2e`, seeded data ids in `e2e/helpers.ts`, `admin()` client to simulate the guard app via RPCs). Every feature ships with both. E2E tests must reset any state they mutate (or use fresh rows) so the suite is re-runnable without `db reset`; where a test needs a specific row, raise it in the test rather than relying on the seed's random half.
- Dates in tests come from `agencyDate()` in `e2e/helpers.ts`: the app filters in IST, so a UTC "yesterday" silently queries the wrong day for most of the evening.
- Assert on a state change the server produced (a row, a button that disappears), not on text that was already on screen — `getByText("Missed")` also matches the "Mark missed" button and will pass before the write lands.
- Screenshots for visual review: `node scripts/shot.mjs /route ...` writes `/tmp/shot-<route>.png`.

## Guard app conventions
- Build: `cd android && ./gradlew :app:assembleDebug :app:testDebugUnitTest` with `JAVA_HOME` at a JDK 17+ and `ANDROID_HOME` at an SDK with platform 35. Library versions are pinned to the AGP 8.13 / compileSdk 35 line in `gradle/libs.versions.toml`; the newest androidx releases need AGP 9.1 and SDK 37, so bump both together or not at all.
- The app never touches a table directly for writes: every write is an RPC in `0011_guard_app.sql` or the shift RPCs, queued in the Room outbox and replayed in order by `SyncEngine`. Add a guard action = one RPC (idempotent on retry) + one outbox `Kinds` entry + one `execute` branch.
- Guards authenticate with phone + OTP (GoTrue SMS signups), then `claim_guard_account()` links the auth user to the `guards` row by phone and creates the guard-kind profile. Locally every seeded phone verifies with OTP `123456` (`[auth.sms.test_otp]`); the placeholder Twilio block in `config.toml` only exists because the CLI keeps phone sign-in off without a provider.
- ROLE-1 is enforced in RLS: read policies give site scope to `is_manager()` only; guards get their own rows. Keep that shape when adding tables.
- Pure logic goes in `android/.../domain/` with JUnit tests; `Geo` must mirror `site_distance_m` / `is_in_fence`.
- Screens follow the dashboard: eyebrow (mono, uppercase) → display title (Bricolage) → body (Schibsted); status tones from `ui/theme` only; one `BigButton` per action screen.

