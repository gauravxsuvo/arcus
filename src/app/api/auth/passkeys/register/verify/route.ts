import { NextResponse } from "next/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { getCurrentAccountFromRequest } from "@/lib/auth/server";
import { verifyRegistration } from "@/lib/auth/passkeys";
import { registrationResponseSchema } from "@/lib/auth/input";
import { readProfileBody } from "@/lib/auth/avatar";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const account = await getCurrentAccountFromRequest(request);
    if (!account) return NextResponse.json({ error: "Sign in before adding a passkey." }, { status: 401 });
    const parsed = registrationResponseSchema.safeParse(await readProfileBody(request));
    if (!parsed.success) return NextResponse.json({ error:"Invalid passkey response." },{ status:400 });
    const body = parsed.data;
    if (typeof body.challengeId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.challengeId) || !body.response || typeof body.response !== "object") {
      return NextResponse.json({ error: "Passkey response is incomplete." }, { status: 400 });
    }
    await verifyRegistration(account, request, body.challengeId, body.response as RegistrationResponseJSON);
    return NextResponse.json({ registered: true });
  } catch (error) {
    const message = error instanceof Error && /expired|belongs to|verify|already exists/i.test(error.message) ? error.message : "Could not verify this passkey. Please try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
