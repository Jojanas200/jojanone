# Jojan One — Supabase (data foundation)

This is the **Milestone 1** data layer from [docs/06-Implementation-Plan.md](../docs/06-Implementation-Plan.md):
Postgres schema, **RLS tenant isolation**, helper functions, audit trail, storage
bucket, plan catalogue, and a workspace-provisioning RPC. It maps
[docs/05-Backend-Schema.md](../docs/05-Backend-Schema.md) and the prototype's
[`src/data/types.ts`](../src/data/types.ts).

## Prerequisites

- **Docker Desktop** (for local Supabase).
- **Supabase CLI** — https://supabase.com/docs/guides/cli
  (`scoop install supabase` / `npm i -g supabase` / `brew install supabase/tap/supabase`).

## Run locally

```bash
npm run db:start     # supabase start  (first run pulls images)
npm run db:reset     # apply all migrations + seed into a fresh local DB
npm run db:types     # generate typed client into src/lib/database.types.ts
```

Studio: http://127.0.0.1:54323 · API: http://127.0.0.1:54321 · Inbucket (emails): http://127.0.0.1:54324

## Migrations

| File | Contents |
|------|----------|
| `0001_foundation.sql` | Extensions, `set_updated_at`, tenancy core (organisations, workspaces, memberships, invitations), **RLS helper functions**, `audit_events`, RLS on tenancy tables |
| `0002_business.sql` | `apply_tenant_rls` / `apply_updated_at` helpers, shared enums, Business module (profiles, entities, contracts, employees, hr_actions, scenario_runs) |
| `0003_compliance_governance.sql` | Compliance obligations + evidence, GDPR (assessments, ROPA, DSARs, breaches, DPIAs, privacy notices), governance, policies, risks |
| `0004_growth_academy_intelligence.sql` | Investor/tender readiness, evidence library, Academy learner records, activities, notifications, reports, decisions, Jova conversations/messages/sources |
| `0005_commercial_control_storage.sql` | Plans, subscriptions, entitlements, usage, billing_events; files, deletion_requests, integrations, webhook_events, CH cache; workspace_settings; **`evidence` storage bucket + object RLS** |
| `0006_plans_seed_and_provisioning.sql` | Plan catalogue rows (Starter/Growth sellable; Pro/Enterprise roadmap) + `provision_workspace()` RPC |

Reference content (plans) is in a migration so it exists in every environment.
`seed.sql` is **dev-only** (applied by `db reset`, not `db push`).

## The tenant-isolation model (the non-negotiable)

Every tenant table carries `workspace_id` and enables **RLS**. Policies are keyed on
membership of the caller via SECURITY DEFINER helpers:

- `current_workspace_ids()` / `current_organisation_ids()` — what the caller can see
- `current_role_in(ws)` / `has_workspace_role(ws, roles[])` — role checks
- `can_write_workspace(ws)` — true for `owner_admin | manager | team_member`
- `is_org_admin(org)` — org-level admin

Standard pattern (applied by `apply_tenant_rls`): **any member reads; writer roles
mutate.** Billing/settings tables tighten writes to `owner_admin`. Reference tables
(`plans`) are read-only to clients. Global ledgers (`webhook_events`) are service-role
only. Storage objects mirror table RLS on the `workspace_id/...` path prefix.

The API tier (Next.js Route Handlers) queries **as the user** via Drizzle's `withUser()`
wrapper — see [`src/server/db`](../src/server/db) and
[docs/ADR-0001-data-access.md](../docs/ADR-0001-data-access.md) — so these policies run in
Postgres on every query. `adminDb` (service role, RLS bypassed) is used only server-side for
webhooks, admin jobs, and scheduled Edge Functions.

## Provisioning a workspace

At signup the app calls the RPC once (it acts only for `auth.uid()`):

```ts
const { data: workspaceId } = await supabase.rpc('provision_workspace', {
  org_name: 'Acme Ltd',
  workspace_name: 'Acme Ltd',
});
// → creates org + workspace + owner_admin membership + profile + settings + trial subscription
```

## Deploy to a hosted project

```bash
supabase login
supabase link --project-ref <your-project-ref>   # create the project in the LONDON (eu-west-2) region
supabase db push                                  # applies migrations (no seed)
```

## Verifying tenant isolation (launch gate)

After `db reset`, provision two workspaces under two users and confirm user A cannot
read or write any of user B's rows via REST, RPC, Realtime, Storage, search, export, or
Jova. This suite is a Milestone-1 exit criterion — see
[docs/05-Backend-Schema.md](../docs/05-Backend-Schema.md) §10.

> **Note:** these migrations were authored against the schema/TRD docs and reviewed, but
> have not yet been executed here (no local Docker/CLI in the authoring environment).
> Run `npm run db:reset` to apply them and surface any environment-specific tweaks.
