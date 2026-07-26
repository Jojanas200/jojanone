-- Per-user notification + Jova preferences. Read by the reminder digest
-- sender (daily/weekly/off) and the Jova ask pipeline (concise/detailed), so
-- the settings UI controls real behaviour. user_preferences already has
-- self-access RLS.
alter table public.user_preferences
  add column if not exists digest_frequency text not null default 'daily',
  add column if not exists jova_style text not null default 'concise';
