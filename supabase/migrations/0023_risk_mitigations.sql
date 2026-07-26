-- Mitigation/treatment actions recorded against each risk. Stored as an
-- embedded jsonb array [{id, label, dueDate, completedAt}] on the risk row so
-- the existing RLS policies on public.risks cover them with no new table.
alter table public.risks
  add column if not exists mitigations jsonb not null default '[]'::jsonb;
