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

create index if not exists arcus_weight_logs_account_date_idx
  on public.arcus_weight_logs(account_id, date desc);
