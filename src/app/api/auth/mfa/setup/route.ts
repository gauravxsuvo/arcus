import { NextResponse } from "next/server";
import type { PoolClient } from "@neondatabase/serverless";
import QRCode from "qrcode";
import { z } from "zod";
import { getCurrentAccountFromRequest } from "@/lib/auth/server";
import { getDatabasePool } from "@/lib/db/pool";
import { clearMfaFailures, createBackupCodes, decryptTotpSecret, encryptTotpSecret, hashBackupCodes, isMfaRateLimited, newTotpSecret, totpUri, verifyTotpCode } from "@/lib/auth/mfa";
import { ProfileInputError, readProfileBody } from "@/lib/auth/avatar";

export const runtime = "nodejs";
const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/) });

export async function GET(request: Request) {
  const account = await getCurrentAccountFromRequest(request);
  if (!account) return NextResponse.json({ error: "Sign in to manage account security." }, { status: 401 });
  const result = await getDatabasePool().query<{ totp_enabled: boolean }>("select totp_enabled from public.arcus_accounts where id=$1", [account.id]);
  return NextResponse.json({ enabled: result.rows[0]?.totp_enabled ?? false });
}

export async function POST(request: Request) {
  try {
    const account = await getCurrentAccountFromRequest(request);
    if (!account) return NextResponse.json({ error: "Sign in to manage account security." }, { status: 401 });
    const current = await getDatabasePool().query<{ totp_enabled: boolean }>("select totp_enabled from public.arcus_accounts where id=$1", [account.id]);
    if (current.rows[0]?.totp_enabled) return NextResponse.json({ error: "Two-factor authentication is already enabled." }, { status: 409 });
    const secret = newTotpSecret();
    const uri = totpUri(account.email, secret);
    const qrCode = await QRCode.toDataURL(uri, { errorCorrectionLevel: "H", margin: 1, width: 256, color: { dark: "#09090b", light: "#ffffff" } });
    await getDatabasePool().query(
      `insert into public.arcus_mfa_setup(account_id,secret_enc,expires_at)
       values($1,$2,now()+interval '10 minutes')
       on conflict(account_id) do update set secret_enc=excluded.secret_enc,expires_at=excluded.expires_at,created_at=now()`,
      [account.id, encryptTotpSecret(secret)],
    );
    return NextResponse.json({ qrCode, manualKey: secret, expiresInSeconds: 600 });
  } catch (error) {
    if (error instanceof ProfileInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Could not start ARCUS MFA setup", error);
    return NextResponse.json({ error: "Could not start authenticator setup. Check security configuration and try again." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  let client: PoolClient | undefined;
  try {
    const account = await getCurrentAccountFromRequest(request);
    if (!account) return NextResponse.json({ error: "Sign in to manage account security." }, { status: 401 });
    const parsed = codeSchema.safeParse(await readProfileBody(request));
    if (!parsed.success) return NextResponse.json({ error: "Enter the current six-digit authenticator code." }, { status: 400 });
    const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ?? "unknown";
    if (await isMfaRateLimited("enroll", account.id, ip)) return NextResponse.json({ error: "Too many code attempts. Try again in 15 minutes." }, { status: 429 });
    client = await getDatabasePool().connect();
    await client.query("begin");
    const pending = await client.query<{ secret_enc: string }>("select secret_enc from public.arcus_mfa_setup where account_id=$1 and expires_at>now() for update", [account.id]);
    if (!pending.rows[0]) { await client.query("rollback"); return NextResponse.json({ error: "Authenticator setup expired. Start again." }, { status: 410 }); }
    if (!await verifyTotpCode(decryptTotpSecret(pending.rows[0].secret_enc), parsed.data.code)) {
      await client.query("rollback");
      return NextResponse.json({ error: "That authenticator code is incorrect." }, { status: 401 });
    }
    const codes = createBackupCodes();
    const hashes = await hashBackupCodes(codes);
    const enabled = await client.query(
      `update public.arcus_accounts set totp_secret_enc=$2,totp_enabled=true,totp_backup_codes=$3
       where id=$1 and totp_enabled=false returning id`, [account.id, pending.rows[0].secret_enc, hashes],
    );
    if (!enabled.rows[0]) { await client.query("rollback"); return NextResponse.json({ error: "Two-factor authentication is already enabled." }, { status: 409 }); }
    await client.query("delete from public.arcus_mfa_setup where account_id=$1", [account.id]);
    await client.query("commit");
    await clearMfaFailures("enroll", account.id, ip);
    return NextResponse.json({ enabled: true, backupCodes: codes });
  } catch (error) {
    await client?.query("rollback").catch(() => undefined);
    if (error instanceof ProfileInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Could not enable ARCUS MFA", error);
    return NextResponse.json({ error: "Could not enable two-factor authentication." }, { status: 503 });
  } finally { client?.release(); }
}

