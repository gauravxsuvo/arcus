import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAuthorizationFromRequest } from "@/lib/auth/admin";
import { ProfileInputError, readProfileBody } from "@/lib/auth/avatar";
import { getDatabasePool } from "@/lib/db/pool";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
const schema = z.object({ message: z.string().trim().max(240) });

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin"); if (!origin) return false;
  const url = new URL(request.url); const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? request.headers.get("host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().replace(/:$/, "") ?? url.protocol.replace(/:$/, "");
  return origin === `${proto}://${host}`;
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403, headers });
  try {
    const authorization = await getAdminAuthorizationFromRequest(request);
    if (!authorization) return NextResponse.json({ error: "Admin access is required." }, { status: 401, headers });
    if (authorization.role !== "OWNER") return NextResponse.json({ error: "Only the owner can publish a global announcement." }, { status: 403, headers });
    const parsed = schema.safeParse(await readProfileBody(request));
    if (!parsed.success) return NextResponse.json({ error: "Announcement must be 240 characters or fewer." }, { status: 400, headers });
    const message = parsed.data.message;
    await getDatabasePool().query(`
      with changed as (
        insert into public.arcus_platform_settings(setting_key,setting_value,updated_by,updated_at)
        values ('global_announcement',$1,$2::uuid,now())
        on conflict (setting_key) do update set setting_value=excluded.setting_value,updated_by=excluded.updated_by,updated_at=excluded.updated_at
        returning setting_value
      ), audit as (
        insert into public.arcus_admin_audit(actor_id,actor_email,target_type,target_id,action,details)
        select $2::uuid,$3,'settings','global_announcement','announcement_updated',jsonb_build_object('active',setting_value <> '') from changed returning id
      ) select setting_value from changed
    `, [message, authorization.account.id, authorization.account.email]);
    return NextResponse.json({ message, updated: true }, { headers });
  } catch (error) {
    if (error instanceof ProfileInputError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    return NextResponse.json({ error: "The announcement could not be saved." }, { status: 503, headers });
  }
}
