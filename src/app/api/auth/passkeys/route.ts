import { NextResponse } from "next/server";
import { deletePasskey, listPasskeys } from "@/lib/auth/passkeys";
import { getCurrentAccountFromRequest } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const account = await getCurrentAccountFromRequest(request);
    if (!account) return NextResponse.json({ error: "Sign in before managing passkeys." }, { status: 401 });
    return NextResponse.json({ passkeys: await listPasskeys(account.id) });
  } catch {
    return NextResponse.json({ error: "Passkeys are temporarily unavailable." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  try {
    const account = await getCurrentAccountFromRequest(request);
    if (!account) return NextResponse.json({ error: "Sign in before managing passkeys." }, { status: 401 });
    const body = await request.json() as { id?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Choose a valid passkey." }, { status: 400 });
    if (!await deletePasskey(account.id, id)) return NextResponse.json({ error: "That passkey could not be found." }, { status: 404 });
    return NextResponse.json({ removed: true });
  } catch {
    return NextResponse.json({ error: "Could not remove the passkey." }, { status: 503 });
  }
}
