import { NextResponse } from "next/server";
import { z } from "zod";
import { ProfileInputError, readProfileBody } from "@/lib/auth/avatar";
import { clearMfaFailures, decryptTotpSecret, getRequestIp, isMfaRateLimited, matchBackupCode, verifyTotpCode } from "@/lib/auth/mfa";
import { getCurrentAccountFromRequest } from "@/lib/auth/server";
import { getDatabasePool } from "@/lib/db/pool";

export const runtime = "nodejs";
const codeSchema = z.object({ code: z.string().min(1).max(40) });

export async function POST(request: Request) {
  const client = await getDatabasePool().connect();
  const ip = getRequestIp(request);
  try {
    const account = await getCurrentAccountFromRequest(request);
    if (!account) return NextResponse.json({ error: "Sign in to manage account security." }, { status: 401 });
    const parsed = codeSchema.safeParse(await readProfileBody(request));
    if (!parsed.success) return NextResponse.json({ error: "Enter your authenticator or recovery code to turn off two-factor authentication." }, { status: 400 });
    if (await isMfaRateLimited("disable", account.id, ip)) return NextResponse.json({ error: "Too many verification attempts. Try again in 15 minutes." }, { status: 429 });
    await client.query("begin");
    const result = await client.query<{ totp_enabled: boolean; totp_secret_enc: string | null; totp_backup_codes: string[] }>(
      "select totp_enabled,totp_secret_enc,totp_backup_codes from public.arcus_accounts where id=$1 for update", [account.id],
    );
    const row = result.rows[0];
    if (!row?.totp_enabled || !row.totp_secret_enc) { await client.query("rollback"); return NextResponse.json({ error: "Two-factor authentication is already off." }, { status: 409 }); }
    const validTotp = await verifyTotpCode(decryptTotpSecret(row.totp_secret_enc), parsed.data.code);
    const backupIndex = validTotp ? -1 : await matchBackupCode(parsed.data.code, row.totp_backup_codes ?? []);
    if (!validTotp && backupIndex < 0) {
      await client.query("rollback");
      return NextResponse.json({ error: "That authenticator or recovery code is incorrect." }, { status: 401 });
    }
    await client.query("update public.arcus_accounts set totp_secret_enc=null,totp_enabled=false,totp_backup_codes='{}' where id=$1", [account.id]);
    await client.query("delete from public.arcus_mfa_setup where account_id=$1", [account.id]);
    await client.query("commit");
    await clearMfaFailures("disable", account.id, ip);
    return NextResponse.json({ enabled: false });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    if (error instanceof ProfileInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Could not disable ARCUS MFA", error);
    return NextResponse.json({ error: "Could not update two-factor authentication." }, { status: 503 });
  } finally { client.release(); }
}
