import { NextResponse } from "next/server";
import { getCurrentAccountFromRequest } from "@/lib/auth/server";
import { getDatabasePool } from "@/lib/db/pool";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const account = await getCurrentAccountFromRequest(request);
    if (!account) return NextResponse.json({ error: "Sign in to view your weight history." }, { status: 401 });
    const result = await getDatabasePool().query(
      "select date, weight, unit, notes, updated_at from public.arcus_weight_logs where account_id = $1 order by date desc limit 400",
      [account.id],
    );
    return NextResponse.json({ logs: result.rows.map((row) => ({ date: row.date, weight: Number(row.weight), unit: row.unit, notes: row.notes, updatedAt: row.updated_at })) });
  } catch {
    return NextResponse.json({ error: "Weight history is temporarily unavailable." }, { status: 503 });
  }
}
