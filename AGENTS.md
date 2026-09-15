# GuardForce — working conventions

Guard management platform for Indian security agencies. Spec: `prd-v2-guard-platform.md` (source of truth), founder notes in `guard-crm-notes.md`.

## Layout
- `supabase/` — Postgres schema (`migrations/`), RPCs, RLS, storage buckets, demo `seed.sql`. Shared by the web dashboard and the Android guard app.
- `dashboard/` — Next.js 16 (App Router, Turbopack) + Tailwind v4 + shadcn (base-nova style, **Base UI** primitives, not Radix). Package manager: **bun**.
- `guard-app/` — Expo / React Native guard app (`guard-app/README.md`) with a local Kotlin Expo module for tracking; business rules stay in SQL, `app_config` is remote config.

## Local stack
```
supabase start --workdir /home/chirag/TCS      # local stack; Studio at :54323
supabase db reset --workdir /home/chirag/TCS   # re-apply migrations + seed
cd dashboard && bun run dev                    # http://localhost:3000
bun run typecheck && bun run test && bun run test:e2e
```
`supabase gen types typescript --local --workdir .. > src/lib/supabase/database.types.ts` after any schema change (`bun run db:types`).
Logins: owner@sentinel.test / priya@sentinel.test / arun@sentinel.test — password `guardforce`. Guard PIN `1234`. Never use `npx` (private registry); use `bun`/`bunx` and the brew `supabase` binary.

## Dashboard code conventions
- Server Components fetch data with `createClient()` from `@/lib/supabase/server` (RLS applies). Put loaders in `src/lib/data/<module>.ts`. Mutations are Server Actions in `actions.ts` next to the route, validated with zod, returning `{ error?: string }`; call `revalidatePath` after writes.
- Service role (`@/lib/supabase/admin`) only for: creating auth users, public share pages, signed storage URLs, monitors.
- `requireSession()` gives `{ profile, agency, siteIds, isOwner, isManager }`. Supervisors are site-scoped by RLS; never bypass it.
- Domain rules live in SQL RPCs (`check_in`, `check_out`, `ingest_pings`, `report_location_state`, `log_shift_exception`, `override_attendance`, `start_patrol`, `complete_patrol`, `decide_leave`, `materialize_roster`, `run_monitors`, `site_day_summary`, `attendance_trend`, `guard_scorecard`, `resolve_profile_share`). Call them via `supabase.rpc(...)`; mirror pure logic in `src/lib/domain/*` with unit tests.
- Design system: read `src/app/globals.css` tokens and `src/components/gf/*` first. Use `PageHeader`, `StatTile`, `Section`, `StatusPill`/badges, `GuardAvatar`, `Mono`, `KvList`, `EmptyState`, `ButtonLink`. Fonts: Bricolage Grotesque (display: h1–h3, big numbers), Schibsted Grotesk (body), JetBrains Mono (timestamps, ids, eyebrows). Status colours are tokens: `present`, `half-day`, `absent`, `on-leave`, `signal` (alerts), `primary` (olive). Never use raw Tailwind palette colours for status.
- Look at `src/app/(app)/(overview)/page.tsx` for the reference page: eyebrow → display title → description → actions; tiles; sections with hairline headers; mono tabular numbers; `reveal` stagger via `--i`.
- Base UI gotchas: `<Button render={<Link/>}>` needs `nativeButton={false}` (use `ButtonLink`). `DropdownMenuItem`/`SheetTrigger`/`PopoverTrigger` take `render`. Selects: `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`.
- Maps: MapLibre GL (`maplibre-gl`) with OpenFreeMap style `https://tiles.openfreemap.org/styles/liberty`; put maps in client components, import CSS `maplibre-gl/dist/maplibre-gl.css`. Fence rendering helpers: `fenceGeometry()` in `src/lib/domain/geo.ts`.
- Storage: buckets `kyc-docs`, `selfies`, `patrol-photos`, `task-photos` are private; object paths start with `<agency_id>/`. Serve via signed URLs (`createSignedUrl`, 10 min) from a server action or route handler; log KYC doc access in `document_access_logs`.
- Time: agency timezone (`agency.timezone`, IST). Use helpers in `src/lib/domain/format.ts`.
- Tests: unit (vitest, `*.test.ts(x)` beside code or in `__tests__`), e2e (Playwright in `dashboard/e2e`, seeded data ids in `e2e/helpers.ts`, `admin()` client to simulate the guard app via RPCs). Every feature ships with both. E2E tests must reset any state they mutate (or use fresh rows) so the suite is re-runnable without `db reset`.
- Screenshots for visual review: `node scripts/shot.mjs /route ...` writes `/tmp/shot-<route>.png`.

## Git, CI & deployments
- Remote: `github.com/TCS-Security/guardforce` (private). `main` is integration — **never push straight to `main`; open a PR** per feature/fix (`<area>/<slug>` branch names). Multiple agents work here concurrently: never `git commit`/`git add -A` more than your own change; use `git commit --only <paths>` so in-flight staged work from other worktrees is not swept in.
- CI (`.github/workflows/ci.yml`): `lint`, `typecheck`, `vitest` on PRs that touch `dashboard/**` and on pushes to `main`. Run the same locally before opening a PR.
- Migrations (`.github/workflows/supabase-deploy.yml`): merges to `main` touching `supabase/migrations/**` deploy to the cloud Supabase project.
- Vercel import: repo `TCS-Security/guardforce`, root directory `dashboard`. Every PR gets a preview; `main` deploys production.
- Environments: local Supabase (per worktree) → **one cloud project (`guardforce-staging`)** — for now it backs both PR previews and the production deployment, so both Vercel env scopes (Preview/Production) use its keys. When a second (`guardforce-prod`) project exists, restore the two-project split (PR → staging, main → prod). Keys live in Vercel env and GitHub secrets/vars — never in the repo.

## Guard app conventions
- Package manager is bun; run Expo through it (`bun expo …`, `bun start`), never `bunx expo` (that fetches from the dead private registry). Native toolchain: `JAVA_HOME=~/.jdks/temurin-21`, `ANDROID_HOME=~/Android/Sdk` (platforms 35+36, NDK 27). `android/` inside `guard-app/` is generated by `expo prebuild` and gitignored; edit `app.json`/`app.config.ts` and `modules/`, not the generated tree. `expo prebuild` needs `--template /tmp/…/template.tgz` packed from `node_modules/expo-template-bare-minimum` because the registry override blocks npm.
- The app never writes to a table directly: every write is an RPC in `0011_guard_app.sql` or the shift RPCs, queued in the SQLite outbox (`src/data/db.ts`) and replayed in order by `src/data/sync.ts`. Add a guard action = one idempotent RPC + one `Kinds` entry + one `execute` branch in `sync.ts` + e2e coverage in `dashboard/e2e/guard-app.spec.ts`.
- Tracking lives in `guard-app/modules/guard-tracking` (Kotlin, foreground service). It buffers records natively and never holds auth; JS drains and syncs. Change it only for behaviour the service itself needs (cadence rules, warnings, boot restart); everything else is JS and ships OTA.
- Guards authenticate with phone + OTP (GoTrue SMS signups), then `claim_guard_account()` links the auth user to the `guards` row by phone and creates the guard-kind profile. Locally every seeded phone verifies with OTP `123456` (`[auth.sms.test_otp]`); the placeholder Twilio block in `config.toml` only exists because the CLI keeps phone sign-in off without a provider.
- ROLE-1 is enforced in RLS: read policies give site scope to `is_manager()` only; guards get their own rows. Keep that shape when adding tables.
- Pure logic goes in `src/domain/` with Jest tests; `geo.ts` must mirror `site_distance_m` / `is_in_fence`.
- Screens follow the dashboard: eyebrow (mono, uppercase) → display title (Bricolage) → body (Schibsted); tones from `src/ui/theme.ts` only; one `BigButton` per action screen; all copy through `useT()` with English and Hindi in `src/i18n/strings.ts`.
