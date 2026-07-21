-- Per-user UI preferences (currently the selected theme). Keyed by auth user id
-- so it follows the user across devices/browsers. RLS: a user reads/writes only
-- their own row.
create table if not exists public.user_preferences (
  user_id uuid primary key,
  theme text not null default 'default',
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists user_preferences_rw on public.user_preferences;
create policy user_preferences_rw on public.user_preferences
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
