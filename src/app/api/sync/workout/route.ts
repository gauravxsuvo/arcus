import { NextResponse } from "next/server";
import { getCurrentAccountFromRequest } from "@/lib/auth/server";
import { getDatabasePool } from "@/lib/db/pool";
import { workoutSchema } from "@/features/import-export/restore-schema";
import { ProfileInputError, readProfileBody } from "@/lib/auth/avatar";
import { calculateWorkoutTotals, type WorkoutRecord } from "@/features/workouts/model";
import { detectRecords } from "@/features/training/logic";
import { revalidateTag } from "next/cache";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const account = await getCurrentAccountFromRequest(request);
    if (!account) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const parsed = workoutSchema.safeParse(await readProfileBody(request));
    if (!parsed.success || parsed.data.status !== "completed" || !parsed.data.completedAt || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(parsed.data.id)) return NextResponse.json({ error: "A valid completed workout with a UUID is required." }, { status: 400 });
    const workout=parsed.data;
    const db = getDatabasePool();
    const totals = calculateWorkoutTotals(workout);
    const prior = await db.query<{ payload: WorkoutRecord }>(
      "select payload from public.arcus_workouts where account_id=$1 and payload->>'status'='completed' and id<>$2",
      [account.id, workout.id],
    );
    const prsCount = detectRecords([...prior.rows.map(row => row.payload), workout]).filter(record => record.workoutId === workout.id).length;
    const exerciseSummary = workout.exercises.map(exercise => ({ name: exercise.name, sets: exercise.sets.filter(set => set.completed).length }));
    const result=await getDatabasePool().query(
      `insert into public.arcus_workouts (id, account_id, payload, updated_at, name, started_at, completed_at, exercise_summary, total_volume_kg, total_sets_count, prs_count)
       values ($1, $2, $3::jsonb, coalesce($4::timestamptz, now()), $5, $6::timestamptz, $7::timestamptz, $8::jsonb, $9, $10, $11)
       on conflict (id, account_id) do update set payload = excluded.payload, updated_at = excluded.updated_at,
         name=excluded.name,started_at=excluded.started_at,completed_at=excluded.completed_at,exercise_summary=excluded.exercise_summary,
         total_volume_kg=excluded.total_volume_kg,total_sets_count=excluded.total_sets_count,prs_count=excluded.prs_count
       where excluded.updated_at >= arcus_workouts.updated_at returning id`,
      [workout.id, account.id, JSON.stringify(workout), typeof workout.updatedAt === "string" ? workout.updatedAt : null, workout.name, workout.startedAt, workout.completedAt, JSON.stringify(exerciseSummary), totals.volume, totals.sets, prsCount],
    );
    if (result.rowCount === 1) revalidateTag("feed");
    return NextResponse.json({ ok: true, accepted:result.rowCount===1 });
  } catch (error) {
    if(error instanceof ProfileInputError)return NextResponse.json({error:error.message},{status:error.status});
    return NextResponse.json({ error: "Could not sync workout." }, { status: 503 });
  }
}

export async function GET(request:Request) {
  try {
    const account=await getCurrentAccountFromRequest(request);if(!account)return NextResponse.json({error:"Not signed in."},{status:401});
    const value=Number(new URL(request.url).searchParams.get("offset"))||0;
    const offset=Math.floor(Math.max(0,Math.min(100000,value)));
    const result=await getDatabasePool().query("select payload from public.arcus_workouts where account_id=$1 order by id limit 10 offset $2",[account.id,offset]);
    return NextResponse.json({workouts:result.rows.map(row=>row.payload),nextOffset:result.rows.length===10?offset+10:null});
  }catch{return NextResponse.json({error:"Workout lookup unavailable."},{status:503});}
}
