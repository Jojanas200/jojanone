-- Plan designer: admins create and publish priced packages, choose which
-- optional features each one unlocks, and offer time-bound free trials.
--
-- Core modules (those the Business Confidence Score is derived from) are NOT
-- stored here - they are always granted, in code, so a plan can never be sold
-- that cannot be scored.
alter table public.plans
  add column if not exists description text,
  add column if not exists features text[] not null default '{}',
  add column if not exists trial_days integer not null default 0,
  add column if not exists published boolean not null default false,
  add column if not exists stripe_product_id text,
  add column if not exists billing_interval text not null default 'month',
  add column if not exists is_highlighted boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- The plans already being advertised keep advertising: publish them with the
-- copy and feature allocation the marketing page was hardcoding, so the public
-- pricing does not change the moment this ships.
update public.plans
set published = true,
    description = coalesce(description, 'For founders getting the essentials protected and provable.'),
    features = case when features = '{}' then array['jova','reports','academy'] else features end,
    trial_days = case when trial_days = 0 then 14 else trial_days end
where key = 'starter';

update public.plans
set published = true,
    is_highlighted = true,
    description = coalesce(description, 'For teams that share the load and need to show their working.'),
    features = case when features = '{}' then array['jova','reports','academy','executive','timeline','business-map','companies-house'] else features end,
    trial_days = case when trial_days = 0 then 14 else trial_days end
where key = 'growth';

update public.plans
set published = true,
    description = coalesce(description, 'For larger organisations and advisers with bigger footprints.'),
    features = case when features = '{}' then array['jova','reports','academy','executive','timeline','business-map','companies-house','simulator','investor-ready','tender-ready','import'] else features end
where key = 'professional';

update public.plans
set published = false,
    description = coalesce(description, 'Custom seats, onboarding support and bespoke terms.'),
    features = case when features = '{}' then array['jova','reports','academy','executive','timeline','business-map','companies-house','simulator','investor-ready','tender-ready','import'] else features end
where key = 'enterprise';
