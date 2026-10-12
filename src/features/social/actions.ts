"use server";
import { unstable_cache, revalidateTag } from "next/cache";
import { getCurrentAccount as auth } from "@/lib/auth/server";
import { getDatabasePool } from "@/lib/db/pool";
import { commentSchema, followSchema, likeSchema, searchSchema, targetSchema, type PublicUser, type FeedComment, type FeedWorkout, type FeedWorkoutPage } from "./model";
import { z } from "zod";

// Select public identity only. Never serialize an AccountView or the workout payload.
const identity = `a.id as "userId", a.display_name as name, a.username as handle,
  case when a.avatar_object_key is not null or a.avatar_image is not null then '/api/social/avatar?id=' || a.id::text else null end as "avatarUrl"`;
const active = `a.is_banned=false and (a.is_suspended=false or a.suspended_until<=now())`;
const publicWorkoutPredicate = `w.is_public=true and w.completed_at is not null and ${active}`;

const feedPageSchema = z.object({
  tab: z.enum(["following", "discover"]).default("discover"),
  cursor: z.object({ updatedAt: z.string().datetime(), id: z.string().uuid(), ownerId: z.string().uuid() }).strict().nullable().optional(),
}).strict();

type FeedDbRow = {
  id: string; ownerId: string; cursorUpdatedAt: string; userId: string; name: string; handle: string; avatarUrl: string | null;
  title: string; completedAt: string; startedAt: string; exercises: { name: string; sets: number }[];
  volume: number | string; totalSets: number; prs: number; likes: number; comments: number; liked?: boolean; following?: boolean;
};

async function queryFeedRows(mode: "discover" | "following", viewerId: string | null, cursorUpdatedAt: string | null, cursorId: string | null, cursorOwnerId: string | null): Promise<FeedDbRow[]> {
  const { rows } = await getDatabasePool().query<FeedDbRow>(`
    with recent as (
      select w.id,w.account_id,w.name,w.started_at,w.completed_at,w.exercise_summary,w.updated_at,w.total_volume_kg,w.total_sets_count,w.prs_count,w.likes_count,w.comments_count
      from public.arcus_workouts w join public.arcus_accounts a on a.id=w.account_id
      where ${publicWorkoutPredicate}
        and ($2::text='discover' or exists(select 1 from public.arcus_follows f where f.follower_id=$1::uuid and f.following_id=w.account_id))
        and ($3::timestamptz is null or (w.updated_at,w.id,w.account_id)<($3::timestamptz,$4::uuid,$5::uuid))
      order by w.updated_at desc,w.id desc,w.account_id desc limit 21
    ) select w.id,w.account_id as "ownerId",w.updated_at::text as "cursorUpdatedAt",
      ${identity},w.name as title,w.completed_at::text as "completedAt",w.started_at::text as "startedAt",
      w.exercise_summary as exercises,
      w.total_volume_kg as volume,w.total_sets_count as "totalSets",w.prs_count as prs,
      w.likes_count as likes,w.comments_count as comments
    from recent w join public.arcus_accounts a on a.id=w.account_id
    order by w.updated_at desc,w.id desc,w.account_id desc
    `, [viewerId, mode, cursorUpdatedAt, cursorId, cursorOwnerId]);
  return rows;
}

const getCachedDiscoverRows = unstable_cache(
  (cursorUpdatedAt: string | null, cursorId: string | null, cursorOwnerId: string | null) => queryFeedRows("discover", null, cursorUpdatedAt, cursorId, cursorOwnerId),
  ["arcus-public-discover-feed-v2"],
  { revalidate: 30, tags: ["feed"] },
);

export async function getFeedWorkoutsPage(input: unknown = {}): Promise<FeedWorkoutPage> {
  const session = await auth();
  const { tab: mode, cursor = null } = feedPageSchema.parse(input);
  if (mode === "following" && !session) return { posts: [], nextCursor: null };
  const cursorArgs = [cursor?.updatedAt ?? null, cursor?.id ?? null, cursor?.ownerId ?? null] as const;
  const rows = mode === "discover"
    ? await getCachedDiscoverRows(...cursorArgs)
    : await queryFeedRows(mode, session!.id, ...cursorArgs);
  if (session && rows.length) {
    const owners = [...new Set(rows.map(row => row.ownerId))];
    const workoutIds = rows.map(row => row.id);
    const [likes, follows] = await Promise.all([
      getDatabasePool().query<{ workout_owner_id: string; workout_id: string }>("select workout_owner_id,workout_id from public.arcus_workout_likes where account_id=$1 and workout_owner_id=any($2::uuid[]) and workout_id=any($3::uuid[])", [session.id, owners, workoutIds]),
      getDatabasePool().query<{ following_id: string }>("select following_id from public.arcus_follows where follower_id=$1 and following_id=any($2::uuid[])", [session.id, owners]),
    ]);
    const likedKeys = new Set(likes.rows.map(row => `${row.workout_owner_id}:${row.workout_id}`));
    const followingIds = new Set(follows.rows.map(row => row.following_id));
    for (const row of rows) { row.liked = likedKeys.has(`${row.ownerId}:${row.id}`); row.following = followingIds.has(row.ownerId); }
  }
  const hasMore = rows.length > 20;
  const pageRows = rows.slice(0, 20);
  const last = pageRows.at(-1);
  const nextCursor = hasMore && last ? {
    updatedAt: new Date(last.cursorUpdatedAt).toISOString(), id: last.id, ownerId: last.ownerId,
  } : null;
  return { posts: pageRows.map(row => ({
    id: row.id,ownerId: row.ownerId,
    user: { id: row.userId,name: row.name,handle: row.handle,avatarUrl: row.avatarUrl,following: row.following ?? false },
    title: row.title,completedAt: row.completedAt,
    durationMinutes: Math.max(0,Math.round((Date.parse(row.completedAt)-Date.parse(row.startedAt))/60000)) || 0,
    volumeKg: Number(row.volume),exercises: row.exercises,totalSets: row.totalSets,prsCount: row.prs,likes: row.likes,comments: row.comments,liked: row.liked ?? false,
  })), nextCursor };
}

/** Backwards-compatible first-page loader for existing server callers. */
export async function getFeedWorkouts(tab: unknown = "discover"): Promise<FeedWorkout[]> {
  return (await getFeedWorkoutsPage({ tab })).posts;
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
  const pool = getDatabasePool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (data.liked) {
      const result = await client.query(`insert into public.arcus_workout_likes(workout_owner_id,workout_id,account_id)
        select w.account_id,w.id,$3 from public.arcus_workouts w join public.arcus_accounts a on a.id=w.account_id
        where w.account_id=$1 and w.id=$2 and ${publicWorkoutPredicate}
        on conflict (workout_owner_id,workout_id,account_id) do nothing returning workout_id`, [data.ownerId,data.workoutId,session.id]);
      if (result.rowCount) await client.query("update public.arcus_workouts set likes_count=likes_count+1 where id=$1 and account_id=$2", [data.workoutId,data.ownerId]);
    } else {
      const result = await client.query("delete from public.arcus_workout_likes where workout_owner_id=$1 and workout_id=$2 and account_id=$3 returning workout_id", [data.ownerId,data.workoutId,session.id]);
      if (result.rowCount) await client.query("update public.arcus_workouts set likes_count=greatest(0,likes_count-1) where id=$1 and account_id=$2", [data.workoutId,data.ownerId]);
    }
    await client.query("commit");
  } catch (error) { await client.query("rollback").catch(() => undefined); throw error; }
  finally { client.release(); }
  revalidateTag("feed");
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
  const pool = getDatabasePool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query(`insert into public.arcus_workout_comments(workout_owner_id,workout_id,account_id,body)
      select w.account_id,w.id,$3,$4 from public.arcus_workouts w join public.arcus_accounts a on a.id=w.account_id
      where w.account_id=$1 and w.id=$2 and ${publicWorkoutPredicate} returning id`, [data.ownerId,data.workoutId,session.id,data.text]);
    if (!result.rowCount) throw new Error("Workout unavailable.");
    await client.query("update public.arcus_workouts set comments_count=comments_count+1 where id=$1 and account_id=$2", [data.workoutId,data.ownerId]);
    await client.query("commit");
  } catch (error) { await client.query("rollback").catch(() => undefined); throw error; }
  finally { client.release(); }
  revalidateTag("feed");
}
export async function deleteWorkoutComment(input: unknown) {
  const session = await auth(); if (!session) throw new Error("Unauthorized");
  const id = z.string().uuid().parse(input);
  const pool = getDatabasePool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const owner = await client.query<{ account_id: string; workout_owner_id: string; workout_id: string }>("select account_id,workout_owner_id,workout_id from public.arcus_workout_comments where id=$1", [id]);
    if (owner.rows[0]?.account_id !== session.id) throw new Error("Unauthorized");
    const target = owner.rows[0];
    const deleted = await client.query("delete from public.arcus_workout_comments where id=$1 and account_id=$2 returning id", [id,session.id]);
    if (deleted.rowCount) await client.query("update public.arcus_workouts set comments_count=greatest(0,comments_count-1) where id=$1 and account_id=$2", [target.workout_id,target.workout_owner_id]);
    await client.query("commit");
  } catch (error) { await client.query("rollback").catch(() => undefined); throw error; }
  finally { client.release(); }
  revalidateTag("feed");
}
export async function setWorkoutVisibility(input: unknown) {
  const session = await auth(); if (!session) throw new Error("Unauthorized");
  const data = targetSchema.extend({ isPublic: z.boolean() }).parse(input);
  const pool = getDatabasePool();
  const owner = await pool.query("select account_id from public.arcus_workouts where id=$1 and account_id=$2", [data.workoutId,data.ownerId]);
  if (owner.rows[0]?.account_id !== session.id) throw new Error("Unauthorized");
  await pool.query("update public.arcus_workouts set is_public=$3 where id=$1 and account_id=$2", [data.workoutId,session.id,data.isPublic]);
  revalidateTag("feed");
}
