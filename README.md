# GuardForce

Guard management platform for Indian security agencies — a Next.js control-room dashboard on Supabase, plus an Android guard app.

- Spec: [`prd-v2-guard-platform.md`](prd-v2-guard-platform.md)
- Conventions for contributors and agents: [`CLAUDE.md`](CLAUDE.md)
- Dashboard: [`dashboard/`](dashboard) · Database: [`supabase/`](supabase)

## Quick start
```sh
brew install supabase/tap/supabase
supabase start          # local Postgres/Auth/Storage/Realtime
cd dashboard && bun install && cp .env.example .env.local && bun run dev
```
Sign in at http://localhost:3000 with `owner@sentinel.test` / `guardforce`.
