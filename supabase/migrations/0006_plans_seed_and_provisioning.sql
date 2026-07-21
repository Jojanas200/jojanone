-- =============================================================================
-- 0006_plans_seed_and_provisioning.sql
-- Reference content that must exist in EVERY environment (so it lives in a
-- migration, not the dev-only seed): the plan catalogue, plus an atomic
-- workspace-provisioning function used at signup.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Plan catalogue (docs/01-PRD.md §8). Prices in integer minor units (GBP).
-- Starter & Growth are sellable at launch; Professional/Enterprise are visible
-- roadmap only (is_sellable = false) — never charge until deliverable.
-- -----------------------------------------------------------------------------
insert into public.plans (key, name, price_minor, currency, seat_limit, is_sellable, sort_order) values
  ('starter',      'Starter',        3900, 'GBP',    1, true,  1),
  ('growth',       'Growth',         9900, 'GBP',    5, true,  2),
  ('professional', 'Professional',  24900, 'GBP',   20, false, 3),
  ('enterprise',   'Enterprise',     null, 'GBP', null, false, 4)
on conflict (key) do update set
  name        = excluded.name,
  price_minor = excluded.price_minor,
  seat_limit  = excluded.seat_limit,
  is_sellable = excluded.is_sellable,
  sort_order  = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- provision_workspace(org_name, workspace_name)
-- Atomically bootstraps a new tenant for the CURRENT user:
--   organisation → workspace → owner_admin membership → business_profile
--   → workspace_settings → trialing Starter subscription.
-- SECURITY DEFINER so it can seed rows despite RLS, but it only ever acts for
-- auth.uid(); called once from the onboarding flow. Returns the workspace id.
-- -----------------------------------------------------------------------------
create or replace function public.provision_workspace(
  org_name text,
  workspace_name text
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
begin
  if uid is null then
    raise exception 'provision_workspace: no authenticated user';
  end if;

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

  insert into public.subscriptions (workspace_id, plan_key, status, seats_allowed)
  values (new_ws, 'starter', 'trialing', 1);

  insert into public.audit_events (workspace_id, actor_id, action, entity_type, entity_id)
  values (new_ws, uid, 'created', 'workspace', new_ws);

  return new_ws;
end;
$$;

revoke all on function public.provision_workspace(text, text) from public;
grant execute on function public.provision_workspace(text, text) to authenticated;
