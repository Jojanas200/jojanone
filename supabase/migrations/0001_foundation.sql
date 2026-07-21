-- =============================================================================
-- 0001_foundation.sql — Jojan One production foundation
-- Milestone 1: tenancy core, RLS helper functions, audit trail.
--
-- Design references: docs/05-Backend-Schema.md, docs/02-TRD.md.
-- Conventions: UUID PKs; workspace_id on all tenant rows; timestamptz UTC;
-- controlled enums; soft-delete via deleted_at; provenance columns.
-- RLS is the tenant-isolation backbone — every tenant table enables it and is
-- keyed on membership of the caller (auth.uid()).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;   -- gen_random_uuid()
create extension if not exists citext    with schema extensions;   -- case-insensitive email

-- -----------------------------------------------------------------------------
-- Shared trigger: maintain updated_at on every mutation.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- Identity & tenancy
-- =============================================================================

create table public.organisations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.workspaces (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  name             text not null,
  brand_color      text,                       -- user-selectable safe primary
  time_zone        text not null default 'Europe/London',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index workspaces_organisation_id_idx on public.workspaces (organisation_id);

-- Five roles (docs/01-PRD.md §4). Enforced server-side via RLS + helpers.
create type public.app_role as enum (
  'owner_admin', 'manager', 'team_member', 'adviser', 'read_only'
);

-- Links a Supabase auth user to a workspace with a role. Advisers may be
-- module-scoped and/or time-limited.
create table public.memberships (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            public.app_role not null default 'team_member',
  scoped_modules  text[],                       -- null = all permitted; else allow-list (advisers)
  expires_at      timestamptz,                  -- null = no expiry (time-limited advisers)
  invited_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_workspace_id_idx on public.memberships (workspace_id);

create table public.invitations (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  email         extensions.citext not null,
  role          public.app_role not null,
  token_hash    text not null,                  -- store the hash, never the raw token
  expires_at    timestamptz not null,
  accepted_at   timestamptz,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index invitations_workspace_id_idx on public.invitations (workspace_id);
create index invitations_email_idx on public.invitations (email);

-- =============================================================================
-- RLS helper functions (SECURITY DEFINER — bypass RLS on memberships to avoid
-- recursive policy evaluation; each reads the caller from auth.uid()).
-- =============================================================================

-- Workspaces the current user may access (honours adviser expiry).
create or replace function public.current_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id
  from public.memberships
  where user_id = auth.uid()
    and (expires_at is null or expires_at > now());
$$;

-- Organisations reachable via the caller's workspaces.
create or replace function public.current_organisation_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct w.organisation_id
  from public.workspaces w
  where w.id in (select public.current_workspace_ids());
$$;

-- The caller's role in a given workspace (null if not a member / expired).
create or replace function public.current_role_in(ws uuid)
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.memberships
  where user_id = auth.uid()
    and workspace_id = ws
    and (expires_at is null or expires_at > now())
  limit 1;
$$;

-- True if the caller holds one of `roles` in workspace `ws`.
create or replace function public.has_workspace_role(ws uuid, roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships
    where user_id = auth.uid()
      and workspace_id = ws
      and role = any(roles)
      and (expires_at is null or expires_at > now())
  );
$$;

-- Convenience: may the caller MUTATE tenant data in `ws`?
-- (owner_admin / manager / team_member — advisers & read_only excluded.)
create or replace function public.can_write_workspace(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_workspace_role(
    ws, array['owner_admin','manager','team_member']::public.app_role[]
  );
$$;

-- True if the caller is an owner_admin of any workspace in organisation `org`.
create or replace function public.is_org_admin(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.workspaces w on w.id = m.workspace_id
    where w.organisation_id = org
      and m.user_id = auth.uid()
      and m.role = 'owner_admin'
      and (m.expires_at is null or m.expires_at > now())
  );
$$;

-- =============================================================================
-- Audit trail (append-only). Written server-side with the service role.
-- =============================================================================
create table public.audit_events (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  actor_id      uuid references auth.users(id),
  action        text not null,   -- created|updated|completed|viewed|assigned|generated|exported|deleted
  entity_type   text not null,
  entity_id     uuid,
  metadata      jsonb not null default '{}',
  created_at    timestamptz not null default now()
);
create index audit_events_workspace_created_idx
  on public.audit_events (workspace_id, created_at desc);

-- =============================================================================
-- updated_at triggers
-- =============================================================================
create trigger set_updated_at before update on public.organisations
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.memberships
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.invitations
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row-Level Security
-- =============================================================================
alter table public.organisations enable row level security;
alter table public.workspaces    enable row level security;
alter table public.memberships   enable row level security;
alter table public.invitations   enable row level security;
alter table public.audit_events  enable row level security;

-- Organisations: visible to members; mutable only by an org owner_admin.
create policy organisations_select on public.organisations
  for select using (id in (select public.current_organisation_ids()));
create policy organisations_update on public.organisations
  for update using (public.is_org_admin(id)) with check (public.is_org_admin(id));

-- Workspaces: visible to members; created by an org admin; updated by its owner_admin.
create policy workspaces_select on public.workspaces
  for select using (id in (select public.current_workspace_ids()));
create policy workspaces_insert on public.workspaces
  for insert with check (public.is_org_admin(organisation_id));
create policy workspaces_update on public.workspaces
  for update
  using (public.has_workspace_role(id, array['owner_admin']::public.app_role[]))
  with check (public.has_workspace_role(id, array['owner_admin']::public.app_role[]));

-- Memberships: a member sees their workspace's memberships; only an owner_admin
-- manages them. (First membership at signup is created with the service role.)
create policy memberships_select on public.memberships
  for select using (workspace_id in (select public.current_workspace_ids()));
create policy memberships_write on public.memberships
  for all
  using (public.has_workspace_role(workspace_id, array['owner_admin']::public.app_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner_admin']::public.app_role[]));

-- Invitations: managed by an owner_admin of the workspace. (Acceptance runs
-- server-side with the service role, which bypasses RLS.)
create policy invitations_all on public.invitations
  for all
  using (public.has_workspace_role(workspace_id, array['owner_admin']::public.app_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner_admin']::public.app_role[]));

-- Audit: readable by admins/managers; never mutated by end users (service role writes).
create policy audit_events_select on public.audit_events
  for select using (
    public.has_workspace_role(workspace_id, array['owner_admin','manager']::public.app_role[])
  );

-- =============================================================================
-- Grants — RLS gates the rows; roles still need table privileges.
--   authenticated: DML (constrained by RLS)   |   service_role: full (bypasses RLS)
-- =============================================================================
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;
grant execute on all functions in schema public to authenticated, service_role;
