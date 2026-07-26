-- Per-opportunity submission checklist, embedded as jsonb
-- [{id, label, mandatory, done}] on the opportunity row so the existing RLS
-- policies on tender_opportunities cover it with no new table.
alter table public.tender_opportunities
  add column if not exists checklist jsonb not null default '[]'::jsonb;
