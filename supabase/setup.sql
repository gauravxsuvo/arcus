-- SOURCE: supabase/migrations/0001_foundation.sql
create extension if not exists pgcrypto;

create type public.workout_status as enum ('active', 'completed', 'abandoned');
create type public.set_type as enum ('working', 'warmup', 'drop_set', 'failure', 'assisted', 'paused', 'partial', 'rest_pause');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  experience text check (experience in ('beginner', 'intermediate', 'advanced')),
  birth_date date,
  sex text,
  height_cm numeric(5,2) check (height_cm is null or height_cm > 0),
  goals text[] not null default '{}',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.muscles (
  id smallint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  region text not null
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  aliases text[] not null default '{}',
  description text,
  instructions text[] not null default '{}',
  primary_muscle_id smallint references public.muscles(id),
  movement_pattern text,
  equipment text[] not null default '{}',
  difficulty text check (difficulty in ('beginner', 'intermediate', 'advanced')),
  default_rep_min smallint check (default_rep_min is null or default_rep_min > 0),
  default_rep_max smallint check (default_rep_max is null or default_rep_max >= default_rep_min),
  default_rest_seconds integer check (default_rest_seconds is null or default_rest_seconds >= 0),
  is_system_exercise boolean not null default false,
  created_by uuid references auth.users(id) on delete cascade,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by, slug),
  check ((is_system_exercise and created_by is null) or (not is_system_exercise and created_by is not null))
);

create table public.exercise_muscles (
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  muscle_id smallint not null references public.muscles(id),
  contribution_weight numeric(4,3) not null default 1 check (contribution_weight >= 0 and contribution_weight <= 1),
  primary key (exercise_id, muscle_id)
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Workout',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  status public.workout_status not null default 'active',
  notes text,
  template_id uuid,
  program_day_id uuid,
  client_revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index workouts_one_active_per_user on public.workouts(user_id) where status = 'active';
create index workouts_user_started_idx on public.workouts(user_id, started_at desc);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name_snapshot text not null,
  order_index integer not null check (order_index >= 0),
  notes text,
  rest_seconds integer check (rest_seconds is null or rest_seconds >= 0),
  superset_group_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workout_id, order_index)
);

create table public.sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_index integer not null check (set_index >= 0),
  weight numeric(8,3) check (weight is null or weight >= 0),
  reps integer check (reps is null or reps >= 0),
  rpe numeric(3,1) check (rpe is null or rpe between 0 and 10),
  rir numeric(3,1) check (rir is null or rir >= 0),
  set_type public.set_type not null default 'working',
  is_completed boolean not null default false,
  is_warmup boolean not null default false,
  is_failure boolean not null default false,
  is_assisted boolean not null default false,
  is_paused boolean not null default false,
  is_drop_set boolean not null default false,
  is_rest_pause boolean not null default false,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workout_exercise_id, set_index)
);

create index workout_exercises_order_idx on public.workout_exercises(workout_id, order_index);
create index sets_exercise_set_idx on public.sets(workout_exercise_id, set_index);

create table public.exercise_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.muscles enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_muscles enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.sets enable row level security;
alter table public.exercise_favorites enable row level security;

create policy "Users read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Users update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Users read muscle catalog" on public.muscles for select to authenticated using (true);

create policy "Users read system and own exercises" on public.exercises for select to authenticated
  using (is_system_exercise or created_by = (select auth.uid()));
create policy "Users create own exercises" on public.exercises for insert to authenticated
  with check (not is_system_exercise and created_by = (select auth.uid()));
create policy "Users update own exercises" on public.exercises for update to authenticated
  using (not is_system_exercise and created_by = (select auth.uid()))
  with check (not is_system_exercise and created_by = (select auth.uid()));
create policy "Users delete own exercises" on public.exercises for delete to authenticated
  using (not is_system_exercise and created_by = (select auth.uid()));
create policy "Users read muscles for visible exercises" on public.exercise_muscles for select to authenticated
  using (exists (select 1 from public.exercises e where e.id = exercise_id and (e.is_system_exercise or e.created_by = (select auth.uid()))));
create policy "Users manage muscles for own exercises" on public.exercise_muscles for all to authenticated
  using (exists (select 1 from public.exercises e where e.id = exercise_id and not e.is_system_exercise and e.created_by = (select auth.uid())))
  with check (exists (select 1 from public.exercises e where e.id = exercise_id and not e.is_system_exercise and e.created_by = (select auth.uid())));

create policy "Users manage own workouts" on public.workouts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users manage exercises in own workouts" on public.workout_exercises for all to authenticated
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())))
  with check (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())));
create policy "Users manage sets in own workouts" on public.sets for all to authenticated
  using (exists (
    select 1 from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = workout_exercise_id and w.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = workout_exercise_id and w.user_id = (select auth.uid())
  ));
create policy "Users read own exercise favorites" on public.exercise_favorites for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users favorite visible exercises" on public.exercise_favorites for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.exercises e where e.id = exercise_id and (e.is_system_exercise or e.created_by = (select auth.uid()))
  ));
create policy "Users unfavorite own exercises" on public.exercise_favorites for delete to authenticated
  using (user_id = (select auth.uid()));

-- P1: repeatable programs and physique history, all scoped to the owning account.
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  goal text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  week_index smallint not null default 0 check (week_index >= 0),
  day_index smallint not null check (day_index >= 0),
  name text not null,
  unique (program_id, week_index, day_index)
);

create table public.program_day_exercises (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references public.program_days(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name_snapshot text not null,
  order_index integer not null check (order_index >= 0),
  target_sets smallint not null check (target_sets between 1 and 20),
  rep_min smallint not null check (rep_min > 0),
  rep_max smallint not null check (rep_max >= rep_min),
  rest_seconds integer not null default 90 check (rest_seconds >= 0),
  progression_method text not null default 'double_progression' check (progression_method in ('manual', 'double_progression', 'rpe', 'percentage')),
  progression_config jsonb not null default '{}'::jsonb,
  unique (program_day_id, order_index)
);

alter table public.workouts add constraint workouts_template_fk foreign key (template_id) references public.programs(id) on delete set null;
alter table public.workouts add constraint workouts_program_day_fk foreign key (program_day_id) references public.program_days(id) on delete set null;

create table public.bodyweight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weight_kg numeric(6,2) not null check (weight_kg between 20 and 500),
  measured_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);
create index bodyweight_user_date_idx on public.bodyweight_entries(user_id, measured_at desc);

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric text not null,
  value_cm numeric(6,2) not null check (value_cm between 1 and 300),
  measured_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);
create index body_measurements_user_date_idx on public.body_measurements(user_id, measured_at desc);

alter table public.programs enable row level security;
alter table public.program_days enable row level security;
alter table public.program_day_exercises enable row level security;
alter table public.bodyweight_entries enable row level security;
alter table public.body_measurements enable row level security;

create policy "Users manage own programs" on public.programs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users manage days in own programs" on public.program_days for all to authenticated
  using (exists (select 1 from public.programs p where p.id = program_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.programs p where p.id = program_id and p.user_id = (select auth.uid())));
create policy "Users manage exercises in own program days" on public.program_day_exercises for all to authenticated
  using (exists (
    select 1 from public.program_days d join public.programs p on p.id = d.program_id
    where d.id = program_day_id and p.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.program_days d join public.programs p on p.id = d.program_id
    where d.id = program_day_id and p.user_id = (select auth.uid())
  ));
create policy "Users manage own bodyweight entries" on public.bodyweight_entries for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users manage own body measurements" on public.body_measurements for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));


-- SOURCE: supabase/migrations/0002_usernames.sql
alter table public.profiles
  add column if not exists username text;

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username))
  where username is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
    nullif(lower(trim(new.raw_user_meta_data ->> 'username')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.resolve_login_email(login_username text)
returns text
language sql
security definer set search_path = public
as $$
  select au.email
  from auth.users as au
  join public.profiles as p on p.id = au.id
  where lower(p.username) = lower(trim(login_username))
  limit 1;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;


-- SOURCE: supabase/migrations/0003_backend_hardening.sql
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


-- SOURCE: supabase/seed.sql
insert into public.muscles (slug, name, region) values
  ('chest', 'Chest', 'torso'), ('upper-chest', 'Upper chest', 'torso'), ('lats', 'Lats', 'back'),
  ('upper-back', 'Upper back', 'back'), ('traps', 'Traps', 'back'), ('front-delts', 'Front delts', 'shoulders'),
  ('side-delts', 'Side delts', 'shoulders'), ('rear-delts', 'Rear delts', 'shoulders'), ('biceps', 'Biceps', 'arms'),
  ('triceps', 'Triceps', 'arms'), ('forearms', 'Forearms', 'arms'), ('abs', 'Abs', 'core'),
  ('obliques', 'Obliques', 'core'), ('erectors', 'Erectors', 'back'), ('quads', 'Quads', 'legs'),
  ('hamstrings', 'Hamstrings', 'legs'), ('glutes', 'Glutes', 'legs'), ('calves', 'Calves', 'legs'),
  ('adductors', 'Adductors', 'legs')
on conflict (slug) do nothing;

insert into public.exercises (name, slug, aliases, primary_muscle_id, movement_pattern, equipment, difficulty, default_rep_min, default_rep_max, default_rest_seconds, is_system_exercise)
select v.name, v.slug, v.aliases, m.id, v.pattern, v.equipment, 'beginner', 6, 12, v.rest, true
from (values
  ('Barbell Bench Press','barbell-bench-press',array['bench','flat bench'],'chest','horizontal push',array['barbell'],150),
  ('Incline Barbell Bench Press','incline-barbell-bench-press',array['incline bench'],'upper-chest','incline push',array['barbell'],150),
  ('Dumbbell Bench Press','dumbbell-bench-press',array['db bench'],'chest','horizontal push',array['dumbbell'],120),
  ('Incline Dumbbell Press','incline-dumbbell-press',array['incline db press'],'upper-chest','incline push',array['dumbbell'],120),
  ('Machine Chest Press','machine-chest-press',array[]::text[],'chest','horizontal push',array['machine'],120),
  ('Pec Deck','pec-deck',array['machine fly'],'chest','fly',array['machine'],90),
  ('Cable Fly','cable-fly',array[]::text[],'chest','fly',array['cable'],90),
  ('Push-up','push-up',array['press-up'],'chest','horizontal push',array['bodyweight'],90),
  ('Pull-up','pull-up',array[]::text[],'lats','vertical pull',array['bodyweight'],150),
  ('Chin-up','chin-up',array[]::text[],'lats','vertical pull',array['bodyweight'],150),
  ('Lat Pulldown','lat-pulldown',array['pulldown'],'lats','vertical pull',array['cable'],120),
  ('Barbell Row','barbell-row',array['bent over row'],'upper-back','horizontal pull',array['barbell'],150),
  ('Chest-Supported Row','chest-supported-row',array[]::text[],'upper-back','horizontal pull',array['machine'],120),
  ('Seated Cable Row','seated-cable-row',array['cable row'],'upper-back','horizontal pull',array['cable'],120),
  ('One-Arm Dumbbell Row','one-arm-dumbbell-row',array['single arm row'],'lats','horizontal pull',array['dumbbell'],120),
  ('Overhead Press','overhead-press',array['ohp','military press'],'front-delts','vertical push',array['barbell'],150),
  ('Dumbbell Shoulder Press','dumbbell-shoulder-press',array[]::text[],'front-delts','vertical push',array['dumbbell'],120),
  ('Machine Shoulder Press','machine-shoulder-press',array[]::text[],'front-delts','vertical push',array['machine'],120),
  ('Dumbbell Lateral Raise','lateral-raise',array['side raise'],'side-delts','shoulder isolation',array['dumbbell'],75),
  ('Cable Lateral Raise','cable-lateral-raise',array[]::text[],'side-delts','shoulder isolation',array['cable'],75),
  ('Reverse Fly','reverse-fly',array['rear delt fly'],'rear-delts','shoulder isolation',array['machine'],75),
  ('Face Pull','face-pull',array[]::text[],'rear-delts','shoulder isolation',array['cable'],75),
  ('Barbell Curl','barbell-curl',array[]::text[],'biceps','elbow flexion',array['barbell'],90),
  ('Dumbbell Curl','dumbbell-curl',array[]::text[],'biceps','elbow flexion',array['dumbbell'],75),
  ('Incline Curl','incline-curl',array[]::text[],'biceps','elbow flexion',array['dumbbell'],75),
  ('Hammer Curl','hammer-curl',array[]::text[],'biceps','elbow flexion',array['dumbbell'],75),
  ('Triceps Pushdown','triceps-pushdown',array['pushdown'],'triceps','elbow extension',array['cable'],75),
  ('Overhead Cable Extension','overhead-cable-extension',array[]::text[],'triceps','elbow extension',array['cable'],75),
  ('Skull Crusher','skull-crusher',array[]::text[],'triceps','elbow extension',array['ez bar'],90),
  ('Close-Grip Bench Press','close-grip-bench-press',array[]::text[],'triceps','horizontal push',array['barbell'],120),
  ('Back Squat','back-squat',array['squat'],'quads','squat',array['barbell'],180),
  ('Front Squat','front-squat',array[]::text[],'quads','squat',array['barbell'],180),
  ('Hack Squat','hack-squat',array[]::text[],'quads','squat',array['machine'],150),
  ('Leg Press','leg-press',array[]::text[],'quads','squat',array['machine'],150),
  ('Leg Extension','leg-extension',array[]::text[],'quads','knee extension',array['machine'],90),
  ('Romanian Deadlift','romanian-deadlift',array['rdl','stiff leg deadlift'],'hamstrings','hip hinge',array['barbell'],150),
  ('Stiff-Leg Deadlift','stiff-leg-deadlift',array[]::text[],'hamstrings','hip hinge',array['barbell'],150),
  ('Seated Leg Curl','seated-leg-curl',array['hamstring curl'],'hamstrings','knee flexion',array['machine'],90),
  ('Barbell Hip Thrust','barbell-hip-thrust',array[]::text[],'glutes','hip extension',array['barbell'],120),
  ('Standing Calf Raise','standing-calf-raise',array[]::text[],'calves','ankle extension',array['machine'],75)
) as v(name, slug, aliases, primary_muscle, pattern, equipment, rest)
join public.muscles m on m.slug = v.primary_muscle
where not exists (select 1 from public.exercises e where e.is_system_exercise and e.slug = v.slug);

insert into public.exercise_muscles (exercise_id, muscle_id, contribution_weight)
select e.id, m.id, v.weight
from (values
  ('barbell-bench-press','chest',1.0), ('barbell-bench-press','front-delts',0.5), ('barbell-bench-press','triceps',0.5),
  ('incline-barbell-bench-press','upper-chest',1.0), ('incline-barbell-bench-press','front-delts',0.5), ('incline-barbell-bench-press','triceps',0.4),
  ('dumbbell-bench-press','chest',1.0), ('dumbbell-bench-press','front-delts',0.4), ('dumbbell-bench-press','triceps',0.4),
  ('pull-up','lats',1.0), ('pull-up','biceps',0.4), ('pull-up','upper-back',0.3),
  ('lat-pulldown','lats',1.0), ('lat-pulldown','biceps',0.4), ('lat-pulldown','upper-back',0.3),
  ('barbell-row','upper-back',1.0), ('barbell-row','lats',0.7), ('barbell-row','biceps',0.4), ('barbell-row','erectors',0.3),
  ('overhead-press','front-delts',1.0), ('overhead-press','side-delts',0.4), ('overhead-press','triceps',0.5),
  ('lateral-raise','side-delts',1.0), ('reverse-fly','rear-delts',1.0), ('reverse-fly','upper-back',0.4),
  ('back-squat','quads',1.0), ('back-squat','glutes',0.7), ('back-squat','adductors',0.3), ('back-squat','erectors',0.3),
  ('romanian-deadlift','hamstrings',1.0), ('romanian-deadlift','glutes',0.7), ('romanian-deadlift','erectors',0.4),
  ('leg-press','quads',1.0), ('leg-press','glutes',0.5), ('barbell-hip-thrust','glutes',1.0), ('standing-calf-raise','calves',1.0)
) as v(exercise_slug, muscle_slug, weight)
join public.exercises e on e.slug = v.exercise_slug and e.is_system_exercise
join public.muscles m on m.slug = v.muscle_slug
on conflict (exercise_id, muscle_id) do update set contribution_weight = excluded.contribution_weight;
