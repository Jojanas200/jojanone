-- =============================================================================
-- 0004_growth_academy_intelligence.sql
-- Growth: investor readiness, data room, tender readiness, evidence library.
-- Academy: assignments, progress, quiz attempts, certificates (course_id refers
--          to the code catalogue in src/data/academy-catalog.ts for now;
--          a reference `courses`/`lessons` set can be added later).
-- Intelligence: activities, notifications, reports, conversations, messages,
--               jova_sources, decisions.
-- =============================================================================

-- Enums -----------------------------------------------------------------------
create type public.tender_status as enum
  ('identified','assessing','bid','no_bid','drafting','review','submitted','won','lost','archived');
create type public.activity_type as enum
  ('obligation','filing','review','policy','contract','risk','decision','report','system','training','meeting');
create type public.activity_status as enum
  ('open','in_progress','overdue','upcoming','completed','info');
create type public.report_type as enum
  ('executive_summary','business_confidence','compliance_overview','risk_summary',
   'monthly_activity','training_summary');
create type public.jova_sender as enum ('user','jova');

-- =============================================================================
-- GROWTH — Investor Ready
-- =============================================================================
create table public.investor_profiles (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  funding_stage    text not null default 'pre_seed',  -- pre_seed|seed|early_growth|series_a|growth
  amount_sought    bigint not null default 0,          -- minor units
  currency         text not null default 'GBP',
  funding_purpose  text,
  target_close_date date,
  current_revenue_band text,
  growth_summary   text,
  traction_summary text,
  market_summary   text,
  team_summary     text,
  investment_type  text not null default 'undecided',  -- equity|convertible|loan|grant|undecided
  status           text not null default 'preparing',  -- preparing|in_market|closed|on_hold
  created_by       uuid references auth.users(id),
  updated_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.investor_readiness_assessments (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  answers           jsonb not null default '{}',
  overall_score     int not null default 0,
  corporate_score   int not null default 0,
  financial_score   int not null default 0,
  legal_score       int not null default 0,
  compliance_score  int not null default 0,
  commercial_score  int not null default 0,
  people_score      int not null default 0,
  data_room_score   int not null default 0,
  gaps              text[] not null default '{}',
  red_flags         text[] not null default '{}',
  recommended_actions jsonb not null default '[]',
  status            text not null default 'draft',
  completed_at      timestamptz,
  review_date       date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.due_diligence_items (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  category         text not null,   -- corporate|financial|legal|compliance|commercial|people|data_room
  title            text not null,
  description      text,
  required         boolean not null default true,
  status           text not null default 'missing', -- missing|in_progress|ready|needs_review|not_applicable
  evidence_reference text,
  source_module    text,
  source_record_id uuid,
  owner            text,
  priority         public.priority_level not null default 'medium',
  review_date      date,
  notes            text,
  created_by       uuid references auth.users(id),
  updated_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index due_diligence_items_workspace_status_idx on public.due_diligence_items (workspace_id, status);

create table public.data_room_items (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  folder           text not null,
  title            text not null,
  document_type    text,
  version          text not null default '1.0',
  status           text not null default 'missing', -- missing|in_progress|ready|needs_review|archived
  file_name        text,
  source_module    text,
  source_record_id uuid,
  confidentiality  text not null default 'standard', -- standard|confidential|restricted
  review_date      date,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- =============================================================================
-- GROWTH — Tender Ready
-- =============================================================================
create table public.tender_opportunities (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces(id) on delete cascade,
  title                 text not null,
  authority             text,
  reference             text,
  sector                text,
  location              text,
  contract_value        bigint not null default 0,  -- minor units
  currency              text not null default 'GBP',
  publication_date      date,
  clarification_deadline date,
  submission_deadline   date,
  contract_start_date   date,
  contract_duration     text,
  procedure_type        text not null default 'open', -- open|restricted|framework|direct_award|quotation|other
  status                public.tender_status not null default 'identified',
  source                text,
  summary               text,
  eligibility_notes     text,
  owner                 text,
  created_by            uuid references auth.users(id),
  updated_by            uuid references auth.users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index tender_opportunities_workspace_status_idx on public.tender_opportunities (workspace_id, status);
create index tender_opportunities_workspace_deadline_idx on public.tender_opportunities (workspace_id, submission_deadline);

create table public.bid_assessments (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id      uuid references public.tender_opportunities(id) on delete cascade,
  strategic_fit_score int not null default 0,
  eligibility_score   int not null default 0,
  capacity_score      int not null default 0,
  evidence_score      int not null default 0,
  commercial_score    int not null default 0,
  delivery_risk_score int not null default 0,
  overall_score       int not null default 0,
  answers             jsonb not null default '{}',
  strengths           text[] not null default '{}',
  gaps                text[] not null default '{}',
  risks               text[] not null default '{}',
  recommendation      text not null default 'no_bid', -- bid|no_bid|conditional
  decision            text not null default 'pending',-- bid|no_bid|pending
  decision_reason     text,
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index bid_assessments_opportunity_idx on public.bid_assessments (opportunity_id);

create table public.tender_requirements (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id   uuid references public.tender_opportunities(id) on delete cascade,
  requirement_type text not null,  -- eligibility|pass_fail|technical|quality|commercial|social_value|legal|submission
  title            text not null,
  description      text,
  mandatory        boolean not null default false,
  weighting        int not null default 0,
  status           text not null default 'not_started', -- not_started|in_progress|evidence_missing|ready_for_review|complete|not_applicable
  owner            text,
  due_date         date,
  evidence_reference text,
  response_id      uuid,
  source_section   text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index tender_requirements_opportunity_idx on public.tender_requirements (opportunity_id);

create table public.tender_responses (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid references public.tender_opportunities(id) on delete cascade,
  requirement_id uuid references public.tender_requirements(id) on delete set null,
  section_title  text,
  question       text,
  word_limit     int not null default 0,
  response_text  text,
  status         text not null default 'draft',  -- draft|in_progress|ready_for_review|approved
  review_notes   text,
  version        int not null default 1,
  owner          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index tender_responses_opportunity_idx on public.tender_responses (opportunity_id);

-- Link requirement.response_id -> tender_responses now that it exists.
alter table public.tender_requirements
  add constraint tender_requirements_response_id_fkey
  foreign key (response_id) references public.tender_responses(id) on delete set null;

create table public.evidence_library_items (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  category         text not null,
  title            text not null,
  description      text,
  source_module    text,
  source_record_id uuid,
  status           text not null default 'current', -- current|expired|in_review|archived
  review_date      date,
  file_name        text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- =============================================================================
-- ACADEMY (learner records; course_id refers to the code catalogue)
-- =============================================================================
create table public.academy_assignments (
  id                      uuid primary key default gen_random_uuid(),
  workspace_id            uuid not null references public.workspaces(id) on delete cascade,
  learner_id              text not null,    -- 'owner' or an employees.id
  learner_name            text,
  course_id               text not null,
  assigned_by             text,
  due_date                date,
  status                  text not null default 'assigned', -- assigned|in_progress|completed|overdue
  required_by_company     boolean not null default false,
  legally_required        boolean not null default false,
  external_completion_note text,
  reason                  text,
  completed_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index academy_assignments_workspace_idx on public.academy_assignments (workspace_id, status);

create table public.academy_progress (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  learner_id        text not null,
  course_id         text not null,
  lessons_completed text[] not null default '{}',
  started_at        timestamptz not null default now(),
  last_activity_at  timestamptz not null default now(),
  completed_at      timestamptz,
  time_minutes      int not null default 0,
  updated_at        timestamptz not null default now()
);
create index academy_progress_learner_course_idx on public.academy_progress (workspace_id, learner_id, course_id);

create table public.academy_quiz_attempts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  learner_id   text not null,
  course_id    text not null,
  score        int not null default 0,
  passed       boolean not null default false,
  answers      jsonb not null default '{}',
  taken_at     timestamptz not null default now()
);

create table public.academy_certificates (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  reference        text not null,
  learner_id       text not null,
  learner_name     text,
  course_id        text not null,
  course_title     text,
  completed_at     timestamptz not null default now(),
  quiz_score       int not null default 0,
  duration_minutes int not null default 0,
  created_at       timestamptz not null default now()
);

-- =============================================================================
-- INTELLIGENCE
-- =============================================================================
create table public.activities (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  activity_type  public.activity_type not null,
  module         text not null,
  title          text not null,
  description    text,
  status         public.activity_status not null default 'open',
  priority       public.priority_level not null default 'none',
  reference_type text,
  reference_id   uuid,
  metadata       jsonb not null default '{}',
  due_at         timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index activities_workspace_status_due_idx on public.activities (workspace_id, status, due_at);

create table public.notifications (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  kind           text not null,   -- priority|report|insight|risk
  title          text not null,
  description    text,
  reference_type text,            -- activity|report|conversation
  reference_id   uuid,
  read           boolean not null default false,
  created_at     timestamptz not null default now()
);
create index notifications_workspace_read_idx on public.notifications (workspace_id, read, created_at desc);

create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  report_type      public.report_type not null,
  title            text not null,
  reporting_period text,
  status           text not null default 'draft',  -- draft|final
  summary          text,
  sections         jsonb not null default '[]',
  metrics          jsonb not null default '[]',
  findings         text[] not null default '{}',
  priority_actions text[] not null default '{}',
  source_modules   text[] not null default '{}',
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index reports_workspace_type_idx on public.reports (workspace_id, report_type);

create table public.decisions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title        text not null,
  reason       text,
  deadline     date,
  risk_level   public.risk_band not null default 'low',
  status       text not null default 'pending', -- pending|approved|deferred|reviewed
  module       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Jova conversations / messages / sources
create table public.conversations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title        text not null default 'New conversation',
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index conversations_workspace_idx on public.conversations (workspace_id, updated_at desc);

create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  sender           public.jova_sender not null,
  content          text not null,
  reference_type   text,
  reference_id     uuid,
  suggested_action jsonb,
  structured       jsonb,
  -- safety / provenance (docs §10):
  rules_version    text,
  ai_provider      text,   -- null (deterministic) | 'anthropic' | 'openrouter'
  model_version    text,   -- e.g. 'claude-opus-4-8' when a model was used
  safety_decision  text,   -- answered|clarify|escalate|refused
  user_feedback    text,
  created_at       timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.jova_sources (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  message_id       uuid not null references public.messages(id) on delete cascade,
  source_module    text not null,
  source_record_id uuid,
  note             text
);
create index jova_sources_message_idx on public.jova_sources (message_id);

-- =============================================================================
-- RLS + updated_at
-- =============================================================================
select public.apply_updated_at(t) from unnest(array[
  'investor_profiles','investor_readiness_assessments','due_diligence_items','data_room_items',
  'tender_opportunities','bid_assessments','tender_requirements','tender_responses','evidence_library_items',
  'academy_assignments','academy_progress',
  'activities','reports','decisions','conversations'
]) as t;
-- (academy_quiz_attempts, academy_certificates, notifications, messages, jova_sources are
--  append-only / have no updated_at column, so no trigger.)

select public.apply_tenant_rls(t) from unnest(array[
  'investor_profiles','investor_readiness_assessments','due_diligence_items','data_room_items',
  'tender_opportunities','bid_assessments','tender_requirements','tender_responses','evidence_library_items',
  'academy_assignments','academy_progress','academy_quiz_attempts','academy_certificates',
  'activities','notifications','reports','decisions','conversations','messages','jova_sources'
]) as t;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;
