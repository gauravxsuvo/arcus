-- Owner-controlled runtime switches. All writes go through authenticated Node APIs.
create table if not exists public.arcus_feature_flags (
  flag_key text primary key check (flag_key in ('social_feed', 'pro_tier', 'maintenance_mode')),
  enabled boolean not null default false,
  updated_by uuid references public.arcus_accounts(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.arcus_feature_flags (flag_key, enabled) values
  ('social_feed', false),
  ('pro_tier', false),
  ('maintenance_mode', false)
on conflict (flag_key) do nothing;
