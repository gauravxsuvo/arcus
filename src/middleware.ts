import { NextResponse, type NextRequest } from "next/server";
// API mutations are browser-only and same-origin. Server Actions retain Next's
// built-in origin check; login/signup must remain accessible without a session.
export function middleware(request: NextRequest) {
  if (["GET","HEAD","OPTIONS"].includes(request.method)) return NextResponse.next();
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? request.headers.get("host");
  let accepted = false;
  try { accepted = !!origin && new URL(origin).host === host && ["https:","http:"].includes(new URL(origin).protocol); } catch { /* invalid origin */ }
  if (!accepted) return NextResponse.json({ error:"Request origin was not accepted." },{ status:403 });
  return NextResponse.next();
}
export const config = { matcher:["/api/:path*"] };
