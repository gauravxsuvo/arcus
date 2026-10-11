import { NextResponse } from "next/server";
import { z } from "zod";
import { tokenHash } from "@/lib/auth/mfa";
import { ProfileInputError, readProfileBody } from "@/lib/auth/avatar";
import { getDatabasePool } from "@/lib/db/pool";

export const runtime = "nodejs";
const schema = z.object({ token: z.string().min(32).max(128) });

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await readProfileBody(request));
    if (!parsed.success) return NextResponse.json({ valid: false, error: "This reset link is invalid or has expired." }, { status: 400 });
    const result = await getDatabasePool().query<{ totp_enabled: boolean }>(
      `select a.totp_enabled from public.arcus_password_reset_tokens t
        join public.arcus_accounts a on a.id=t.account_id
       where t.token_hash=$1 and t.expires_at>now() and t.consumed_at is null and a.is_banned=false`, [tokenHash(parsed.data.token)],
    );
    if (!result.rows[0]) return NextResponse.json({ valid: false, error: "This reset link is invalid or has expired." }, { status: 410 });
    return NextResponse.json({ valid: true, requiresMfa: result.rows[0].totp_enabled });
  } catch (error) {
    if (error instanceof ProfileInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Could not validate this reset link." }, { status: 503 });
  }
}
