-- Expand owner-managed admin access into a constrained RBAC model.
-- The root OWNER remains pinned to server environment identity and is never
-- represented by a mutable database grant. Delegated grants are MODERATOR only.
alter table public.arcus_admin_access
  add column if not exists role text not null default 'MODERATOR';

alter table public.arcus_admin_access
  drop constraint if exists arcus_admin_access_role_check;
alter table public.arcus_admin_access
  add constraint arcus_admin_access_role_check
  check (role in ('OWNER', 'MODERATOR') and role <> 'OWNER');

alter table public.arcus_accounts
  add column if not exists is_suspended boolean not null default false,
  add column if not exists suspended_until timestamptz,
  add column if not exists suspension_reason text;

create table if not exists public.arcus_user_warnings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.arcus_accounts(id) on delete cascade,
  actor_id uuid not null references public.arcus_accounts(id) on delete restrict,
  actor_email text not null,
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists arcus_user_warnings_account_created_idx
  on public.arcus_user_warnings(account_id, created_at desc);

create table if not exists public.arcus_platform_settings (
  setting_key text primary key check (setting_key in ('global_announcement')),
  setting_value text not null default '',
  updated_by uuid references public.arcus_accounts(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.arcus_platform_settings(setting_key, setting_value)
values ('global_announcement', '') on conflict (setting_key) do nothing;

alter table public.arcus_admin_audit
  add column if not exists actor_email text;
update public.arcus_admin_audit l
  set actor_email = a.email
  from public.arcus_accounts a
  where l.actor_id = a.id and l.actor_email is null;
alter table public.arcus_admin_audit
  alter column actor_email set not null,
  alter column actor_email set default '';

alter table public.arcus_admin_audit
  drop constraint if exists arcus_admin_audit_target_type_check;
alter table public.arcus_admin_audit
  add constraint arcus_admin_audit_target_type_check
  check (target_type in ('user', 'exercise', 'settings'));
alter table public.arcus_admin_audit
  drop constraint if exists arcus_admin_audit_action_check;
alter table public.arcus_admin_audit
  add constraint arcus_admin_audit_action_check
  check (action in (
    'user_updated', 'user_banned', 'user_unbanned', 'user_warned',
    'user_suspended', 'user_unsuspended', 'exercise_updated', 'exercise_deleted',
    'feature_flag_updated', 'announcement_updated', 'admin_granted', 'admin_revoked'
  ));

create index if not exists arcus_admin_audit_actor_email_idx
  on public.arcus_admin_audit(actor_email, created_at desc);
