-- =============================================================================
-- 0016_onboarding_responses.sql — conditional onboarding answers
-- One row per workspace holding the answer blob keyed by stable field id (see
-- src/shared/onboarding/schema.ts). Save-and-continue merges into `answers`;
-- `completed_at` is stamped when the initially-required set is satisfied.
-- Secrets (auth password, card details) are never written here — the service
-- strips them before persisting. Standard tenant RLS.
-- =============================================================================
create table public.onboarding_responses (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null unique references public.workspaces(id) on delete cascade,
  answers       jsonb not null default '{}'::jsonb,
  completed_at  timestamptz,
  updated_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

select public.apply_tenant_rls('onboarding_responses');
select public.apply_updated_at('onboarding_responses');
