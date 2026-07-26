-- Professional-review tracking on policies, mirrored from the prototype's
-- policy workflow: whether expert review is recommended/recorded, and the
-- reviewer note for the audit trail.
alter table public.policies
  add column if not exists professional_review_status text not null default 'not_required',
  add column if not exists professional_review_note text;
