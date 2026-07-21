-- =============================================================================
-- 0002_business.sql — Business module
-- Tables: business_profiles, business_entities, contracts, employees,
--         hr_actions, scenario_runs.  (maps src/data/types.ts)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Reusable helpers to keep module migrations DRY and consistent.
--   apply_tenant_rls(tbl)  -> enable RLS + standard select/write policies
--   apply_updated_at(tbl)  -> attach the updated_at trigger
-- Standard policy: any workspace member may read; only writer roles
-- (owner_admin/manager/team_member) may mutate — enforced in Postgres.
-- -----------------------------------------------------------------------------
create or replace function public.apply_tenant_rls(tbl text)
returns void
language plpgsql
as $$
begin
  execute format('alter table public.%I enable row level security;', tbl);
  execute format($f$
    create policy %1$s_select on public.%1$I
      for select using (workspace_id in (select public.current_workspace_ids()));
  $f$, tbl);
  execute format($f$
    create policy %1$s_write on public.%1$I
      for all
      using (public.can_write_workspace(workspace_id))
      with check (public.can_write_workspace(workspace_id));
  $f$, tbl);
end;
$$;

create or replace function public.apply_updated_at(tbl text)
returns void
language plpgsql
as $$
begin
  execute format(
    'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at();', tbl);
end;
$$;

-- -----------------------------------------------------------------------------
-- Shared enums (reused across modules).
-- -----------------------------------------------------------------------------
create type public.risk_band      as enum ('low', 'medium', 'high');
create type public.priority_level as enum ('high', 'medium', 'low', 'none');

-- -----------------------------------------------------------------------------
-- Business enums.
-- -----------------------------------------------------------------------------
create type public.entity_type as enum
  ('customer','supplier','employee','contractor','adviser','regulator','partner','insurer','bank');
create type public.entity_status as enum
  ('active','review_due','at_risk','archived','missing_info');
create type public.contract_status as enum
  ('active','draft','expired','archived','pending_signature');
create type public.contract_type as enum
  ('customer','supplier','employment','contractor','software','office','dpa','insurance','nda','other');
create type public.employment_type as enum ('employee','contractor','consultant','intern');
create type public.employment_status as enum ('active','probation','notice','archived');
create type public.hr_action_type as enum
  ('right_to_work','probation_review','contract_issue','training','policy_ack',
   'performance_review','return_to_work','welfare','document_renewal');
create type public.scenario_type as enum
  ('hire_employee','engage_contractor','new_customer','new_supplier','launch_website',
   'expand_market','raise_investment','prepare_tender','introduce_ai','new_personal_data');

-- =============================================================================
-- business_profiles (one per workspace)
-- =============================================================================
create table public.business_profiles (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null unique references public.workspaces(id) on delete cascade,
  business_name         text not null default '',
  company_number        text,
  business_type         text,
  industry              text,
  incorporation_date    date,
  registered_address    text,
  trading_address       text,
  financial_year_end    text,
  employee_count        int not null default 0,
  contractor_count      int not null default 0,
  customer_count        int not null default 0,
  supplier_count        int not null default 0,
  annual_revenue_band   text,
  vat_registered        boolean not null default false,
  employer_registered   boolean not null default false,
  processes_personal_data boolean not null default false,
  trades_internationally  boolean not null default false,
  profile_completion    int not null default 0,
  created_by            uuid references auth.users(id),
  updated_by            uuid references auth.users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- =============================================================================
-- business_entities (contract_id FK added after contracts exists)
-- =============================================================================
create table public.business_entities (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  entity_type   public.entity_type not null,
  name          text not null,
  relationship  text,
  status        public.entity_status not null default 'active',
  importance    public.priority_level not null default 'medium',
  risk_level    public.risk_band not null default 'low',
  contract_id   uuid,
  contact_name  text,
  email         extensions.citext,
  start_date    date,
  review_date   date,
  notes         text,
  created_by    uuid references auth.users(id),
  updated_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index business_entities_workspace_type_idx on public.business_entities (workspace_id, entity_type);
create index business_entities_workspace_status_idx on public.business_entities (workspace_id, status);

-- =============================================================================
-- contracts
-- =============================================================================
create table public.contracts (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces(id) on delete cascade,
  contract_type      public.contract_type not null,
  title              text not null,
  counterparty       text not null default '',
  status             public.contract_status not null default 'draft',
  currency           text not null default 'GBP',
  value_minor        bigint not null default 0,          -- integer minor units
  start_date         date,
  end_date           date,
  renewal_date       date,
  notice_period_days int,
  owner              text,
  risk_level         public.risk_band not null default 'low',
  key_terms          text,
  obligations        text,
  next_action        text,
  next_action_date   date,
  notes              text,
  entity_id          uuid references public.business_entities(id) on delete set null,
  source             text,
  source_reference   text,
  created_by         uuid references auth.users(id),
  updated_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);
create index contracts_workspace_status_idx on public.contracts (workspace_id, status);
create index contracts_workspace_renewal_idx on public.contracts (workspace_id, renewal_date);
create index contracts_entity_id_idx on public.contracts (entity_id);

-- Complete the entity <-> contract link now that both tables exist.
alter table public.business_entities
  add constraint business_entities_contract_id_fkey
  foreign key (contract_id) references public.contracts(id) on delete set null;

-- =============================================================================
-- employees
-- =============================================================================
create table public.employees (
  id                            uuid primary key default gen_random_uuid(),
  workspace_id                  uuid not null references public.workspaces(id) on delete cascade,
  full_name                     text not null,
  job_title                     text,
  department                    text,
  employment_type               public.employment_type not null default 'employee',
  employment_status             public.employment_status not null default 'active',
  start_date                    date,
  probation_end_date            date,
  contract_status               text not null default 'missing',   -- signed|pending|missing
  right_to_work_status          text not null default 'outstanding',-- verified|outstanding|expired|not_required
  right_to_work_expiry          date,
  policy_acknowledgement_status text not null default 'outstanding',-- complete|outstanding
  training_status               text not null default 'outstanding',-- complete|outstanding|overdue
  emergency_contact_recorded    boolean not null default false,
  next_review_date              date,
  risk_level                    public.risk_band not null default 'low',
  notes                         text,
  created_by                    uuid references auth.users(id),
  updated_by                    uuid references auth.users(id),
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  deleted_at                    timestamptz
);
create index employees_workspace_status_idx on public.employees (workspace_id, employment_status);

-- =============================================================================
-- hr_actions
-- =============================================================================
create table public.hr_actions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  employee_id   uuid references public.employees(id) on delete cascade,
  action_type   public.hr_action_type not null,
  title         text not null,
  description   text,
  priority      public.priority_level not null default 'medium',
  status        text not null default 'open',            -- open|completed|deferred
  due_date      date,
  completed_at  timestamptz,
  notes         text,
  created_by    uuid references auth.users(id),
  updated_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index hr_actions_workspace_status_idx on public.hr_actions (workspace_id, status);
create index hr_actions_employee_id_idx on public.hr_actions (employee_id);

-- =============================================================================
-- scenario_runs (Simulator)
-- =============================================================================
create table public.scenario_runs (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  scenario_type  public.scenario_type not null,
  scenario_name  text not null,
  answers        jsonb not null default '{}',
  result         jsonb not null default '{}',   -- ScenarioResult
  status         text not null default 'draft',  -- draft|saved|archived
  created_by     uuid references auth.users(id),
  updated_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index scenario_runs_workspace_idx on public.scenario_runs (workspace_id);

-- =============================================================================
-- RLS + updated_at for every table in this migration
-- =============================================================================
select public.apply_updated_at(t) from unnest(array[
  'business_profiles','business_entities','contracts','employees','hr_actions','scenario_runs'
]) as t;

select public.apply_tenant_rls(t) from unnest(array[
  'business_profiles','business_entities','contracts','employees','hr_actions','scenario_runs'
]) as t;

-- Grants (RLS gates rows).
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;
grant execute on all functions in schema public to authenticated, service_role;
