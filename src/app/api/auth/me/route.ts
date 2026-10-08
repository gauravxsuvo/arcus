import { NextResponse } from "next/server";
import { getCurrentAccountFromRequest } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getCurrentAccountFromRequest(request);
    return user ? NextResponse.json({ user }) : NextResponse.json({ error: "Not signed in." }, { status: 401 });
  } catch (error) {
    console.error("Arcus session lookup failed", error);
    return NextResponse.json({ error: "Account service is temporarily unavailable." }, { status: 503 });
  }
}
