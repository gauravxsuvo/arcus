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
