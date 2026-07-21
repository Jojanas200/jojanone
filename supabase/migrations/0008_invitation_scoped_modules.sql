-- Adviser scope on invitations: an owner can restrict an invited adviser to a
-- subset of modules. NULL = full (read-only) access. Carried into the
-- membership's scoped_modules at acceptance time.
alter table invitations
  add column if not exists scoped_modules text[];
