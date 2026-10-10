import { NextResponse } from "next/server";
import { authenticationOptions } from "@/lib/auth/passkeys";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { username?: unknown };
    const username = typeof body.username === "string" ? body.username : undefined;
    return NextResponse.json(await authenticationOptions(request, username));
  } catch (error) {
    const message = error instanceof Error && error.message.includes("No passkey") ? error.message : "Passkey sign-in is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: message.includes("No passkey") ? 404 : 503 });
  }
}
