"use server";

import { getCurrentAccount } from "@/lib/auth/server";
import { getDatabasePool } from "@/lib/db/pool";
import type { DayActivity } from "@/features/training/activity";

type ActivityRow = {
  date: string;
  count: number | string;
  total_volume: number | string;
  titles: string[] | null;
  workout_ids: string[] | null;
  exercise_records: { exerciseId: string; estimatedMax: number | string }[] | null;
};

/** Reads only the current account's completed workouts and returns a small activity DTO. */
export async function getUserWorkoutHistory(userId: string, year: number): Promise<DayActivity[]> {
  const account = await getCurrentAccount();
  if (!account || account.id !== userId) throw new Error("Unauthorized");
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("Invalid activity year.");

  const pool = getDatabasePool();
  const [historicalRecords, result] = await Promise.all([
    pool.query<{ exercise_id: string; estimated_max: number | string }>(
      `select e->>'exerciseId' as exercise_id,
              max(coalesce((s->>'weight')::numeric, 0) * 36 / (37 - (s->>'reps')::integer)) as estimated_max
         from public.arcus_workouts w
         cross join lateral jsonb_array_elements(coalesce(w.payload->'exercises', '[]'::jsonb)) e
         cross join lateral jsonb_array_elements(coalesce(e->'sets', '[]'::jsonb)) s
        where w.account_id = $1 and w.payload->>'status' = 'completed'
          and (w.payload->>'completedAt')::timestamptz < $2::date
          and coalesce((s->>'completed')::boolean, false)
          and coalesce(s->>'setType', 'working') <> 'warmup'
          and coalesce((s->>'weight')::numeric, 0) > 0
          and coalesce((s->>'reps')::integer, 0) between 1 and 12
          and coalesce(e->>'trackingType', '') <> 'cardio'
          and lower(coalesce(e->>'muscle', '')) <> 'cardio'
        group by e->>'exerciseId'`,
      [account.id, `${year}-01-01`],
    ),
    pool.query<ActivityRow>(
    `with scoped_workouts as (
       select id, (payload->>'completedAt')::timestamptz as completed_at,
              to_char((payload->>'completedAt')::timestamptz at time zone 'UTC', 'YYYY-MM-DD') as activity_date,
              coalesce(nullif(payload->>'name', ''), 'Workout') as title,
              coalesce(payload->'exercises', '[]'::jsonb) as exercises
         from public.arcus_workouts
        where account_id = $1
          and payload->>'status' = 'completed'
          and (payload->>'completedAt')::timestamptz >= $2::date
          and (payload->>'completedAt')::timestamptz < $3::date
          and (payload->>'completedAt')::timestamptz <= now()
     ), exercise_workout as (
       select w.id, w.activity_date, e->>'exerciseId' as exercise_id,
              sum(coalesce((s->>'weight')::numeric, 0) * coalesce((s->>'reps')::numeric, 0)) as volume,
              max(case when coalesce((s->>'reps')::integer, 0) between 1 and 12
                       then coalesce((s->>'weight')::numeric, 0) * 36 / (37 - (s->>'reps')::integer)
                       else 0 end) as estimated_max
         from scoped_workouts w
         cross join lateral jsonb_array_elements(w.exercises) e
         cross join lateral jsonb_array_elements(coalesce(e->'sets', '[]'::jsonb)) s
        where coalesce((s->>'completed')::boolean, false)
          and coalesce(s->>'setType', 'working') <> 'warmup'
          and coalesce((s->>'weight')::numeric, 0) > 0
          and coalesce((s->>'reps')::integer, 0) > 0
          and coalesce(e->>'trackingType', '') <> 'cardio'
          and lower(coalesce(e->>'muscle', '')) <> 'cardio'
        group by w.id, w.activity_date, e->>'exerciseId'
     ), daily_workouts as (
       select activity_date as date, count(*)::integer as count,
              array_agg(distinct title order by title) as titles,
              array_agg(id::text order by id::text) as workout_ids
         from scoped_workouts group by activity_date
     ), daily_volume as (
       select activity_date as date, sum(volume)::numeric as total_volume
         from exercise_workout group by activity_date
     ), daily_records as (
       select activity_date as date,
              jsonb_agg(jsonb_build_object('exerciseId', exercise_id, 'estimatedMax', estimated_max)) as exercise_records
         from (select activity_date, exercise_id, max(estimated_max) as estimated_max
                 from exercise_workout group by activity_date, exercise_id) exercise_day
        group by activity_date
     )
     select d.date, d.count, coalesce(v.total_volume, 0) as total_volume, d.titles,
            coalesce(r.exercise_records, '[]'::jsonb) as exercise_records
       from daily_workouts d
       left join daily_volume v using (date)
       left join daily_records r using (date)
      order by d.date`,
    [account.id, `${year}-01-01`, `${year + 1}-01-01`],
  ),
  ]);

  const bestByExercise = new Map(historicalRecords.rows.map((row) => [row.exercise_id, Number(row.estimated_max)]));
  return result.rows.map((row) => {
    let isPersonalRecord = false;
    for (const record of row.exercise_records ?? []) {
      const value = Number(record.estimatedMax);
      if (Number.isFinite(value) && value > (bestByExercise.get(record.exerciseId) ?? 0)) {
        bestByExercise.set(record.exerciseId, value);
        isPersonalRecord = true;
      }
    }
    return {
      date: String(row.date).slice(0, 10),
      count: Number(row.count),
      totalVolume: Number(row.total_volume),
      titles: Array.isArray(row.titles) ? row.titles : [],
      workoutIds: Array.isArray(row.workout_ids) ? row.workout_ids : [],
      isPersonalRecord,
    };
  });
}
