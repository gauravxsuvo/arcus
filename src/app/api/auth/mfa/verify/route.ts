import { NextResponse } from "next/server";
import { getDatabasePool } from "@/lib/db/pool";
import { getCurrentAccount } from "@/lib/auth/server";
import { verify } from "otplib";

export async function POST(request: Request) {
  try {
    const { token, secret } = await request.json();
    if (!token || !secret) {
      return NextResponse.json({ error: "Missing token or secret" }, { status: 400 });
    }

    const user = await getCurrentAccount();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const pool = getDatabasePool();

    const result = await verify({ token, secret });
    if (!result.valid) {
      return NextResponse.json({ error: "Invalid MFA code" }, { status: 400 });
    }

    // Save secret to database
    await pool.query(
      `UPDATE public.arcus_accounts SET mfa_secret = $1 WHERE id = $2`,
      [secret, user.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("MFA Verify Error:", error);
    return NextResponse.json({ error: "Failed to verify MFA" }, { status: 500 });
  }
}

