import { NextResponse } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { setSessionCookie } from "@/lib/auth/server";
import { verifyAuthentication } from "@/lib/auth/passkeys";
import { authenticationResponseSchema } from "@/lib/auth/input";
import { readProfileBody } from "@/lib/auth/avatar";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = authenticationResponseSchema.safeParse(await readProfileBody(request));
    if (!parsed.success) return NextResponse.json({ error:"Invalid passkey response." },{ status:400 });
    const body = parsed.data;
    if (typeof body.challengeId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.challengeId) || !body.response || typeof body.response !== "object") {
      return NextResponse.json({ error: "Passkey response is incomplete." }, { status: 400 });
    }
    const result = await verifyAuthentication(request, body.challengeId, body.response as AuthenticationResponseJSON);
    const response = NextResponse.json({ user: result.user });
    setSessionCookie(response, result.session.token, result.session.expiresAt);
    return response;
  } catch (error) {
    const message = error instanceof Error && /expired|could not sign in|could not be verified|unavailable/i.test(error.message) ? error.message : "Passkey sign-in failed. Try your password instead.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
