-- =============================================================================
-- 0017_evidence_document_upload.sql — real document uploads for the Evidence
-- library. Adds the section-11 metadata (owner, issue date, access level) plus
-- a reference to the binary stored in the private 'evidence' bucket
-- (object_key = workspace_id/<module>/<uuid>_<name>). RLS is unchanged — the
-- existing evidence_library_items tenant policies still apply.
-- =============================================================================
alter table public.evidence_library_items
  add column if not exists owner        text,
  add column if not exists issue_date   date,
  add column if not exists access_level text not null default 'workspace', -- workspace|restricted
  add column if not exists object_key   text,
  add column if not exists mime_type    text,
  add column if not exists size_bytes   bigint,
  add column if not exists original_name text,
  add column if not exists uploaded_by  uuid references auth.users(id);
