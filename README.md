# GuardForce

Guard management platform for Indian security agencies — a Next.js control-room dashboard on Supabase, with an Android guard app to follow.

- Spec: [`prd-v2-guard-platform.md`](prd-v2-guard-platform.md)
- Conventions for contributors and agents: [`CLAUDE.md`](CLAUDE.md)
- Dashboard: [`dashboard/`](dashboard) · Database: [`supabase/`](supabase)

## Quick start

```sh
brew install supabase/tap/supabase
supabase start                 # local Postgres, Auth, Storage, Realtime
cd dashboard && bun install
cp .env.example .env.local
bun run dev
```

Sign in at http://localhost:3000 as `owner@sentinel.test` / `guardforce`. Two supervisors
(`priya@`, `arun@`) show the site-scoped view.

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
| Settings | Agency defaults, team access, notifications, guard-app remote config, audit log |

## Tests

```sh
cd dashboard
bun run typecheck && bun run lint
bun run test        # unit
bun run test:e2e    # Playwright, against the local stack
```

End-to-end tests drive the same SQL functions the Android app will call, so the money path
(check-in → tracking → location off → void → exception) is covered before the app exists.
