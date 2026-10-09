import { NextResponse } from "next/server";
import { getDatabasePool } from "@/lib/db/pool";
import { verify } from "otplib";
import { hashPassword } from "@/lib/auth/password";

export async function POST(request: Request) {
  try {
    const { email, code, newPassword } = await request.json();
    
    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const pool = getDatabasePool();
    
    // Find user by normalized email (or username)
    const normalizedEmail = email.trim().toLowerCase();
    const result = await pool.query(
      `SELECT id, mfa_secret FROM public.arcus_accounts 
       WHERE email_normalized = $1 OR username_normalized = $1`,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      // Don't leak whether user exists, just say invalid
      return NextResponse.json({ error: "Invalid request or MFA code." }, { status: 400 });
    }

    const user = result.rows[0];
    
    if (!user.mfa_secret) {
      return NextResponse.json({ error: "MFA is not enabled for this account." }, { status: 400 });
    }

    const verifyResult = await verify({ token: code, secret: user.mfa_secret });
    
    if (!verifyResult.valid) {
      return NextResponse.json({ error: "Invalid MFA code." }, { status: 400 });
    }

    // Hash the new password and update
    const passwordHash = await hashPassword(newPassword);
    
    await pool.query(
      `UPDATE public.arcus_accounts SET password_hash = $1 WHERE id = $2`,
      [passwordHash, user.id]
    );

    // Optionally delete all existing sessions
    await pool.query(`DELETE FROM public.arcus_sessions WHERE account_id = $1`, [user.id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return NextResponse.json({ error: "Failed to reset password." }, { status: 500 });
  }
}

