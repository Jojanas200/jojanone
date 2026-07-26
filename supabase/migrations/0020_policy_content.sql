-- Policy document body, so Jova (or a user) can draft and store real policy
-- content, not just metadata. Nullable; existing metadata-only policies keep
-- content = null.
alter table public.policies add column if not exists content text;
