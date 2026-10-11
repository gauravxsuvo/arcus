import { NextResponse } from "next/server";
import type { PoolClient } from "@neondatabase/serverless";
import { z } from "zod";
import { getDatabasePool } from "@/lib/db/pool";
import { hashPassword } from "@/lib/auth/password";
import { ProfileInputError, readProfileBody } from "@/lib/auth/avatar";
import { clearMfaFailures, decryptTotpSecret, getRequestIp, isMfaRateLimited, matchBackupCode, tokenHash, verifyTotpCode } from "@/lib/auth/mfa";

export const runtime = "nodejs";
const resetSchema = z.object({ token: z.string().min(32).max(128), password: z.string().min(10).max(128), confirmPassword: z.string().min(10).max(128), code: z.string().max(40).optional() }).refine((value) => value.password === value.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });

export async function POST(request: Request) {
  let client: PoolClient | undefined;
  try {
    const parsed = resetSchema.safeParse(await readProfileBody(request));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Enter a valid password and reset code." }, { status: 400 });
    client = await getDatabasePool().connect();
    const { token, password, code } = parsed.data;
    const ip = getRequestIp(request);
    await client.query("begin");
    const tokenResult = await client.query<{ id: string; account_id: string; totp_enabled: boolean; totp_secret_enc: string | null; totp_backup_codes: string[] }>(
      `select t.id,t.account_id,a.totp_enabled,a.totp_secret_enc,a.totp_backup_codes
         from public.arcus_password_reset_tokens t join public.arcus_accounts a on a.id=t.account_id
        where t.token_hash=$1 and t.expires_at>now() and t.consumed_at is null and a.is_banned=false
        for update of t,a`, [tokenHash(token)],
    );
    const row = tokenResult.rows[0];
    if (!row) { await client.query("rollback"); return NextResponse.json({ error: "This reset link is invalid or has expired. Request a new link." }, { status: 410 }); }
    if (row.totp_enabled) {
      if (await isMfaRateLimited("password-reset", row.account_id, ip)) { await client.query("rollback"); return NextResponse.json({ error: "Too many verification attempts. Try again in 15 minutes." }, { status: 429 }); }
      if (!code || !row.totp_secret_enc) { await client.query("rollback"); return NextResponse.json({ error: "Enter an authenticator or recovery code to reset this account." }, { status: 400 }); }
      let valid = await verifyTotpCode(decryptTotpSecret(row.totp_secret_enc), code);
      let backupIndex = -1;
      if (!valid) backupIndex = await matchBackupCode(code, row.totp_backup_codes ?? []);
      valid ||= backupIndex >= 0;
      if (!valid) { await client.query("rollback"); return NextResponse.json({ error: "That authenticator or recovery code is incorrect." }, { status: 401 }); }
      if (backupIndex >= 0) {
        const remaining = row.totp_backup_codes.filter((_, index) => index !== backupIndex);
        await client.query("update public.arcus_accounts set totp_backup_codes=$2 where id=$1", [row.account_id, remaining]);
      }
    }
    const passwordHash = await hashPassword(password);
    await client.query("update public.arcus_accounts set password_hash=$2,updated_at=now() where id=$1", [row.account_id, passwordHash]);
    await client.query("delete from public.arcus_sessions where account_id=$1", [row.account_id]);
    await client.query("update public.arcus_password_reset_tokens set consumed_at=now() where id=$1", [row.id]);
    await client.query("delete from public.arcus_mfa_challenges where account_id=$1", [row.account_id]);
    await client.query("commit");
    await clearMfaFailures("password-reset", row.account_id, ip);
    const response = NextResponse.json({ message: "Password updated. Sign in again on your devices." });
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    response.headers.append("Set-Cookie", `arcus_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
    response.headers.append("Set-Cookie", `arcus_mfa_challenge=; Path=/api/auth/mfa; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
    return response;
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    if (error instanceof ProfileInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Password reset failed", error);
    return NextResponse.json({ error: "Password could not be reset. Please try again." }, { status: 503 });
  } finally { client?.release(); }
}

