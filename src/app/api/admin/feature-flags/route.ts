import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFeatureFlags } from "@/features/admin/repository";
import { getAdminAccountFromRequest, getAdminAuthorizationFromRequest } from "@/lib/auth/admin";
import { ProfileInputError, readProfileBody } from "@/lib/auth/avatar";
import { getDatabasePool } from "@/lib/db/pool";

export const runtime = "nodejs";

const schema = z.object({ key: z.enum(["social_feed", "pro_tier", "maintenance_mode"]), enabled: z.boolean() });
const headers = { "Cache-Control": "private, no-store, max-age=0" };

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? request.headers.get("host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().replace(/:$/, "") ?? url.protocol.replace(/:$/, "");
  return origin === `${proto}://${host}`;
}

export async function GET(request: Request) {
  try {
    if (!await getAdminAccountFromRequest(request)) return NextResponse.json({ error: "Owner access is required." }, { status: 401, headers });
    return NextResponse.json(await getAdminFeatureFlags(), { headers });
  } catch {
    return NextResponse.json({ error: "Feature controls are temporarily unavailable." }, { status: 503, headers });
  }
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403, headers });
  try {
    const authorization = await getAdminAuthorizationFromRequest(request);
    if (!authorization) return NextResponse.json({ error: "Admin access is required." }, { status: 401, headers });
    if (authorization.role !== "OWNER") return NextResponse.json({ error: "Only the owner can change platform feature flags." }, { status: 403, headers });
    const parsed = schema.safeParse(await readProfileBody(request));
    if (!parsed.success) return NextResponse.json({ error: "Choose a valid feature flag and state." }, { status: 400, headers });
    const { key, enabled } = parsed.data;
    const result = await getDatabasePool().query<{ enabled: boolean; updated_at: string }>(`
      with changed as (
      insert into public.arcus_feature_flags (flag_key, enabled, updated_by, updated_at)
      values ($1, $2, $3::uuid, now())
      on conflict (flag_key) do update set enabled = excluded.enabled,
        updated_by = excluded.updated_by, updated_at = excluded.updated_at
      returning enabled, updated_at
      ), audit as (
        insert into public.arcus_admin_audit(actor_id,actor_email,target_type,target_id,action,details)
        select $3::uuid,$4,'settings',$1,'feature_flag_updated',jsonb_build_object('enabled',$2::boolean) from changed returning id
      ) select * from changed
    `, [key, enabled, authorization.account.id, authorization.account.email]);
    return NextResponse.json({ key, ...result.rows[0] }, { headers });
  } catch (error) {
    if (error instanceof ProfileInputError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    return NextResponse.json({ error: "The feature setting could not be saved." }, { status: 503, headers });
  }
}
