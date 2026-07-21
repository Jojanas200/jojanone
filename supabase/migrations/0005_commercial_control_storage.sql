-- =============================================================================
-- 0005_commercial_control_storage.sql
-- Commercial: plans (reference), subscriptions, entitlements, usage_counters,
--             billing_events.
-- Control:    files, deletion_requests, integration_connections, webhook_events,
--             companies_house_cache.
-- Settings:   workspace_settings.
-- Storage:    private 'evidence' bucket + object-level RLS.
--
-- Billing/settings tables use role-specific RLS (owner_admin), so they are NOT
-- created via apply_tenant_rls. Never paywall safety/export/escalation.
-- =============================================================================

-- =============================================================================
-- COMMERCIAL
-- =============================================================================

-- Global plan catalogue (reference content; readable by anyone, admin-managed).
create table public.plans (
  key             text primary key,   -- starter|growth|professional|enterprise
  name            text not null,
  price_minor     bigint,             -- null for 'custom' (enterprise)
  currency        text not null default 'GBP',
  seat_limit      int,                -- 1, 5, 20, null
  is_sellable     boolean not null default false,
  stripe_price_id text,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);
alter table public.plans enable row level security;
create policy plans_select on public.plans
  for select to anon, authenticated using (true);
-- writes: service role only (no write policy → RLS denies authenticated writes)

-- One canonical subscription per workspace (single source of truth).
create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null unique references public.workspaces(id) on delete cascade,
  plan_key               text not null references public.plans(key),
  status                 text not null default 'trialing', -- trialing|active|past_due|canceled|...
  seats_allowed          int not null default 1,
  stripe_customer_id     text,
  stripe_subscription_id text,
  current_period_end     timestamptz,
  cancel_at              timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy subscriptions_select on public.subscriptions
  for select using (workspace_id in (select public.current_workspace_ids()));
create policy subscriptions_write on public.subscriptions
  for all
  using (public.has_workspace_role(workspace_id, array['owner_admin']::public.app_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner_admin']::public.app_role[]));

-- Per-feature entitlements (driven by verified webhooks; service role writes).
create table public.entitlements (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  feature_key  text not null,
  allowed      boolean not null default false,
  limit_value  int,
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, feature_key)
);
alter table public.entitlements enable row level security;
create policy entitlements_select on public.entitlements
  for select using (workspace_id in (select public.current_workspace_ids()));
-- writes: service role only

create table public.usage_counters (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  metric       text not null,
  value        bigint not null default 0,
  period       text,
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, metric)
);
alter table public.usage_counters enable row level security;
create policy usage_counters_select on public.usage_counters
  for select using (workspace_id in (select public.current_workspace_ids()));
-- writes: service role only

-- Append-only ledger of verified Stripe events (idempotency key).
create table public.billing_events (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid references public.workspaces(id) on delete set null,
  stripe_event_id text not null unique,
  type            text not null,
  payload         jsonb not null,
  processed_at    timestamptz not null default now()
);
alter table public.billing_events enable row level security;
create policy billing_events_select on public.billing_events
  for select using (
    workspace_id in (select public.current_workspace_ids())
    and public.has_workspace_role(workspace_id, array['owner_admin']::public.app_role[])
  );
-- writes: service role only

-- =============================================================================
-- CONTROL
-- =============================================================================

create table public.files (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces(id) on delete cascade,
  bucket                text not null default 'evidence',
  object_key            text not null,   -- workspace_id/module/record_id/filename
  original_name         text not null,
  mime_type             text not null,
  size_bytes            bigint not null,
  checksum              text,
  classification        text not null default 'standard', -- standard|confidential|restricted
  scan_status           text not null default 'pending',  -- pending|clean|infected
  owner_module          text,
  owner_record_id       uuid,
  retention_review_date date,
  uploaded_by           uuid references auth.users(id),
  created_at            timestamptz not null default now(),
  deleted_at            timestamptz
);
create index files_workspace_owner_idx on public.files (workspace_id, owner_module, owner_record_id);

create table public.deletion_requests (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  entity_type   text not null,
  entity_id     uuid,
  kind          text not null,   -- soft_delete|retention|legal_hold|irreversible
  reason        text,
  requested_by  uuid references auth.users(id),
  scheduled_for timestamptz,
  executed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index deletion_requests_workspace_idx on public.deletion_requests (workspace_id);

create table public.integration_connections (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  provider      text not null,   -- companies_house|stripe|email|ai
  status        text not null default 'disconnected',
  config        jsonb not null default '{}',  -- non-secret config; secrets live in server env/Vault
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index integration_connections_workspace_provider_idx
  on public.integration_connections (workspace_id, provider);

-- Global, service-role-only idempotency ledger for inbound provider webhooks.
create table public.webhook_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  external_id  text not null,
  payload      jsonb not null,
  processed_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (provider, external_id)
);
alter table public.webhook_events enable row level security;
-- no policies → authenticated denied; service role bypasses.

-- Companies House read-only cache (fetched server-side; labelled with fetched_at).
create table public.companies_house_cache (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  company_number text not null,
  resource       text not null,   -- profile|officers|filing_history
  data           jsonb not null,
  fetched_at     timestamptz not null default now(),
  unique (workspace_id, company_number, resource)
);
alter table public.companies_house_cache enable row level security;
create policy companies_house_cache_select on public.companies_house_cache
  for select using (workspace_id in (select public.current_workspace_ids()));
-- writes: service role only (fetch/refresh job)

-- =============================================================================
-- SETTINGS (one row per workspace; admin-managed)
-- =============================================================================
create table public.workspace_settings (
  workspace_id  uuid primary key references public.workspaces(id) on delete cascade,
  notifications jsonb not null default '{}',
  display       jsonb not null default '{}',
  jova          jsonb not null default '{}',
  branding      jsonb not null default '{}',
  regional      jsonb not null default '{}',
  operations    jsonb not null default '{}',
  report_defaults      jsonb not null default '{}',
  document_defaults    jsonb not null default '{}',
  certificate_defaults jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.workspace_settings enable row level security;
create policy workspace_settings_select on public.workspace_settings
  for select using (workspace_id in (select public.current_workspace_ids()));
create policy workspace_settings_write on public.workspace_settings
  for all
  using (public.has_workspace_role(workspace_id, array['owner_admin']::public.app_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner_admin']::public.app_role[]));

-- files, deletion_requests, integration_connections use the standard tenant pattern.
select public.apply_updated_at(t) from unnest(array[
  'subscriptions','integration_connections','workspace_settings'
]) as t;
select public.apply_tenant_rls(t) from unnest(array[
  'files','deletion_requests','integration_connections'
]) as t;

-- =============================================================================
-- STORAGE — private 'evidence' bucket + object RLS (path = workspace_id/...)
--
-- storage.buckets / storage.objects are owned by supabase_storage_admin. Under
-- `supabase db push` (privileged) these run directly; applied by a plain
-- `postgres` role they raise insufficient_privilege — so both the bucket and the
-- policies are wrapped in guarded blocks that WARN and continue. If skipped,
-- create the private 'evidence' bucket + these policies via the dashboard.
-- (Downloads use short-lived signed URLs minted server-side; the policies are
--  the backstop that mirrors table RLS on the workspace_id path prefix.)
-- =============================================================================
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'evidence', 'evidence', false, 52428800,
    array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'image/png','image/jpeg','image/webp'
    ]
  )
  on conflict (id) do nothing;
exception
  when insufficient_privilege then
    raise warning 'Skipped storage bucket insert (needs privilege). Create the private "evidence" bucket via the dashboard or `supabase db push`.';
end $$;

do $$
begin
  execute $p$
    create policy "evidence read (own workspace)" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'evidence'
        and ((storage.foldername(name))[1])::uuid in (select public.current_workspace_ids())
      )
  $p$;
  execute $p$
    create policy "evidence write (writer roles)" on storage.objects
      for all to authenticated
      using (
        bucket_id = 'evidence'
        and public.can_write_workspace(((storage.foldername(name))[1])::uuid)
      )
      with check (
        bucket_id = 'evidence'
        and public.can_write_workspace(((storage.foldername(name))[1])::uuid)
      )
  $p$;
exception
  when insufficient_privilege then
    raise warning 'Skipped storage.objects policies (needs table owner). Apply via `supabase db push` or the dashboard.';
  when duplicate_object then
    null;
end $$;

-- =============================================================================
-- Grants
-- =============================================================================
grant select on public.plans to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;
