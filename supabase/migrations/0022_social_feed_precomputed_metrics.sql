alter table public.arcus_workouts
  add column if not exists name text not null default '',
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists exercise_summary jsonb not null default '[]'::jsonb,
  add column if not exists total_volume_kg double precision not null default 0,
  add column if not exists total_sets_count integer not null default 0,
  add column if not exists prs_count integer not null default 0,
  add column if not exists likes_count integer not null default 0,
  add column if not exists comments_count integer not null default 0;

-- Backfill existing completed sessions once. New sessions are computed on write.
update public.arcus_workouts w set
  name = coalesce(w.payload->>'name',''),
  started_at = nullif(w.payload->>'startedAt','')::timestamptz,
  completed_at = nullif(w.payload->>'completedAt','')::timestamptz,
  exercise_summary = coalesce((
    select jsonb_agg(jsonb_build_object('name',e.exercise->>'name','sets',
      (select count(*)::int from jsonb_array_elements(coalesce(e.exercise->'sets','[]'::jsonb)) s where s->>'completed'='true')) order by e.ordinality)
    from jsonb_array_elements(coalesce(w.payload->'exercises','[]'::jsonb)) with ordinality as e(exercise,ordinality)
  ),'[]'::jsonb),
  total_volume_kg = coalesce((
    select sum(
      case when (s->>'weight') ~ '^-?[0-9]+(\.[0-9]+)?$' and (s->>'reps') ~ '^-?[0-9]+(\.[0-9]+)?$'
        then (s->>'weight')::double precision * (s->>'reps')::double precision else 0 end
    )
    from jsonb_array_elements(coalesce(w.payload->'exercises','[]'::jsonb)) e
    cross join lateral jsonb_array_elements(coalesce(e->'sets','[]'::jsonb)) s
    where s->>'completed'='true' and coalesce(s->>'setType','working') <> 'warmup'
      and coalesce(e->>'trackingType','strength') <> 'cardio'
  ),0),
  total_sets_count = coalesce((
    select count(*)::integer
    from jsonb_array_elements(coalesce(w.payload->'exercises','[]'::jsonb)) e
    cross join lateral jsonb_array_elements(coalesce(e->'sets','[]'::jsonb)) s
    where s->>'completed'='true'
  ),0),
  likes_count = (select count(*)::integer from public.arcus_workout_likes l where l.workout_id=w.id and l.workout_owner_id=w.account_id),
  comments_count = (select count(*)::integer from public.arcus_workout_comments c where c.workout_id=w.id and c.workout_owner_id=w.account_id);

-- Social mutations update counters atomically in the same application transaction.
drop index if exists public.arcus_social_recent_idx;
create index arcus_social_recent_idx
  on public.arcus_workouts(updated_at desc,id desc,account_id desc)
  where is_public=true and completed_at is not null;
