-- =============================================================================
-- 0034  Trials that mean something
--
-- Signup previously hard-coded every new workspace to the 'starter' package,
-- status 'trialing', with no end date - so the trial never expired, the
-- operator's catalogue was ignored, and the package a visitor chose on the
-- pricing page was thrown away.
--
-- This makes the trial package an operator decision, gives the trial an end,
-- and records (without honouring) the package the visitor asked for.
--
-- Entitlement is deliberately NOT taken from the requested package: a client
-- that could name its own plan could grant itself the most expensive one for
-- free. The request is an intent that preselects checkout; the grant is
-- whatever the operator has designated as the trial package.
-- =============================================================================

-- --- plans: which package new signups trial ---------------------------------
alter table public.plans
  add column if not exists is_trial_default boolean not null default false;

comment on column public.plans.is_trial_default is
  'The package new signups are given for their trial. Exactly one package may hold this.';

-- At most one trial package, enforced by the database rather than by the UI.
create unique index if not exists plans_one_trial_default
  on public.plans ((true))
  where is_trial_default;

-- --- subscriptions: when the trial ends, and what the customer asked for -----
alter table public.subscriptions
  add column if not exists trial_ends_at timestamptz,
  add column if not exists intended_plan_key text;

comment on column public.subscriptions.trial_ends_at is
  'When a trialing subscription lapses. Null means no time-boxed trial. Distinct from current_period_end, which Stripe owns.';
comment on column public.subscriptions.intended_plan_key is
  'The package the customer chose before paying. Preselects checkout; grants nothing.';

-- Existing trials predate this column and would otherwise never lapse. Give
-- them the trial package's own length from today rather than expiring anyone
-- retroactively.
update public.subscriptions s
set trial_ends_at = now() + (
      coalesce((select p.trial_days from public.plans p where p.is_trial_default limit 1), 14)
      || ' days')::interval
where s.status = 'trialing'
  and s.trial_ends_at is null;

-- --- the trial package ------------------------------------------------------
-- The marketing copy promises the Growth plan, so that is the default. An
-- operator can move it in Admin > Packages without a code change.
update public.plans set is_trial_default = true
where key = 'growth'
  and not exists (select 1 from public.plans where is_trial_default);

-- Fall back to starter if this deployment has no growth package.
update public.plans set is_trial_default = true
where key = 'starter'
  and not exists (select 1 from public.plans where is_trial_default);

-- --- provisioning -----------------------------------------------------------
-- Old two-argument signature is replaced; drop it so no caller can reach the
-- version that hard-coded starter.
drop function if exists public.provision_workspace(text, text);

create or replace function public.provision_workspace(
  org_name text,
  workspace_name text,
  intended_plan text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_org uuid;
  new_ws  uuid;
  trial_key   text;
  trial_days  integer;
  trial_seats integer;
  wanted      text;
begin
  if uid is null then
    raise exception 'provision_workspace: no authenticated user';
  end if;

  -- The package the operator designates for trials, with its own length and
  -- seat allowance. Falls back to starter so provisioning can never fail for
  -- want of configuration.
  select p.key, p.trial_days, coalesce(p.seat_limit, 1)
    into trial_key, trial_days, trial_seats
  from public.plans p
  where p.is_trial_default
    and p.archived_at is null
  limit 1;

  if trial_key is null then
    select p.key, p.trial_days, coalesce(p.seat_limit, 1)
      into trial_key, trial_days, trial_seats
    from public.plans p
    where p.key = 'starter'
    limit 1;
  end if;

  trial_key   := coalesce(trial_key, 'starter');
  trial_days  := coalesce(trial_days, 14);
  trial_seats := coalesce(trial_seats, 1);

  -- Only a published, sellable package can be recorded as the intent; anything
  -- else is discarded rather than stored and shown back to the customer.
  select p.key into wanted
  from public.plans p
  where p.key = nullif(trim(coalesce(intended_plan, '')), '')
    and p.published
    and p.is_sellable
    and p.archived_at is null
  limit 1;

  insert into public.organisations (name)
  values (coalesce(nullif(trim(org_name), ''), 'My organisation'))
  returning id into new_org;

  insert into public.workspaces (organisation_id, name)
  values (new_org, coalesce(nullif(trim(workspace_name), ''), 'My workspace'))
  returning id into new_ws;

  insert into public.memberships (workspace_id, user_id, role)
  values (new_ws, uid, 'owner_admin');

  insert into public.business_profiles (workspace_id, business_name)
  values (new_ws, coalesce(nullif(trim(workspace_name), ''), ''));

  insert into public.workspace_settings (workspace_id)
  values (new_ws);

  insert into public.subscriptions (
    workspace_id, plan_key, status, seats_allowed, trial_ends_at, intended_plan_key
  )
  values (
    new_ws,
    trial_key,
    'trialing',
    trial_seats,
    case when trial_days > 0 then now() + (trial_days || ' days')::interval end,
    wanted
  );

  insert into public.audit_events (workspace_id, actor_id, action, entity_type, entity_id)
  values (new_ws, uid, 'created', 'workspace', new_ws);

  return new_ws;
end;
$$;

comment on function public.provision_workspace(text, text, text) is
  'Bootstraps a tenant for the current user on the operator-designated trial package. intended_plan records what the customer asked for and grants nothing.';
