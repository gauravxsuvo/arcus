import { NextResponse } from "next/server";
import { z } from "zod";
import { ProfileInputError, readProfileBody } from "@/lib/auth/avatar";
import { clearMfaChallengeCookie, clearMfaFailures, completeMfaChallenge, getLiveMfaChallengeAccount, getRequestIp, isMfaRateLimited, mfaChallengeFromRequest } from "@/lib/auth/mfa";
import { createSessionForAccount, getAccountById, setSessionCookie } from "@/lib/auth/server";

export const runtime = "nodejs";
const codeSchema = z.object({ code: z.string().min(1).max(40) });

export async function POST(request: Request) {
  try {
    const parsed = codeSchema.safeParse(await readProfileBody(request));
    if (!parsed.success) return NextResponse.json({ error: "Enter your authenticator or recovery code." }, { status: 400 });
    const token = mfaChallengeFromRequest(request);
    if (!token) return NextResponse.json({ error: "Sign-in verification expired. Please sign in again." }, { status: 401 });
    const accountId = await getLiveMfaChallengeAccount(token);
    if (!accountId) return NextResponse.json({ error: "Sign-in verification expired. Please sign in again." }, { status: 401 });
    const ip = getRequestIp(request);
    if (await isMfaRateLimited("login", accountId, ip)) return NextResponse.json({ error: "Too many verification attempts. Try again in 15 minutes." }, { status: 429 });
    let verifiedAccountId: string;
    try { verifiedAccountId = await completeMfaChallenge(token, parsed.data.code); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not verify the code." }, { status: 401 }); }
    await clearMfaFailures("login", verifiedAccountId, ip);
    const user = await getAccountById(verifiedAccountId);
    if (!user) return NextResponse.json({ error: "This account is unavailable." }, { status: 401 });
    const session = await createSessionForAccount(verifiedAccountId);
    const response = NextResponse.json({ user });
    response.headers.append("Set-Cookie", clearMfaChallengeCookie());
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    if (error instanceof ProfileInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("ARCUS MFA sign-in verification failed", error);
    return NextResponse.json({ error: "Could not verify sign-in. Please try again." }, { status: 503 });
  }
}
