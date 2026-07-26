-- Business identity + contact fields mirrored from the prototype's settings:
-- trading name, public contact details, primary contact person, VAT number,
-- and four more operation toggles that drive obligation applicability.
alter table public.business_profiles
  add column if not exists trading_name text,
  add column if not exists website text,
  add column if not exists phone text,
  add column if not exists contact_email text,
  add column if not exists primary_contact_name text,
  add column if not exists primary_contact_role text,
  add column if not exists vat_number text,
  add column if not exists uses_contractors boolean not null default false,
  add column if not exists operates_public_service boolean not null default false,
  add column if not exists regulated_activities boolean not null default false,
  add column if not exists relies_on_suppliers boolean not null default false;
