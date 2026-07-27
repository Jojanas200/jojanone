-- Controlled web search for Jova (flag-gated, off by default).
-- Citations can now carry a URL so web sources show publisher/link/date.
alter table public.jova_sources
  add column if not exists url text;

-- Audit log of searches: redacted query + result domains only - no personal
-- data. Service-role only (RLS enabled, no policies).
create table if not exists public.jova_web_searches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  redacted_query text not null,
  provider text not null,
  result_count integer not null default 0,
  result_domains text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.jova_web_searches enable row level security;
