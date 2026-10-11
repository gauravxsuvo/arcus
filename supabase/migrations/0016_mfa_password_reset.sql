-- Authenticator app MFA, short-lived MFA challenges, password reset tokens,
-- and database-backed verification attempt limits.
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
create index if not exists arcus_mfa_challenges_expiry_idx
  on public.arcus_mfa_challenges(expires_at);

create table if not exists public.arcus_password_reset_tokens (
  id uuid primary key,
  account_id uuid not null references public.arcus_accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists arcus_password_reset_expiry_idx
  on public.arcus_password_reset_tokens(expires_at);

create table if not exists public.arcus_auth_rate_limits (
  key_hash text primary key,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
