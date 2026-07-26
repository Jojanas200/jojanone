-- =============================================================================
-- 0019_score_history.sql — Business Confidence Score history
-- One row per workspace per day, so the dashboard/executive pages can show a
-- REAL day-over-day delta (no fabricated numbers). Recorded best-effort on page
-- load (first writer visit of the day); RLS: any member reads, writer roles
-- write.
-- =============================================================================
create table public.score_history (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  score         integer not null,
  status_label  text not null,
  recorded_on   date not null default current_date,
  created_at    timestamptz not null default now(),
  unique (workspace_id, recorded_on)
);

create index score_history_ws_idx
  on public.score_history (workspace_id, recorded_on desc);

select public.apply_tenant_rls('score_history');
