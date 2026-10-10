-- Delegated admin access is always bound to an existing immutable account ID.
create table if not exists public.arcus_admin_access (
  account_id uuid primary key references public.arcus_accounts(id) on delete cascade,
  approved_email text not null check (approved_email = lower(btrim(approved_email))),
  granted_by uuid not null references public.arcus_accounts(id) on delete restrict,
  granted_at timestamptz not null default now()
);

create index if not exists arcus_admin_access_granted_idx
  on public.arcus_admin_access(granted_at desc);

create table if not exists public.arcus_admin_access_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.arcus_accounts(id) on delete restrict,
  target_account_id uuid not null,
  target_email text not null,
  action text not null check (action in ('granted', 'revoked')),
  created_at timestamptz not null default now()
);

create index if not exists arcus_admin_access_audit_created_idx
  on public.arcus_admin_access_audit(created_at desc);
