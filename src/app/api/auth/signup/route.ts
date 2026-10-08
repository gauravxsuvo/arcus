import { NextResponse } from "next/server";
import { isUniqueViolation, registerAccount, setSessionCookie } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const username = String(body.username ?? "").trim();
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    const name = String(body.name ?? "").trim();
    if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) return NextResponse.json({ error: "Use 3–32 letters, numbers, or underscores for your username." }, { status: 400 });
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "Use a password with at least 8 characters." }, { status: 400 });
    if (!name || name.length > 80) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
    const result = await registerAccount({ username, email, password, name });
    const response = NextResponse.json({ user: result.user }, { status: 201 });
    setSessionCookie(response, result.session.token, result.session.expiresAt);
    return response;
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ error: "That username or email is already registered." }, { status: 409 });
    console.error("Arcus signup failed", error);
    return NextResponse.json({ error: "Account service is temporarily unavailable." }, { status: 503 });
  }
}
