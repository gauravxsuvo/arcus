-- Account-owned workout templates for the Portways-backed ARCUS account system.
do $$ begin
  alter type public.set_type add value if not exists 'amrap';
exception when undefined_object then null;
end $$;

create table if not exists public.arcus_routines (
  id uuid primary key,
  account_id uuid not null references public.arcus_accounts(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  notes text not null default '' check (char_length(notes) <= 1000),
  exercises jsonb not null check (jsonb_typeof(exercises) = 'array' and jsonb_array_length(exercises) between 1 and 100),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists arcus_routines_account_order_idx
  on public.arcus_routines(account_id, sort_order, created_at desc);

-- The app uses a JSON workout payload as its canonical source, but its optional
-- Supabase relational mirror must accept every supported set tag as well.
do $$ begin
  alter type public.set_type add value if not exists 'drop';
exception when undefined_object then null;
end $$;
