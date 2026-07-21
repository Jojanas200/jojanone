-- Platform settings: a single row of cross-tenant configuration owned by the
-- Jojan One management (platform admins). Read/written only via the service role
-- behind the PLATFORM_ADMIN_EMAILS allowlist. RLS is enabled with NO policies so
-- tenants can never see or change it.
create table if not exists public.platform_settings (
  id text primary key default 'singleton' check (id = 'singleton'),
  ai_provider text not null default 'anthropic',      -- anthropic | openrouter | deterministic
  ai_model text,                                       -- null = provider default
  signups_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  updated_by_email text
);

alter table public.platform_settings enable row level security;

-- Seed the singleton row.
insert into public.platform_settings (id) values ('singleton')
on conflict (id) do nothing;
