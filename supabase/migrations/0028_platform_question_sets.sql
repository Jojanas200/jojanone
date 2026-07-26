-- Platform-managed questionnaire overrides. Code ships the default question
-- sets (GDPR health check, tender bid checklist, academy quizzes); a platform
-- admin can override a set here and the assessment engines read the override.
-- RLS enabled with NO policies: service-role access only, like
-- platform_settings - tenants never touch this table directly.
create table if not exists public.platform_question_sets (
  id text primary key,
  questions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by_email text
);
alter table public.platform_question_sets enable row level security;
