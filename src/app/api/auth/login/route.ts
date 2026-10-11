import { NextResponse } from "next/server";
import { clearSessionCookie, loginAccount, setSessionCookie } from "@/lib/auth/server";
import { loginSchema } from "@/lib/auth/input";
import { readProfileBody, ProfileInputError } from "@/lib/auth/avatar";
import { mfaChallengeCookieValue } from "@/lib/auth/mfa";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = loginSchema.safeParse(await readProfileBody(request));
    if (!parsed.success) return NextResponse.json({ error:"Enter a valid username and password." },{ status:400 });
    const { username,password } = parsed.data;
    if (!username || !password) return NextResponse.json({ error: "Enter your username and password." }, { status: 400 });
    const result = await loginAccount(username, password);
    if (result.mfaRequired) {
      const response = NextResponse.json({ mfaRequired: true }, { status: 202 });
      response.headers.append("Set-Cookie", mfaChallengeCookieValue(result.challenge.token, result.challenge.expiresAt));
      clearSessionCookie(response);
      return response;
    }
    const response = NextResponse.json({ user: result.user });
    setSessionCookie(response, result.session.token, result.session.expiresAt);
    return response;
  } catch (error) {
    if (error instanceof ProfileInputError) return NextResponse.json({ error:error.message },{ status:error.status });
    if (error instanceof Error && error.message === "Incorrect username or password.") return NextResponse.json({ error: error.message }, { status: 401 });
    console.error("Arcus login failed", error);
    return NextResponse.json({ error: "Account service is temporarily unavailable." }, { status: 503 });
  }
}
