import { NextResponse } from "next/server";
import { clearSessionCookie, logoutCurrentAccount, getCurrentAccountFromRequest } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await getCurrentAccountFromRequest(request);
    if (!session) { const response=NextResponse.json({ ok:true }); clearSessionCookie(response); return response; }
    await logoutCurrentAccount(request);
  } catch { return NextResponse.json({ error:"Could not sign out." },{ status:503 }); }
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
