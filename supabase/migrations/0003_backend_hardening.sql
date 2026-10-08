-- Keep server-managed timestamps consistent for conflict-aware sync.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'exercises', 'workouts', 'workout_exercises', 'sets', 'programs'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'set_updated_at_' || table_name, table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      'set_updated_at_' || table_name,
      table_name
    );
  end loop;
end;
$$;

create index if not exists profiles_username_lookup_idx
  on public.profiles (lower(username));
create index if not exists workouts_user_updated_idx
  on public.workouts (user_id, updated_at desc);
create index if not exists programs_user_updated_idx
  on public.programs (user_id, updated_at desc);

-- Keep the username resolver from disclosing an email for an ambiguous or empty login.
create or replace function public.resolve_login_email(login_username text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select au.email
  from auth.users as au
  join public.profiles as p on p.id = au.id
  where nullif(trim(login_username), '') is not null
    and lower(p.username) = lower(trim(login_username))
  limit 1;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;
