# 05 — Backend Schema (Supabase Postgres)

**Product:** Jojan One · **Companion docs:** [TRD](./02-TRD.md), [Schema source types](../src/data/types.ts)

This schema maps the prototype's [`CoreDataState`](../src/data/types.ts) onto a
tenant-isolated Postgres database on Supabase. The prototype's TypeScript interfaces already
mirror the intended tables (they carry `business_id`, `created_at`, enums, FK-style IDs), so
migration is largely a lift.

> **Conventions** (applied to every table): UUID PKs (`gen_random_uuid()`);
> `workspace_id uuid not null` on all tenant data; `created_at`/`updated_at timestamptz`;
> `created_by`/`updated_by uuid`; money as `currency text` + `amount_minor bigint`; dates as
> ISO `timestamptz` (UTC), statutory date-only fields as `date`; statuses as Postgres enums;
> soft-delete via `deleted_at`; provenance via `source`, `source_reference`.

---

## 1. Tenancy & identity core

```sql
-- Organisations own one or more workspaces (tenants).
create table organisations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table workspaces (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  name             text not null,
  brand_color      text,                    -- user-selectable safe primary
  time_zone        text not null default 'Europe/London',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create type app_role as enum ('owner_admin','manager','team_member','adviser','read_only');

-- auth.users is provided by Supabase Auth. Membership links a user to a workspace + role.
create table memberships (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          app_role not null default 'team_member',
  -- Adviser scoping:
  scoped_modules text[] ,                   -- null = all permitted; else allow-list
  expires_at    timestamptz,               -- null = no expiry (time-limited advisers)
  invited_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table invitations (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  email         text not null,
  role          app_role not null,
  token_hash    text not null,
  expires_at    timestamptz not null,
  accepted_at   timestamptz,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);
```

### Helper functions (used by RLS)

```sql
-- Workspaces the current user may access (honours adviser expiry).
create or replace function current_workspace_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select workspace_id from memberships
  where user_id = auth.uid()
    and (expires_at is null or expires_at > now());
$$;

-- Role of the current user in a given workspace.
create or replace function current_role_in(ws uuid)
returns app_role language sql stable security definer set search_path = public as $$
  select role from memberships
  where user_id = auth.uid() and workspace_id = ws
    and (expires_at is null or expires_at > now())
  limit 1;
$$;
```

## 2. The RLS pattern (applied to every tenant-owned table)

Enable RLS and add policies keyed on `workspace_id`. This is the isolation guarantee — it
holds across REST, RPC, Realtime, and (mirrored) Storage.

```sql
alter table contracts enable row level security;

-- READ: any member of the workspace (advisers additionally constrained by scoped_modules
-- via a per-module predicate or a wrapping view).
create policy contracts_select on contracts
  for select using (workspace_id in (select current_workspace_ids()));

-- WRITE: members whose role may mutate. Read-only + expired advisers excluded.
create policy contracts_write on contracts
  for all
  using (
    workspace_id in (select current_workspace_ids())
    and current_role_in(workspace_id) in ('owner_admin','manager','team_member')
  )
  with check (
    workspace_id in (select current_workspace_ids())
    and current_role_in(workspace_id) in ('owner_admin','manager','team_member')
  );
```

- **Billing/user-admin tables** additionally require `current_role_in(workspace_id) =
  'owner_admin'`.
- **Adviser scoping** (`scoped_modules`, `expires_at`) is enforced in policy predicates, not
  the UI.
- **The API queries as the user** — each Next.js Route Handler builds a Supabase client from
  the caller's session (`@supabase/ssr`), so `auth.uid()` is populated and these policies run
  in Postgres on every query. The service-role key (which bypasses RLS) is used only
  server-side for webhooks, admin jobs, and scheduled/queued work; it is **never** exposed to
  the client. (The same pattern holds if the API is later moved to a standalone Express
  service.)

## 3. Table inventory (by entity group, per handover §7)

Every table below is tenant-owned (`workspace_id`), RLS-enabled, and follows the
conventions. Names map directly to the prototype's types.

| Group | Tables |
|-------|--------|
| **Identity** | `organisations`, `workspaces`, `memberships`, `invitations`, (Supabase `auth.users`) |
| **Business profile** | `business_profiles`, `business_entities`, `contracts`, `employees`, `hr_actions`, `scenario_runs` |
| **Assurance** | `compliance_obligations`, `compliance_evidence`, `gdpr_assessments`, `processing_activities`, `data_requests`, `data_breaches`, `dpias`, `privacy_notices`, `governance_records`, `policies`, `risks` |
| **Growth** | `investor_profiles`, `investor_readiness_assessments`, `due_diligence_items`, `data_room_items`, `tender_opportunities`, `bid_assessments`, `tender_requirements`, `tender_responses`, `evidence_library_items` |
| **Learning** | `courses`, `course_versions`, `lessons`, `quiz_questions`, `academy_assignments`, `academy_progress`, `academy_quiz_attempts`, `academy_certificates` |
| **Intelligence** | `activities`, `notifications`, `reports`, `report_snapshots`, `conversations`, `messages`, `jova_sources` |
| **Commercial** | `plans`, `subscriptions`, `entitlements`, `usage_counters`, `billing_events` |
| **Control** | `audit_events`, `files`, `export_jobs`, `deletion_requests`, `integration_connections`, `webhook_events` |

> Note on scope: `courses`, `course_versions`, `lessons`, `quiz_questions`, and `plans` are
> **reference/catalogue** content — global (not tenant-owned) but versioned; learner records
> (`academy_*`) and subscriptions are tenant-owned.

## 4. Representative table definitions

These illustrate the mapping; the remaining tables follow identically from `types.ts`.

```sql
-- ---- Contracts (from Contract) -------------------------------------------
create type contract_status as enum
  ('active','draft','expired','archived','pending_signature');
create type contract_type as enum
  ('customer','supplier','employment','contractor','software','office','dpa','insurance','nda','other');
create type risk_band as enum ('low','medium','high');

create table contracts (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  contract_type     contract_type not null,
  title             text not null,
  counterparty      text not null,
  status            contract_status not null default 'draft',
  currency          text not null default 'GBP',
  value_minor       bigint not null default 0,        -- integer minor units
  start_date        date,
  end_date          date,
  renewal_date      date,
  notice_period_days int,
  owner             text,
  risk_level        risk_band not null default 'low',
  key_terms         text,
  obligations       text,
  next_action       text,
  next_action_date  date,
  notes             text,
  entity_id         uuid references business_entities(id) on delete set null,
  source            text,
  source_reference  text,
  created_by        uuid references auth.users(id),
  updated_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index on contracts (workspace_id, status);
create index on contracts (workspace_id, renewal_date);
```

```sql
-- ---- Compliance obligations (from ComplianceObligation) ------------------
create type obligation_status as enum
  ('action_required','in_progress','completed','overdue','upcoming','not_applicable');
create type applicability as enum ('applicable','not_applicable','unclear');

create table compliance_obligations (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  title             text not null,
  category          text not null,                    -- companies_house, tax, vat, ...
  regulator         text,
  jurisdiction      text,
  description       text,
  plain_language_explanation text,
  reason_applies    text,
  applicability_status applicability not null default 'applicable',
  priority          text not null default 'medium',
  status            obligation_status not null default 'upcoming',
  due_date          date,
  recurrence        text not null default 'none',
  source_type       text,
  source_reference  text,
  required_action   text,
  required_evidence text[],
  evidence_status   text not null default 'not_started',
  owner             text,
  professional_support_required boolean not null default false,
  completed_at      timestamptz,
  next_due_date     date,
  notes             text,
  na_reason         text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index on compliance_obligations (workspace_id, status, due_date);
```

```sql
-- ---- Risks (from Risk) — cross-links to many modules ---------------------
create table risks (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspaces(id) on delete cascade,
  risk_title         text not null,
  risk_category      text not null,
  description        text,
  cause              text,
  consequence        text,
  likelihood         int check (likelihood between 1 and 5),
  impact             int check (impact between 1 and 5),
  inherent_score     int,
  inherent_rating    text,
  controls           text,
  control_effectiveness text,
  residual_likelihood int,
  residual_impact    int,
  residual_score     int,
  residual_rating    text,
  risk_owner         text,
  response           text,
  mitigation_actions jsonb not null default '[]',
  status             text not null default 'open',
  review_date        date,
  linked_contract_id            uuid references contracts(id) on delete set null,
  linked_entity_id              uuid references business_entities(id) on delete set null,
  linked_employee_id            uuid references employees(id) on delete set null,
  linked_obligation_id          uuid references compliance_obligations(id) on delete set null,
  linked_processing_activity_id uuid references processing_activities(id) on delete set null,
  linked_governance_record_id   uuid references governance_records(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);
```

```sql
-- ---- Jova (from JovaConversation / JovaMessage) --------------------------
create table conversations (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  title         text not null,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create type jova_sender as enum ('user','jova');

create table messages (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  conversation_id  uuid not null references conversations(id) on delete cascade,
  sender           jova_sender not null,
  content          text not null,
  reference_type   text,
  reference_id     uuid,
  suggested_action jsonb,
  structured       jsonb,
  -- safety / provenance metadata (handover §10):
  rules_version    text,
  ai_provider      text,               -- null (deterministic) | 'anthropic' | 'openrouter'
  model_version    text,               -- e.g. 'claude-opus-4-8' when a model was used
  safety_decision  text,               -- e.g. 'answered','clarify','escalate','refused'
  user_feedback    text,
  created_at       timestamptz not null default now()
);

-- Source records a Jova reply drew from (for citation + access-isolation audits).
create table jova_sources (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  message_id    uuid not null references messages(id) on delete cascade,
  source_module text not null,
  source_record_id uuid,
  note          text
);
```

## 5. Commercial (billing) tables

```sql
-- Global plan catalogue (reference content).
create table plans (
  key           text primary key,          -- 'starter','growth','professional','enterprise'
  name          text not null,
  price_minor   bigint,                     -- null for 'custom'
  currency      text not null default 'GBP',
  seat_limit    int,                        -- 1, 5, 20, null
  is_sellable   boolean not null default false,   -- starter/growth = true at launch
  stripe_price_id text,
  created_at    timestamptz not null default now()
);

-- One canonical subscription per workspace (single source of truth).
create table subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null unique references workspaces(id) on delete cascade,
  plan_key              text not null references plans(key),
  status                text not null,      -- trialing, active, past_due, canceled, ...
  seats_allowed         int not null,
  stripe_customer_id    text,
  stripe_subscription_id text,
  current_period_end    timestamptz,
  cancel_at             timestamptz,
  updated_at            timestamptz not null default now()
);

create table entitlements (
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  feature_key   text not null,
  allowed       boolean not null default false,
  limit_value   int,
  primary key (workspace_id, feature_key)
);

-- Append-only ledger of verified Stripe events (idempotency key = stripe event id).
create table billing_events (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid references workspaces(id) on delete set null,
  stripe_event_id text not null unique,
  type           text not null,
  payload        jsonb not null,
  processed_at   timestamptz not null default now()
);
```

**Rules enforced server-side (webhook handler, service role):**
- Plan changes are **idempotent** on `stripe_event_id`; `billing_events` de-dupes replays.
- `subscriptions` is the single record driving plan cards, usage warnings, seat checks.
- Safety notices, exports, and professional-support escalation are **never** gated by
  `entitlements`.

## 6. Files & evidence

```sql
create type file_classification as enum ('standard','confidential','restricted');

create table files (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  bucket          text not null default 'evidence',
  object_key      text not null,             -- workspace_id/module/record_id/filename
  original_name   text not null,
  mime_type       text not null,
  size_bytes      bigint not null,
  checksum        text not null,
  classification  file_classification not null default 'standard',
  scan_status     text not null default 'pending',   -- pending | clean | infected
  -- polymorphic link to the owning record:
  owner_module    text,
  owner_record_id uuid,
  retention_review_date date,
  uploaded_by     uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index on files (workspace_id, owner_module, owner_record_id);
```

- **Private buckets only**; downloads via short-lived signed URLs.
- Upload flow: validate MIME/size → store → checksum → **virus scan hook** → mark
  `scan_status='clean'` before the file is served.
- Storage RLS mirrors table RLS: the object path prefix (`workspace_id/…`) must match a
  workspace the caller belongs to.
- `restricted`/`confidential` files are access-limited independently of module access
  (special-category data).

## 7. Control & provenance

```sql
-- Append-only audit trail for important mutations.
create table audit_events (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  actor_id      uuid references auth.users(id),
  action        text not null,              -- created | updated | completed | viewed | assigned | generated | exported | deleted
  entity_type   text not null,
  entity_id     uuid,
  metadata      jsonb not null default '{}',
  created_at    timestamptz not null default now()
);
create index on audit_events (workspace_id, created_at desc);

create table deletion_requests (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  entity_type   text not null,
  entity_id     uuid,
  kind          text not null,              -- soft_delete | retention | legal_hold | irreversible
  reason        text,
  requested_by  uuid references auth.users(id),
  scheduled_for timestamptz,
  executed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create table integration_connections (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  provider      text not null,              -- companies_house | stripe | email | ai
  status        text not null,
  config        jsonb not null default '{}',-- non-secret config; secrets live in Vault
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table webhook_events (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null,
  external_id   text not null,
  payload       jsonb not null,
  processed_at  timestamptz,
  unique (provider, external_id)            -- idempotency
);
```

**Audit is written server-side** (trigger or explicit in the mutation path) so it can't be
bypassed by the client. Soft-delete, retention, legal hold, and irreversible deletion are
modelled as distinct `deletion_requests.kind` values.

## 8. Companies House caching

Cached lookups stored against the workspace with provenance, honestly labelled in the UI:

```sql
create table companies_house_cache (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  company_number text not null,
  resource      text not null,              -- profile | officers | filing_history
  data          jsonb not null,
  fetched_at    timestamptz not null default now(),
  unique (workspace_id, company_number, resource)
);
```

## 9. Indexing, integrity & migration notes

- Index every `(workspace_id, status)` and `(workspace_id, due/renewal/review_date)` pair
  that drives a register or reminder job.
- Foreign keys use `on delete set null` for cross-module links (a deleted contract shouldn't
  cascade-delete a risk) and `on delete cascade` for true parent/child (workspace → all
  tenant rows).
- `updated_at` maintained by a shared `set_updated_at()` trigger.
- **Migrations** live in `supabase/migrations`, applied via CI to staging → production.
- **Prototype migration:** import the seed's reference content (Academy catalogue, obligation
  templates, plan catalogue) as first-class rows; treat per-business demo records as
  demonstration-only unless a specific dataset is confirmed for carry-over. Produce a
  reconciliation report + rollback plan.

## 10. Tenant-isolation test matrix (launch gate)

Prove, for a user in workspace A, that workspace B data is unreachable via **every** path:

| Vector | Test |
|--------|------|
| REST select/insert/update/delete | Denied by RLS on all tenant tables |
| RPC / RPC-wrapped views | Denied |
| Realtime subscriptions | No B rows delivered |
| Storage download | Signed URL for B object refused; path-prefix policy blocks it |
| Global search | No B results |
| Report/export jobs | B data never included |
| Jova retrieval | Only A records retrieved/cited |
