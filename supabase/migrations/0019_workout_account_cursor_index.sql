-- Supports account-scoped workout history ordered by updated_at and stable IDs.
-- The existing public-feed partial index already covers its keyset sort; sleep
-- and weight date indexes are created by migrations 0017 and 0018.
create index if not exists arcus_workouts_account_recent_idx
  on public.arcus_workouts(account_id, updated_at desc, id desc);

create index if not exists arcus_social_recent_idx
  on public.arcus_workouts(updated_at desc, id desc, account_id desc)
  where is_public=true and payload->>'status'='completed';
