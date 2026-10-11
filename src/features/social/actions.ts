"use server";
import { getCurrentAccount as auth } from "@/lib/auth/server";
import { getDatabasePool } from "@/lib/db/pool";
import { commentSchema, followSchema, likeSchema, searchSchema, targetSchema, type PublicUser, type FeedWorkout, type FeedComment } from "./model";
import { z } from "zod";

// Select public identity only. Never serialize an AccountView or the workout payload.
const identity = `a.id as "userId", a.display_name as name, a.username as handle,
  case when a.avatar_object_key is not null or a.avatar_image is not null then '/api/social/avatar?id=' || a.id::text else null end as "avatarUrl"`;
const active = `a.is_banned=false and (a.is_suspended=false or a.suspended_until<=now())`;
const publicWorkoutPredicate = `w.is_public=true and w.payload->>'status'='completed' and ${active}`;

export async function getFeedWorkouts(tab: unknown = "discover"): Promise<FeedWorkout[]> {
  const session = await auth();
  const mode = z.enum(["following", "discover"]).parse(tab);
  if (mode === "following" && !session) return [];
  const { rows } = await getDatabasePool().query(`
    with recent as (
      select w.id,w.account_id,w.payload,w.updated_at from public.arcus_workouts w
      join public.arcus_accounts a on a.id=w.account_id where ${publicWorkoutPredicate}
      and ($2::text='discover' or exists(select 1 from public.arcus_follows f where f.follower_id=$1::uuid and f.following_id=w.account_id))
      order by w.updated_at desc,w.id desc,w.account_id desc limit 20
    ) select w.id,w.account_id as "ownerId",${identity},
      w.payload->>'name' as title,w.payload->>'completedAt' as "completedAt",w.payload->>'startedAt' as "startedAt",
      coalesce((select jsonb_agg(jsonb_build_object('name',e->>'name','sets',
        (select count(*) from jsonb_array_elements(e->'sets') s where s->>'completed'='true')))
        from jsonb_array_elements(w.payload->'exercises') e),'[]') as exercises,
      coalesce((select sum(coalesce((s->>'weight')::numeric,0)*coalesce((s->>'reps')::numeric,0))
        from jsonb_array_elements(w.payload->'exercises') e cross join lateral jsonb_array_elements(e->'sets') s
        where s->>'completed'='true' and coalesce(s->>'setType','working')<>'warmup'
          and coalesce(e->>'trackingType','strength')<>'cardio'),0) as volume,
      (select count(*)::int from public.arcus_workout_likes l where l.workout_id=w.id and l.workout_owner_id=w.account_id) as likes,
      (select count(*)::int from public.arcus_workout_comments c where c.workout_id=w.id and c.workout_owner_id=w.account_id) as comments,
      exists(select 1 from public.arcus_workout_likes l where l.workout_id=w.id and l.workout_owner_id=w.account_id and l.account_id=$1::uuid) as liked,
      exists(select 1 from public.arcus_follows f where f.follower_id=$1::uuid and f.following_id=a.id) as following
    from recent w join public.arcus_accounts a on a.id=w.account_id order by w.updated_at desc,w.id desc,w.account_id desc
  `, [session?.id ?? null, mode]);
  return rows.map(row => ({
    id: row.id,ownerId: row.ownerId,
    user: { id: row.userId,name: row.name,handle: row.handle,avatarUrl: row.avatarUrl,following: row.following },
    title: row.title,completedAt: row.completedAt,
    durationMinutes: Math.max(0,Math.round((Date.parse(row.completedAt)-Date.parse(row.startedAt))/60000)) || 0,
    volumeKg: Number(row.volume),exercises: row.exercises,likes: row.likes,comments: row.comments,liked: row.liked,
  }));
}
export async function searchUsers(query: unknown): Promise<PublicUser[]> {
  const session = await auth();
  const text = searchSchema.parse(query);
  if (text.length < 2) return [];
  const escaped = `%${text.replace(/[\\%_]/g, "\\$&")}%`;
  const { rows } = await getDatabasePool().query(`select ${identity},
    exists(select 1 from public.arcus_follows f where f.follower_id=$2::uuid and f.following_id=a.id) as following
    from public.arcus_accounts a where ${active} and a.id is distinct from $2::uuid
    and (a.display_name ilike $1 or a.username ilike $1) order by a.username,a.id limit 5`, [escaped,session?.id ?? null]);
  return rows.map(row => ({ id: row.userId,name: row.name,handle: row.handle,avatarUrl: row.avatarUrl,following: row.following }));
}
export async function setFollowing(input: unknown) {
  const session = await auth(); if (!session) throw new Error("Unauthorized");
  const data = followSchema.parse(input);
  if (data.userId === session.id) throw new Error("You cannot follow yourself.");
  if (data.following) {
    const result = await getDatabasePool().query(`insert into public.arcus_follows(follower_id,following_id)
      select $1,a.id from public.arcus_accounts a where a.id=$2 and ${active}
      on conflict (follower_id,following_id) do update set following_id=excluded.following_id returning following_id`, [session.id,data.userId]);
    if (!result.rowCount) throw new Error("Profile unavailable.");
  } else await getDatabasePool().query("delete from public.arcus_follows where follower_id=$1 and following_id=$2", [session.id,data.userId]);
}
async function publicWorkout(ownerId: string,workoutId: string) {
  const result = await getDatabasePool().query(`select w.account_id from public.arcus_workouts w
    join public.arcus_accounts a on a.id=w.account_id where w.account_id=$1 and w.id=$2 and ${publicWorkoutPredicate}`, [ownerId,workoutId]);
  if (!result.rowCount) throw new Error("Workout unavailable.");
}
export async function setWorkoutLike(input: unknown) {
  const session = await auth(); if (!session) throw new Error("Unauthorized");
  const data = likeSchema.parse(input);
  await publicWorkout(data.ownerId,data.workoutId);
  if (data.liked) {
    const result = await getDatabasePool().query(`insert into public.arcus_workout_likes(workout_owner_id,workout_id,account_id)
      select w.account_id,w.id,$3 from public.arcus_workouts w join public.arcus_accounts a on a.id=w.account_id
      where w.account_id=$1 and w.id=$2 and ${publicWorkoutPredicate}
      on conflict (workout_owner_id,workout_id,account_id) do update set account_id=excluded.account_id returning workout_id`, [data.ownerId,data.workoutId,session.id]);
    if (!result.rowCount) throw new Error("Workout unavailable.");
  } else await getDatabasePool().query("delete from public.arcus_workout_likes where workout_owner_id=$1 and workout_id=$2 and account_id=$3", [data.ownerId,data.workoutId,session.id]);
}
export async function getWorkoutComments(input: unknown): Promise<FeedComment[]> {
  const data = targetSchema.parse(input);
  await publicWorkout(data.ownerId,data.workoutId);
  const { rows } = await getDatabasePool().query(`select c.id,c.body as text,c.created_at as "createdAt",a.id as "userId",a.display_name as name,a.username as handle
    from public.arcus_workout_comments c join public.arcus_accounts a on a.id=c.account_id
    join public.arcus_workouts w on w.id=c.workout_id and w.account_id=c.workout_owner_id
    where c.workout_owner_id=$1 and c.workout_id=$2 and ${publicWorkoutPredicate} order by c.created_at desc,c.id desc limit 20`, [data.ownerId,data.workoutId]);
  return rows.map(row => ({ id: row.id,text: row.text,createdAt: new Date(row.createdAt).toISOString(),user: { id: row.userId,name: row.name,handle: row.handle } }));
}
export async function addWorkoutComment(input: unknown) {
  const session = await auth(); if (!session) throw new Error("Unauthorized");
  const data = commentSchema.parse(input);
  const result = await getDatabasePool().query(`insert into public.arcus_workout_comments(workout_owner_id,workout_id,account_id,body)
    select w.account_id,w.id,$3,$4 from public.arcus_workouts w join public.arcus_accounts a on a.id=w.account_id
    where w.account_id=$1 and w.id=$2 and ${publicWorkoutPredicate} returning id`, [data.ownerId,data.workoutId,session.id,data.text]);
  if (!result.rowCount) throw new Error("Workout unavailable.");
}
export async function deleteWorkoutComment(input: unknown) {
  const session = await auth(); if (!session) throw new Error("Unauthorized");
  const id = z.string().uuid().parse(input);
  const pool = getDatabasePool();
  const owner = await pool.query("select account_id from public.arcus_workout_comments where id=$1", [id]);
  if (owner.rows[0]?.account_id !== session.id) throw new Error("Unauthorized");
  await pool.query("delete from public.arcus_workout_comments where id=$1 and account_id=$2", [id,session.id]);
}
export async function setWorkoutVisibility(input: unknown) {
  const session = await auth(); if (!session) throw new Error("Unauthorized");
  const data = targetSchema.extend({ isPublic: z.boolean() }).parse(input);
  const pool = getDatabasePool();
  const owner = await pool.query("select account_id from public.arcus_workouts where id=$1 and account_id=$2", [data.workoutId,data.ownerId]);
  if (owner.rows[0]?.account_id !== session.id) throw new Error("Unauthorized");
  await pool.query("update public.arcus_workouts set is_public=$3 where id=$1 and account_id=$2", [data.workoutId,session.id,data.isPublic]);
}
