import { NextResponse } from "next/server";
import { authenticationOptions } from "@/lib/auth/passkeys";
import { z } from "zod";
import { readProfileBody } from "@/lib/auth/avatar";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = z.object({ username:z.string().trim().max(32).optional() }).safeParse(await readProfileBody(request));
    if (!parsed.success) return NextResponse.json({ error:"Invalid username." },{ status:400 });
    const { username } = parsed.data;
    return NextResponse.json(await authenticationOptions(request, username));
  } catch (error) {
    const message = error instanceof Error && error.message.includes("No passkey") ? error.message : "Passkey sign-in is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: message.includes("No passkey") ? 404 : 503 });
  }
}
