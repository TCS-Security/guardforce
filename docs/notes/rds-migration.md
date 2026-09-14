# Note: moving from Supabase to Postgres on AWS RDS

Written 2026-09-14 while the dashboard was still on the local Supabase stack. Kept here so the
decision is not re-derived from scratch later.

## What ports unchanged

The schema, all functions and every RLS policy. RDS Postgres supports PostGIS, pgcrypto and
uuid-ossp, which are the only extensions in use. Business rules live in SQL, so they move as-is.

## What gets replaced

| Service | Code touched at the time of writing | Difficulty |
|---|---|---|
| Auth (GoTrue) | 1 foreign key to `auth.users`, ~24 `auth.uid()` call sites | Low, with the shim |
| Data API (PostgREST) | ~122 `.from()` and ~16 `.rpc()` calls | The real decision |
| Realtime | 3 browser files | Low |
| Storage | 6 call sites, 4 buckets | Low |

### The auth shim

Create an `auth` schema on RDS with one function, so no policy needs editing:

```sql
create schema if not exists auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
$$;
```

Then own the users table and issue JWTs from Cognito, Auth0 or a small service. Guards already
authenticate with phone + PIN against `guards.pin_hash`; GoTrue only ever served dashboard logins.

### The data API: two honest options

1. Self-host PostgREST on ECS Fargate in front of RDS. `supabase-js` keeps working; almost no
   application code changes. One extra container to operate.
2. Drop the client and query with `pg`/`postgres.js` (optionally Kysely). Data access already
   sits in `src/lib/data/*.ts` and server actions, but embedded selects like `guards(full_name)`
   become explicit joins. Budget two to three weeks.

With a direct driver, keep RLS: each request runs in a transaction that does
`set local role authenticated` and sets `request.jwt.claims`. About twenty lines in the client
factory, and far safer than re-implementing tenant scoping in TypeScript.

### Realtime and storage

Realtime: `LISTEN/NOTIFY` from a trigger on `guard_presence`/`events` feeding a server-sent-events
route, or polling. The live map already re-evaluates staleness on a timer.

Storage: S3 with presigned URLs and SSE-KMS. All signing already goes through a handful of server
actions; the agency-prefix rule moves into them. `document_access_logs` stays.

## Moving the data

`pg_dump` the public schema and restore. Preserve user UUIDs when mapping `auth.users` into the new
users table, or every `profiles` foreign key and audit row breaks.

## Infrastructure shape

RDS Multi-AZ in ap-south-1 (data-residency line in the PRD), S3 + KMS, the Next app on Fargate or
App Runner, Secrets Manager, point-in-time recovery.

## Forward-looking

Decide the API layer before the Android app is built, and have the app call a thin client you own
rather than `supabase-js` directly, so this migration stays a server-side concern and never needs a
Play Store release.
