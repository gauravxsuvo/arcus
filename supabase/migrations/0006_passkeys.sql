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
