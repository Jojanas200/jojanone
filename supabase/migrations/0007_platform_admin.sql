-- 0007_platform_admin.sql
-- Platform-operator (Jojan One management) controls:
--   * workspaces.suspended_at  - a suspended workspace is blocked from the app.
--   * platform_audit_log        - every privileged operator action is recorded.
-- Both are written only via the service role (adminDb) behind the
-- PLATFORM_ADMIN_EMAILS allowlist. RLS denies all tenant access to the audit log.

alter table public.workspaces
  add column if not exists suspended_at timestamptz;

create table if not exists public.platform_audit_log (
  id                  uuid primary key default gen_random_uuid(),
  actor_id            uuid,
  actor_email         text not null,
  action              text not null,        -- e.g. suspend / unsuspend / impersonate.start
  target_workspace_id uuid,
  target_user_id      uuid,
  detail              jsonb not null default '{}',
  created_at          timestamptz not null default now()
);

create index if not exists platform_audit_log_created_idx
  on public.platform_audit_log (created_at desc);

-- Tenants must never see the platform audit log. RLS on with NO policies means
-- authenticated/anon are denied entirely; the service role (adminDb) bypasses RLS.
alter table public.platform_audit_log enable row level security;
