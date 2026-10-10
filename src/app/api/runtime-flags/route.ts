import { NextResponse } from "next/server";
import { getPublicRuntimeSettings } from "@/features/admin/runtime-flags";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getPublicRuntimeSettings(), {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=5, stale-while-revalidate=10" },
  });
}
