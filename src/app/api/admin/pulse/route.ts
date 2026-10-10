import { NextResponse } from "next/server";
import { getAdminLivePulse } from "@/features/admin/repository";
import { getAdminAccountFromRequest } from "@/lib/auth/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    if (!await getAdminAccountFromRequest(request)) {
      return NextResponse.json({ error: "Owner access is required." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
    }
    const items = await getAdminLivePulse();
    return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch {
    return NextResponse.json({ error: "The live activity feed is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
