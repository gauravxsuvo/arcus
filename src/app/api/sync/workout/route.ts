import { NextResponse } from "next/server";
import { getCurrentAccountFromRequest } from "@/lib/auth/server";
import { getDatabasePool } from "@/lib/db/pool";
import { workoutSchema } from "@/features/import-export/restore-schema";
import { ProfileInputError, readProfileBody } from "@/lib/auth/avatar";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const account = await getCurrentAccountFromRequest(request);
    if (!account) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const parsed = workoutSchema.safeParse(await readProfileBody(request));
    if (!parsed.success || parsed.data.status !== "completed" || !parsed.data.completedAt || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(parsed.data.id)) return NextResponse.json({ error: "A valid completed workout with a UUID is required." }, { status: 400 });
    const workout=parsed.data;
    const result=await getDatabasePool().query(
      `insert into public.arcus_workouts (id, account_id, payload, updated_at)
       values ($1, $2, $3::jsonb, coalesce($4::timestamptz, now()))
       on conflict (id, account_id) do update set payload = excluded.payload, updated_at = excluded.updated_at
       where excluded.updated_at >= arcus_workouts.updated_at returning id`,
      [workout.id, account.id, JSON.stringify(workout), typeof workout.updatedAt === "string" ? workout.updatedAt : null],
    );
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
