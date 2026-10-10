import { NextResponse } from "next/server";
import { getCurrentAccountFromRequest, getCurrentAccountAvatarObjectKey } from "@/lib/auth/server";
import { signProfileAvatarGet } from "@/lib/storage/portways-s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const account = await getCurrentAccountFromRequest(request);
  if (!account) return new NextResponse(null, { status: 401, headers: { "Cache-Control": "private, no-store" } });

  try {
    const key = await getCurrentAccountAvatarObjectKey(account.id);
    if (!key) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    const signedUrl = await signProfileAvatarGet(key);
    return NextResponse.redirect(signedUrl, { status: 302, headers: { "Cache-Control": "private, max-age=240", Vary: "Cookie" } });
  } catch {
    return NextResponse.json({ error: "Could not load your profile photo." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
