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
  add column if not exists bio text;

-- Store the actual photo bytes in PostgreSQL, rather than a device-local URL.
alter table public.arcus_accounts
  add column if not exists avatar_image bytea,
  add column if not exists avatar_mime_type text;

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

create table if not exists public.arcus_workouts (
  id uuid not null,
  account_id uuid not null references public.arcus_accounts(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (id, account_id)
);

create index if not exists arcus_workouts_account_idx on public.arcus_workouts(account_id, updated_at desc);
alter table public.arcus_accounts add column if not exists mfa_secret text;
