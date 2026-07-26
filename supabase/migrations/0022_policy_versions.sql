-- =============================================================================
-- 0022_policy_versions.sql — immutable policy version history
-- A snapshot of a policy's content + metadata captured each time it is published
-- (draft/archived -> active), so there is an audit-ready record of what was in
-- force and when. Rows are never updated (no updated_at trigger). Tenant-scoped
-- via the shared apply_tenant_rls helper.
-- =============================================================================
create table public.policy_versions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  policy_id    uuid not null references public.policies(id) on delete cascade,
  version      text not null,
  status       text not null,
  policy_name  text not null,
  content      text,
  notes        text,
  created_by   uuid,
  created_at   timestamptz not null default now()
);
create index policy_versions_policy_idx
  on public.policy_versions (policy_id, created_at desc);
select public.apply_tenant_rls('policy_versions');
