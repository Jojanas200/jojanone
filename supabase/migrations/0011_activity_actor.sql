-- Per-user actor stamping on the activity feed: which user performed the action.
-- Populated automatically by recordActivity() from the RLS JWT claims, so no
-- caller changes are needed. NULL for service-role / system-written rows.
alter table public.activities
  add column if not exists actor_user_id uuid;

create index if not exists activities_actor_idx
  on public.activities (actor_user_id);
