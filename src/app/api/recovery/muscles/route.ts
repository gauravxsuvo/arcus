import { NextResponse } from "next/server";
import { getCurrentAccountFromRequest } from "@/lib/auth/server";
import { getDatabasePool } from "@/lib/db/pool";
import { aggregateRecentMuscleActivity } from "@/features/recovery/muscle-history";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const account = await getCurrentAccountFromRequest(request);
    if (!account) return NextResponse.json({ error: "Sign in to view your recovery map." }, { status: 401 });
    const result = await getDatabasePool().query(
      `select payload from public.arcus_workouts
       where account_id = $1 and updated_at >= now() - interval '72 hours'
       order by updated_at desc limit 20`,
      [account.id],
    );
    return NextResponse.json({ muscles: aggregateRecentMuscleActivity(result.rows.map((row) => row.payload)) });
  } catch {
    return NextResponse.json({ error: "Recent muscle activity is temporarily unavailable." }, { status: 503 });
  }
}
