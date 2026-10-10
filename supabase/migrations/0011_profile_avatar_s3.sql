-- Keep profile photo objects in private S3-compatible storage; retain legacy bytea columns for existing photos.
alter table public.arcus_accounts
  add column if not exists avatar_object_key text;
