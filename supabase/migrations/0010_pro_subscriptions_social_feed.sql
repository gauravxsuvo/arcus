-- ARCUS Pro billing state and the relational foundation for the social feed.
-- Payment processing and feed APIs are intentionally not enabled by this migration.

alter table public.arcus_accounts
  add column if not exists is_pro boolean not null default false,
  add column if not exists stripe_customer_id text,
  add column if not exists subscription_status text not null default 'inactive';

alter table public.arcus_accounts
  drop constraint if exists arcus_accounts_subscription_status_check;
alter table public.arcus_accounts
  add constraint arcus_accounts_subscription_status_check
  check (subscription_status in ('inactive', 'incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'));

create unique index if not exists arcus_accounts_stripe_customer_idx
  on public.arcus_accounts(stripe_customer_id)
  where stripe_customer_id is not null;

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

alter table public.arcus_workouts
  add column if not exists is_public boolean not null default true;
create index if not exists arcus_workouts_public_updated_idx
  on public.arcus_workouts(is_public, updated_at desc);

create table if not exists public.arcus_follows (
  follower_id uuid not null references public.arcus_accounts(id) on delete cascade,
  following_id uuid not null references public.arcus_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint arcus_follows_not_self check (follower_id <> following_id)
);
create index if not exists arcus_follows_following_idx
  on public.arcus_follows(following_id, created_at desc);

create table if not exists public.arcus_workout_likes (
  workout_owner_id uuid not null,
  workout_id uuid not null,
  account_id uuid not null references public.arcus_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workout_owner_id, workout_id, account_id),
  foreign key (workout_id, workout_owner_id)
    references public.arcus_workouts(id, account_id) on delete cascade
);
create index if not exists arcus_workout_likes_account_idx
  on public.arcus_workout_likes(account_id, created_at desc);

create table if not exists public.arcus_workout_comments (
  id uuid primary key default gen_random_uuid(),
  workout_owner_id uuid not null,
  workout_id uuid not null,
  account_id uuid not null references public.arcus_accounts(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  foreign key (workout_id, workout_owner_id)
    references public.arcus_workouts(id, account_id) on delete cascade
);
create index if not exists arcus_workout_comments_workout_idx
  on public.arcus_workout_comments(workout_owner_id, workout_id, created_at desc);
