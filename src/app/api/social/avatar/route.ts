import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabasePool } from "@/lib/db/pool";
import { signProfileAvatarGet } from "@/lib/storage/portways-s3";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get("id"));
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (!id.success) return new NextResponse(null,{ status:400,headers });
  try {
    const result = await getDatabasePool().query(`select avatar_object_key,avatar_image,avatar_mime_type from public.arcus_accounts
      where id=$1 and is_banned=false and (is_suspended=false or suspended_until<=now())`, [id.data]);
    const row = result.rows[0];
    if (row?.avatar_object_key) return NextResponse.redirect(await signProfileAvatarGet(row.avatar_object_key),{ headers });
    if (row?.avatar_image && ["image/png","image/jpeg","image/webp"].includes(row.avatar_mime_type)) return new NextResponse(new Uint8Array(row.avatar_image),{ headers:{...headers,"Content-Type":row.avatar_mime_type} });
    return new NextResponse(null,{ status:404,headers });
  } catch { return new NextResponse(null,{ status:503,headers }); }
}
