# ADR-0001 — Data access (Drizzle) & scheduling (Edge Functions)

**Status:** Accepted · **Date:** 2026-07-17 · **Supersedes:** the "supabase-js data
layer" and "Vercel Cron + QStash" notes in earlier drafts of
[00-Stack-Decision.md](./00-Stack-Decision.md) and [02-TRD.md](./02-TRD.md).

## Context

Jojan One is multi-tenant; **RLS in Postgres is the isolation guarantee**
([05-Backend-Schema.md](./05-Backend-Schema.md)). The API tier is TypeScript
(Next.js Route Handlers). We need a database client, a scheduler for background work,
and a migration story — without weakening RLS.

## Decision

1. **Drizzle ORM is the database client** for the TypeScript API (query builder + types).
2. **RLS is preserved by connecting *as the user* per request.** Drizzle talks to Postgres
   directly (not via PostgREST), so it does not automatically run as the caller. We
   replicate what PostgREST does: within one transaction, set `request.jwt.claims` and
   `set local role authenticated`, so `auth.uid()` = the caller and every policy applies.
   This is the `withUser()` helper in [`src/server/db/rls.ts`](../src/server/db/rls.ts).
   - `withUser(claims, fn)` → **all user-request-path queries** (RLS enforced).
   - `adminDb` ([`src/server/db/admin.ts`](../src/server/db/admin.ts)) → **trusted server
     work only** (webhooks, cron jobs, admin): RLS bypassed.
   - **Rule:** never use `adminDb` to serve a user request. A lint/test should guard that
     tenant queries only run inside `withUser()`.
3. **SQL migrations remain the source of truth** (`supabase/migrations`). They carry RLS
   policies, functions, triggers and storage — which Drizzle's schema DSL cannot express.
   Drizzle is used as a **query builder only**: run `drizzle-kit pull` to (re)generate
   `src/server/db/schema.ts` from the database. We do **not** run `drizzle-kit
   generate/migrate/push` — two migration tools is a footgun.
4. **Scheduled work uses Supabase Edge Functions + `pg_cron`** (reminders, digests,
   Companies House refresh) instead of Vercel Cron + a queue.
   - Edge Functions are **Deno**, so they can't import the Node/Drizzle code. For jobs that
     reuse business logic, `pg_cron` calls a **protected internal Route Handler** (all Node +
     Drizzle logic lives there, once). For simple DB-only jobs, do the work in the Edge
     Function with the **service role**.

## Consequences

- **Positive:** typed, ergonomic queries; one place for business logic; RLS still enforced in
  the database; a clean `adminDb` boundary for trusted jobs; no duplicate migration tooling.
- **Costs / risks:**
  - Drizzle fails *open* on RLS if a query runs outside `withUser()` — mitigated by the
    boundary (`adminDb` is the only escape hatch) plus a guard test.
  - Behind the Supabase **transaction pooler** (6543), Drizzle must set `prepare: false`
    (handled in [`client.ts`](../src/server/db/client.ts)).
  - `adminDb` relies on the connection role bypassing RLS (table owner / `service_role`);
    do **not** `alter table … force row level security` without revisiting this.
  - Edge Functions can't share Node code — accepted; use the "cron → Route Handler" pattern
    for logic-heavy jobs.

## Alternatives considered

- **supabase-js (PostgREST) as the primary client** — RLS-as-user is automatic, but the team
  prefers Drizzle's typed query ergonomics. Still fine for simple cases; not the default.
- **Prisma** — weaker RLS-with-direct-connection story than Drizzle; heavier.
- **Vercel Cron + Upstash QStash** — works, but the team prefers keeping scheduling inside
  Supabase (Edge Functions + `pg_cron`).
