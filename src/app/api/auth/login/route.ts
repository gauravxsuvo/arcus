import { NextResponse } from "next/server";
import { loginAccount, setSessionCookie } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    if (!username || !password) return NextResponse.json({ error: "Enter your username and password." }, { status: 400 });
    const result = await loginAccount(username, password);
    const response = NextResponse.json({ user: result.user });
    setSessionCookie(response, result.session.token, result.session.expiresAt);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "Incorrect username or password.") return NextResponse.json({ error: error.message }, { status: 401 });
    console.error("Arcus login failed", error);
    return NextResponse.json({ error: "Account service is temporarily unavailable." }, { status: 503 });
  }
}
