-- =============================================================================
-- 0015_policy_acknowledgements.sql — per-employee policy sign-off
-- One row per (policy, employee). The policy-level policies.acknowledgement_status
-- rollup (not_started|partial|complete) is recomputed by the service from these
-- rows. Standard tenant RLS: any member reads; writer roles mutate.
-- =============================================================================
create table public.policy_acknowledgements (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  policy_id       uuid not null references public.policies(id) on delete cascade,
  employee_id     uuid not null references public.employees(id) on delete cascade,
  status          text not null default 'pending',   -- pending|acknowledged|waived
  acknowledged_at timestamptz,
  policy_version  text,                               -- version snapshot at sign-off
  notes           text,
  created_by      uuid references auth.users(id),
  updated_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (policy_id, employee_id)
);

create index policy_ack_ws_policy_idx
  on public.policy_acknowledgements (workspace_id, policy_id);
create index policy_ack_employee_idx
  on public.policy_acknowledgements (employee_id);

select public.apply_tenant_rls('policy_acknowledgements');
select public.apply_updated_at('policy_acknowledgements');
