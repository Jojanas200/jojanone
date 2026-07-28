-- Jurisdiction in Business Memory: the registered country captured at
-- onboarding lands on the business profile and informs Jova.
alter table public.business_profiles
  add column if not exists registered_country text;
