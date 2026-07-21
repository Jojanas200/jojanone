-- Internal operator notes on a tenant (support CRM). Written/read only via the
-- platform-admin surface (service role). RLS enabled with NO policies so a
-- tenant can never see notes about them.
create table if not exists public.tenant_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  author_email text,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists tenant_notes_ws_idx
  on public.tenant_notes (workspace_id, created_at desc);

alter table public.tenant_notes enable row level security;
