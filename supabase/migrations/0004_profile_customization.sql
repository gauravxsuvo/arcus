alter table if exists public.arcus_accounts
  add column if not exists bio text;
