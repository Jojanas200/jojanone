-- Extend platform settings with a tenant-facing announcement banner and a
-- feature-flag map (e.g. globally disabling a module). Managed by operators.
alter table public.platform_settings
  add column if not exists announcement text,
  add column if not exists announcement_level text not null default 'info',
  add column if not exists feature_flags jsonb not null default '{}';
