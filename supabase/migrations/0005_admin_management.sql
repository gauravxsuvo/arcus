-- Admin account status and an append-only management activity trail.
alter table public.arcus_accounts
  add column if not exists is_banned boolean not null default false;

create table if not exists public.arcus_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.arcus_accounts(id) on delete restrict,
  target_type text not null check (target_type in ('user', 'exercise')),
  target_id text not null,
  action text not null check (action in ('user_updated', 'user_banned', 'user_unbanned', 'exercise_updated', 'exercise_deleted')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists arcus_admin_audit_created_idx
  on public.arcus_admin_audit(created_at desc);
