import { NextResponse } from "next/server";
import { getCurrentAccountFromRequest } from "@/lib/auth/server";
import { registrationOptions } from "@/lib/auth/passkeys";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const account = await getCurrentAccountFromRequest(request);
    if (!account) return NextResponse.json({ error: "Sign in before adding a passkey." }, { status: 401 });
    return NextResponse.json(await registrationOptions(account, request));
  } catch {
    return NextResponse.json({ error: "Could not start passkey setup. Check database configuration and try again." }, { status: 503 });
  }
}
