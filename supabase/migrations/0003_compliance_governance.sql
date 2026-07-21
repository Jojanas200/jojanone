-- =============================================================================
-- 0003_compliance_governance.sql — Compliance & Governance module
-- Tables: compliance_obligations, compliance_evidence, gdpr_assessments,
--         processing_activities, data_requests, data_breaches, dpias,
--         privacy_notices, governance_records, policies, risks.
-- =============================================================================

-- Enums -----------------------------------------------------------------------
create type public.obligation_category as enum
  ('companies_house','tax','vat','payroll','pensions','insurance','employment',
   'data_protection','health_safety','insurance_business','governance','other');
create type public.applicability as enum ('applicable','not_applicable','unclear');
create type public.obligation_status as enum
  ('action_required','in_progress','completed','overdue','upcoming','not_applicable');
create type public.data_request_type as enum
  ('subject_access','rectification','erasure','restriction','objection','portability');
create type public.governance_record_type as enum
  ('board_meeting','written_resolution','director_decision','shareholder_decision',
   'meeting_minutes','governance_review');
create type public.risk_category as enum
  ('compliance','contracts','data_protection','cyber','people','financial',
   'operational','supplier','strategic');
create type public.risk_response as enum ('avoid','reduce','transfer','accept','monitor');
create type public.risk_rating as enum ('low','medium','high','critical');

-- =============================================================================
-- compliance_obligations
-- =============================================================================
create table public.compliance_obligations (
  id                            uuid primary key default gen_random_uuid(),
  workspace_id                  uuid not null references public.workspaces(id) on delete cascade,
  title                         text not null,
  category                      public.obligation_category not null default 'other',
  regulator                     text,
  jurisdiction                  text,
  description                   text,
  plain_language_explanation    text,
  reason_applies                text,
  applicability_status          public.applicability not null default 'applicable',
  priority                      public.priority_level not null default 'medium',
  status                        public.obligation_status not null default 'upcoming',
  due_date                      date,
  recurrence                    text not null default 'none',   -- none|annual|quarterly|monthly|weekly
  source_type                   text,
  source_reference              text,
  required_action               text,
  required_evidence             text[] not null default '{}',
  evidence_status               text not null default 'not_started', -- not_started|in_progress|complete
  owner                         text,
  professional_support_required boolean not null default false,
  completed_at                  timestamptz,
  next_due_date                 date,
  notes                         text,
  na_reason                     text,
  created_by                    uuid references auth.users(id),
  updated_by                    uuid references auth.users(id),
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  deleted_at                    timestamptz
);
create index compliance_obligations_workspace_status_due_idx
  on public.compliance_obligations (workspace_id, status, due_date);

-- =============================================================================
-- compliance_evidence
-- =============================================================================
create table public.compliance_evidence (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  obligation_id uuid references public.compliance_obligations(id) on delete cascade,
  evidence_type text,
  title         text not null,
  description   text,
  file_name     text,
  reference     text,
  review_date   date,
  status        text not null default 'recorded',  -- recorded|expired|pending
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index compliance_evidence_obligation_idx on public.compliance_evidence (obligation_id);

-- =============================================================================
-- gdpr_assessments
-- =============================================================================
create table public.gdpr_assessments (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  assessment_type text not null default 'health_check',
  answers       jsonb not null default '{}',
  score         int not null default 0,
  status        text not null default 'draft',      -- draft|completed
  gaps          text[] not null default '{}',
  recommendations jsonb not null default '[]',
  completed_at  timestamptz,
  review_date   date,
  created_by    uuid references auth.users(id),
  updated_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- =============================================================================
-- processing_activities (ROPA)
-- =============================================================================
create table public.processing_activities (
  id                        uuid primary key default gen_random_uuid(),
  workspace_id              uuid not null references public.workspaces(id) on delete cascade,
  activity_name             text not null,
  business_purpose          text,
  data_subjects             text,
  personal_data_categories  text,
  special_category_data     boolean not null default false,
  lawful_basis              text,
  recipients                text,
  processors                text,
  international_transfers    boolean not null default false,
  retention_period          text,
  security_measures         text,
  owner                     text,
  status                    text not null default 'active',  -- active|archived
  review_date               date,
  created_by                uuid references auth.users(id),
  updated_by                uuid references auth.users(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- =============================================================================
-- data_requests (DSARs)
-- =============================================================================
create table public.data_requests (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces(id) on delete cascade,
  request_type       public.data_request_type not null,
  requester_reference text,
  received_date      date not null,
  identity_verified  boolean not null default false,
  due_date           date not null,
  status             text not null default 'open',   -- open|in_progress|completed|closed
  assigned_owner     text,
  notes              text,
  completed_at       timestamptz,
  created_by         uuid references auth.users(id),
  updated_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index data_requests_workspace_status_idx on public.data_requests (workspace_id, status);

-- =============================================================================
-- data_breaches
-- =============================================================================
create table public.data_breaches (
  id                             uuid primary key default gen_random_uuid(),
  workspace_id                   uuid not null references public.workspaces(id) on delete cascade,
  title                          text not null,
  discovered_at                  timestamptz not null default now(),
  occurred_at                    timestamptz,
  description                    text,
  data_involved                  text,
  affected_people_estimate       int not null default 0,
  risk_level                     public.risk_band not null default 'low',
  containment_actions            text,
  ico_notification_assessment    text,
  individual_notification_assessment text,
  status                         text not null default 'open',   -- open|contained|closed
  owner                          text,
  professional_support_required  boolean not null default false,
  closed_at                      timestamptz,
  created_by                     uuid references auth.users(id),
  updated_by                     uuid references auth.users(id),
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now()
);

-- =============================================================================
-- dpias
-- =============================================================================
create table public.dpias (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces(id) on delete cascade,
  title              text not null,
  project            text,
  processing_summary text,
  necessity          text,
  risks              text,
  controls           text,
  residual_risk      public.risk_band not null default 'low',
  status             text not null default 'draft',   -- draft|approved|review_due
  owner              text,
  review_date        date,
  created_by         uuid references auth.users(id),
  updated_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- =============================================================================
-- privacy_notices
-- =============================================================================
create table public.privacy_notices (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null references public.workspaces(id) on delete cascade,
  version                text not null default '1.0',
  status                 text not null default 'draft',   -- draft|published
  organisation           text,
  contact_details        text,
  data_collected         text,
  purposes               text,
  lawful_bases           text[] not null default '{}',
  sharing                text,
  international_transfers text,
  retention              text,
  rights                 text,
  complaints             text,
  review_date            date,
  created_by             uuid references auth.users(id),
  updated_by             uuid references auth.users(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- =============================================================================
-- governance_records
-- =============================================================================
create table public.governance_records (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces(id) on delete cascade,
  record_type        public.governance_record_type not null,
  title              text not null,
  description        text,
  meeting_date       date,
  decision_date      date,
  owner              text,
  status             text not null default 'draft',  -- draft|pending|approved|deferred|rejected|completed
  review_date        date,
  approval_status    text not null default 'unapproved', -- unapproved|approved
  participants       text,
  actions            text,
  linked_document    text,
  notes              text,
  background         text,
  options_considered text,
  risks_considered   text,
  decision           text,
  decision_maker     text,
  created_by         uuid references auth.users(id),
  updated_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index governance_records_workspace_status_idx on public.governance_records (workspace_id, status);

-- =============================================================================
-- policies
-- =============================================================================
create table public.policies (
  id                      uuid primary key default gen_random_uuid(),
  workspace_id            uuid not null references public.workspaces(id) on delete cascade,
  policy_name             text not null,
  policy_category         text,
  version                 text not null default '1.0',
  owner                   text,
  status                  text not null default 'draft',   -- draft|active|archived
  approval_date           date,
  review_date             date,
  acknowledgement_required boolean not null default false,
  acknowledgement_status  text not null default 'not_started', -- complete|partial|not_started
  notes                   text,
  created_by              uuid references auth.users(id),
  updated_by              uuid references auth.users(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- =============================================================================
-- risks — cross-links to many modules (all referenced tables now exist)
-- =============================================================================
create table public.risks (
  id                            uuid primary key default gen_random_uuid(),
  workspace_id                  uuid not null references public.workspaces(id) on delete cascade,
  risk_title                    text not null,
  risk_category                 public.risk_category not null default 'operational',
  description                   text,
  cause                         text,
  consequence                   text,
  likelihood                    int check (likelihood between 1 and 5),
  impact                        int check (impact between 1 and 5),
  inherent_score                int,
  inherent_rating               public.risk_rating,
  controls                      text,
  control_effectiveness         text,   -- strong|adequate|weak|none
  residual_likelihood           int check (residual_likelihood between 1 and 5),
  residual_impact               int check (residual_impact between 1 and 5),
  residual_score                int,
  residual_rating               public.risk_rating,
  risk_owner                    text,
  response                      public.risk_response not null default 'monitor',
  mitigation_actions            jsonb not null default '[]',
  status                        text not null default 'open',  -- open|accepted|closed
  review_date                   date,
  accepted_at                   timestamptz,
  closed_at                     timestamptz,
  acceptance_reason             text,
  closure_reason                text,
  linked_contract_id            uuid references public.contracts(id) on delete set null,
  linked_entity_id              uuid references public.business_entities(id) on delete set null,
  linked_employee_id            uuid references public.employees(id) on delete set null,
  linked_obligation_id          uuid references public.compliance_obligations(id) on delete set null,
  linked_processing_activity_id uuid references public.processing_activities(id) on delete set null,
  linked_governance_record_id   uuid references public.governance_records(id) on delete set null,
  created_by                    uuid references auth.users(id),
  updated_by                    uuid references auth.users(id),
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  deleted_at                    timestamptz
);
create index risks_workspace_status_idx on public.risks (workspace_id, status);
create index risks_workspace_residual_idx on public.risks (workspace_id, residual_rating);

-- =============================================================================
-- RLS + updated_at
-- =============================================================================
select public.apply_updated_at(t) from unnest(array[
  'compliance_obligations','compliance_evidence','gdpr_assessments','processing_activities',
  'data_requests','data_breaches','dpias','privacy_notices','governance_records','policies','risks'
]) as t;

select public.apply_tenant_rls(t) from unnest(array[
  'compliance_obligations','compliance_evidence','gdpr_assessments','processing_activities',
  'data_requests','data_breaches','dpias','privacy_notices','governance_records','policies','risks'
]) as t;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;
