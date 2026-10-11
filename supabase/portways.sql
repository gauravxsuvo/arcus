-- Arcus tables for the Portways PostgreSQL bridge.
-- These tables are independent from Supabase auth and are safe to run repeatedly.
create table if not exists public.arcus_accounts (
  id uuid primary key,
  username text not null,
  username_normalized text not null unique,
  email text not null,
  email_normalized text not null unique,
  password_hash text not null,
  display_name text not null,
  bio text,
  experience text,
  goals jsonb not null default '[]'::jsonb,
  height_cm numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.arcus_accounts
  add column if not exists is_banned boolean not null default false;

alter table public.arcus_accounts
  add column if not exists bio text;

-- Legacy photo bytes remain readable during the migration to private S3-compatible object storage.
alter table public.arcus_accounts
  add column if not exists avatar_image bytea,
  add column if not exists avatar_mime_type text,
  add column if not exists avatar_object_key text;

alter table public.arcus_accounts add column if not exists profile_data jsonb not null default '{}'::jsonb;

create table if not exists public.arcus_library (
  account_id uuid not null references public.arcus_accounts(id) on delete cascade,
  kind text not null constraint arcus_library_kind_check check (kind in ('program','measurement','exercise','settings','recap','favorite')),
  id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (account_id, kind, id)
);

alter table public.arcus_library drop constraint if exists arcus_library_kind_check;
alter table public.arcus_library add constraint arcus_library_kind_check check (kind in ('program','measurement','exercise','settings','recap','favorite'));

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.arcus_accounts'::regclass and conname = 'arcus_accounts_avatar_check') then
    alter table public.arcus_accounts add constraint arcus_accounts_avatar_check check (
      (avatar_image is null and avatar_mime_type is null)
      or (avatar_image is not null and avatar_mime_type is not null
          and avatar_mime_type in ('image/jpeg', 'image/png', 'image/webp')
          and octet_length(avatar_image) between 1 and 524288)
    );
  end if;
end $$;

create table if not exists public.arcus_sessions (
  id uuid primary key,
  account_id uuid not null references public.arcus_accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists arcus_sessions_account_idx on public.arcus_sessions(account_id);
create index if not exists arcus_sessions_expiry_idx on public.arcus_sessions(expires_at);

alter table public.arcus_accounts
  add column if not exists totp_secret_enc text,
  add column if not exists totp_enabled boolean not null default false,
  add column if not exists totp_backup_codes text[] not null default '{}';

create table if not exists public.arcus_mfa_setup (
  account_id uuid primary key references public.arcus_accounts(id) on delete cascade,
  secret_enc text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists public.arcus_mfa_challenges (
  id uuid primary key,
  account_id uuid not null references public.arcus_accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists arcus_mfa_challenges_expiry_idx on public.arcus_mfa_challenges(expires_at);
create table if not exists public.arcus_password_reset_tokens (
  id uuid primary key,
  account_id uuid not null references public.arcus_accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists arcus_password_reset_expiry_idx on public.arcus_password_reset_tokens(expires_at);
create table if not exists public.arcus_auth_rate_limits (
  key_hash text primary key,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.arcus_passkeys (
  id uuid primary key,
  account_id uuid not null references public.arcus_accounts(id) on delete cascade,
  credential_id text not null unique,
  public_key bytea not null,
  counter bigint not null default 0,
  transports jsonb not null default '[]'::jsonb,
  device_type text not null default 'singleDevice',
  backed_up boolean not null default false,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists arcus_passkeys_account_idx on public.arcus_passkeys(account_id);

create table if not exists public.arcus_passkey_challenges (
  id uuid primary key,
  account_id uuid references public.arcus_accounts(id) on delete cascade,
  purpose text not null check (purpose in ('registration', 'authentication')),
  challenge text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists arcus_passkey_challenges_expiry_idx on public.arcus_passkey_challenges(expires_at);

create table if not exists public.arcus_workouts (
  id uuid not null,
  account_id uuid not null references public.arcus_accounts(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (id, account_id)
);

create index if not exists arcus_workouts_account_idx on public.arcus_workouts(account_id, updated_at desc);
create index if not exists arcus_workouts_account_recent_idx on public.arcus_workouts(account_id, updated_at desc, id desc);

-- ARCUS Pro and the relational foundation for the social feed. Keep this
-- idempotent so `db:init` also provisions fresh Portways databases.
alter table public.arcus_accounts
  add column if not exists is_pro boolean not null default false,
  add column if not exists stripe_customer_id text,
  add column if not exists subscription_status text not null default 'inactive';
alter table public.arcus_accounts drop constraint if exists arcus_accounts_subscription_status_check;
alter table public.arcus_accounts add constraint arcus_accounts_subscription_status_check
  check (subscription_status in ('inactive', 'incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'));
create unique index if not exists arcus_accounts_stripe_customer_idx
  on public.arcus_accounts(stripe_customer_id) where stripe_customer_id is not null;

create table if not exists public.arcus_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.arcus_accounts(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'razorpay')),
  provider_subscription_id text not null unique,
  status text not null check (status in ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  plan_interval text not null check (plan_interval in ('month', 'year')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists arcus_subscriptions_account_status_idx
  on public.arcus_subscriptions(account_id, status, current_period_end desc);

alter table public.arcus_workouts add column if not exists is_public boolean not null default true;
create index if not exists arcus_workouts_public_updated_idx
  on public.arcus_workouts(is_public, updated_at desc);
create index if not exists arcus_social_recent_idx
  on public.arcus_workouts(updated_at desc, id desc, account_id desc)
  where is_public=true and payload->>'status'='completed';

create table if not exists public.arcus_weight_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.arcus_accounts(id) on delete cascade,
  date text not null check (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  weight numeric(7,2) not null check (weight > 0),
  unit text not null default 'kg' check (unit in ('kg', 'lbs')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arcus_weight_logs_account_date_unique unique (account_id, date)
);
create index if not exists arcus_weight_logs_account_date_idx on public.arcus_weight_logs(account_id, date desc);

create table if not exists public.arcus_follows (
  follower_id uuid not null references public.arcus_accounts(id) on delete cascade,
  following_id uuid not null references public.arcus_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint arcus_follows_not_self check (follower_id <> following_id)
);
create index if not exists arcus_follows_following_idx on public.arcus_follows(following_id, created_at desc);

create table if not exists public.arcus_workout_likes (
  workout_owner_id uuid not null,
  workout_id uuid not null,
  account_id uuid not null references public.arcus_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workout_owner_id, workout_id, account_id),
  foreign key (workout_id, workout_owner_id) references public.arcus_workouts(id, account_id) on delete cascade
);
create index if not exists arcus_workout_likes_account_idx on public.arcus_workout_likes(account_id, created_at desc);

create table if not exists public.arcus_workout_comments (
  id uuid primary key default gen_random_uuid(),
  workout_owner_id uuid not null,
  workout_id uuid not null,
  account_id uuid not null references public.arcus_accounts(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  foreign key (workout_id, workout_owner_id) references public.arcus_workouts(id, account_id) on delete cascade
);
create index if not exists arcus_workout_comments_workout_idx
  on public.arcus_workout_comments(workout_owner_id, workout_id, created_at desc);

create table if not exists public.arcus_sleep_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.arcus_accounts(id) on delete cascade,
  date text not null check (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  bedtime timestamptz not null,
  wake_time timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 30 and 1440),
  quality_rating smallint not null check (quality_rating between 1 and 3),
  readiness_score smallint not null check (readiness_score between 0 and 100),
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arcus_sleep_logs_account_date_unique unique (account_id, date),
  constraint arcus_sleep_logs_chronology_check check (wake_time > bedtime)
);
create index if not exists arcus_sleep_logs_account_date_idx
  on public.arcus_sleep_logs(account_id, date desc);

create table if not exists public.arcus_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.arcus_accounts(id) on delete restrict,
  target_type text not null check (target_type in ('user', 'exercise')),
  target_id text not null,
  action text not null check (action in ('user_updated', 'user_banned', 'user_unbanned', 'exercise_updated', 'exercise_deleted')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists arcus_admin_audit_created_idx on public.arcus_admin_audit(created_at desc);
