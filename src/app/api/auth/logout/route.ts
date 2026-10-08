import { NextResponse } from "next/server";
import { clearSessionCookie, logoutCurrentAccount } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try { await logoutCurrentAccount(request); } catch (error) { console.error("Arcus logout failed", error); }
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
