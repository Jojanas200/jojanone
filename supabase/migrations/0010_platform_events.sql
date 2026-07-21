-- Product event stream for cross-tenant usage analytics (DAU/WAU/MAU, usage
-- over time, top actions). Written by the app via a service, read only by the
-- platform admin. RLS enabled with NO policies so tenants can never read it.
-- user_id / workspace_id are plain uuids (no FK) so events survive deletes and
-- can capture pre-workspace signals (e.g. login) with nulls.
create table if not exists public.platform_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  user_id uuid,
  name text not null,
  module text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists platform_events_created_at_idx
  on public.platform_events (created_at desc);
create index if not exists platform_events_name_idx
  on public.platform_events (name);
create index if not exists platform_events_workspace_idx
  on public.platform_events (workspace_id);
create index if not exists platform_events_user_idx
  on public.platform_events (user_id);

alter table public.platform_events enable row level security;
