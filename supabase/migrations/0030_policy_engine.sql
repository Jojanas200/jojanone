-- Policy generation engine: Jova's recommendations live BESIDE the document
-- (never inside adopted wording), and adoption is a recorded event.
alter table public.policies
  add column if not exists jova_recommendations text[] not null default '{}',
  add column if not exists adopted_at timestamptz;
