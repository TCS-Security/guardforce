# GuardForce

Guard management platform for Indian security agencies — a Next.js control-room dashboard and an Expo (React Native) guard app, both on one Supabase schema.

- Spec: [`prd-v2-guard-platform.md`](prd-v2-guard-platform.md)
- Conventions for contributors and agents: [`CLAUDE.md`](CLAUDE.md)
- Dashboard: [`dashboard/`](dashboard) · Guard app: [`guard-app/`](guard-app) · Database: [`supabase/`](supabase)

## Quick start

```sh
brew install supabase/tap/supabase
supabase start                 # local Postgres, Auth, Storage, Realtime
cd dashboard && bun install
cp .env.example .env.local
bun run dev
```

Sign in at http://localhost:3000 as `owner@sentinel.test` / `guardforce`. Two supervisors
(`priya@`, `arun@`) show the site-scoped view, and `platform@guardforce.test` opens the
provider console at `/platform`.

## What is built

| Surface | Covers |
|---|---|
| Overview | Live staffing per site, 14-day attendance trend, unacknowledged alerts |
| Sites | Map-based perimeter editor (radius or drawn polygon) with a leeway buffer, shift types, supervisors |
| Guards | Roster, KYC vault with typed document slots, invites, shareable public profile links |
| Roster | Week grid, one-off and weekly assignment, blocked while a guard's KYC is incomplete |
| Attendance | Day view and per-shift replay: selfies, fence state, breadcrumb map, away time, exception and audited correction |
| Live map | Every fence plus on-duty guards, updated over realtime |
| Events | Filterable feed with acknowledgement and CSV export |
| Patrols | Compliance board, routes, per-round trail and photo proof |
| Tasks | Assignment, photo evidence, day report and CSV |
| Leave | Approval inbox, calendar, balances |
| Reports | Attendance analytics, guard scorecards, five CSV exports, daily digest preview |
| Settings | Agency defaults, team access, roles, notifications, guard-app remote config, audit log |
| Platform console | Provider-side: onboard tenants, plans and seat caps, suspend and restore, owner password resets |
| Guard app (Android) | Phone OTP + PIN, selfie and geofenced check-in/out, foreground tracking with location-off enforcement, patrols with photo proof, tasks, leave, offline outbox, Hindi and English |

## Multi-tenancy

Two layers. **Platform**: we are the provider; platform admins manage tenants (agencies)
through `/platform` and never see a tenant dashboard as a member. A suspended tenant's
members are locked out at the database, not just the UI. **Tenant**: access is role × scope.
Roles are sets of permissions from a fixed catalogue (four built in per tenant, Owner
immutable, custom roles editable in a matrix); scope is "every site" or a list of sites.
Every write policy in Postgres checks the same permission keys the UI does.

## Tests

```sh
cd dashboard
bun run typecheck && bun run lint
bun run test        # unit
bun run test:e2e    # Playwright, against the local stack
```

End-to-end tests drive the same SQL functions the Android app calls; `e2e/guard-app.spec.ts` signs in
as a guard with phone + OTP and runs the whole contract (claim → PIN → check-in → pings → patrol →
task → leave → check-out) under the guard's own row-level security.
