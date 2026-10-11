import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabasePool } from "@/lib/db/pool";
import { getRequestIp, isMfaRateLimited, makePasswordReset, revokePasswordReset } from "@/lib/auth/mfa";
import { sendPasswordResetEmail } from "@/lib/auth/mail";
import { readProfileBody, ProfileInputError } from "@/lib/auth/avatar";

export const runtime = "nodejs";
const requestSchema = z.object({ email: z.string().trim().email().max(254) });
const generic = { message: "If an ARCUS account matches that email, a reset link will be sent." };

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await readProfileBody(request));
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (await isMfaRateLimited("reset-request", "all-accounts", getRequestIp(request))) return NextResponse.json(generic);
    const result = await getDatabasePool().query<{ id: string; email: string }>(
      "select id,email from public.arcus_accounts where email_normalized=$1 and is_banned=false limit 1",
      [parsed.data.email.toLowerCase()],
    );
    if (result.rows[0]) {
      const reset = await makePasswordReset(result.rows[0].id);
      const base = process.env.SITE_URL?.trim() || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
      const url = new URL("/auth/reset-password", base);
      url.searchParams.set("token", reset.token);
      try { await sendPasswordResetEmail(result.rows[0].email, url.toString()); }
      catch (error) { await revokePasswordReset(reset.tokenHash); throw error; }
    }
    return NextResponse.json(generic);
  } catch (error) {
    if (error instanceof ProfileInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Password reset request failed", error);
    // Keep account existence and mail-provider configuration indistinguishable to callers.
    return NextResponse.json(generic);
  }
}
