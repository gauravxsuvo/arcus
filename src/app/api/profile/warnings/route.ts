import { NextResponse } from "next/server";
import { getCurrentAccountFromRequest } from "@/lib/auth/server";
import { getDatabasePool } from "@/lib/db/pool";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const account = await getCurrentAccountFromRequest(request);
    if (!account) return NextResponse.json({ warnings: [] }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
    const result = await getDatabasePool().query<{ id: string; message: string; actor_email: string; created_at: string }>(
      "select id,message,actor_email,created_at from public.arcus_user_warnings where account_id=$1::uuid order by created_at desc limit 20",
      [account.id],
    );
    return NextResponse.json({ warnings: result.rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Your account notices are temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
