import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAccountFromRequest, getOwnerAccountFromRequest } from "@/lib/auth/admin";
import { ProfileInputError, readProfileBody } from "@/lib/auth/avatar";
import { getDatabasePool } from "@/lib/db/pool";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
const grantSchema = z.object({ email: z.string().trim().email().max(254) });
const revokeSchema = z.object({ accountId: z.string().uuid() });

function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers }); }

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
    if (!await getAdminAccountFromRequest(request)) return json({ error: "Admin access is required." }, 401);
    const owner = await getOwnerAccountFromRequest(request);
    if (!owner) return json({ error: "Only the platform owner can manage admin access." }, 403);
    const result = await getDatabasePool().query(`
      select g.account_id as "accountId", a.username, a.email, g.role,
        grantor.username as "grantedBy", g.granted_at as "grantedAt"
      from public.arcus_admin_access g
      join public.arcus_accounts a on a.id = g.account_id
      join public.arcus_accounts grantor on grantor.id = g.granted_by
      order by g.granted_at desc, a.email_normalized
    `);
    return json({ admins: result.rows });
  } catch { return json({ error: "Admin access list is temporarily unavailable." }, 503); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Request origin was not accepted." }, 403);
  try {
    const owner = await getOwnerAccountFromRequest(request);
    if (!owner) return json({ error: "Only the platform owner can grant admin access." }, 403);
    const parsed = grantSchema.safeParse(await readProfileBody(request));
    if (!parsed.success) return json({ error: "Enter a valid email address." }, 400);
    const email = parsed.data.email.toLowerCase();
    const result = await getDatabasePool().query<{ account_id: string; username: string; email: string; granted_at: string }>(`
      with target as (
        select id, email from public.arcus_accounts
        where email_normalized = $1 and id <> $2::uuid
      ), granted as (
        insert into public.arcus_admin_access (account_id, approved_email, granted_by, granted_at)
        select id, lower(email), $2::uuid, now() from target
        on conflict (account_id) do update set approved_email = excluded.approved_email,
          granted_by = excluded.granted_by, granted_at = excluded.granted_at
        returning account_id, approved_email, granted_by, granted_at
      ), audit as (
        insert into public.arcus_admin_access_audit (actor_id, target_account_id, target_email, action)
        select $2::uuid, account_id, approved_email, 'granted' from granted returning id
      ), main_audit as (
        insert into public.arcus_admin_audit(actor_id,actor_email,target_type,target_id,action)
        select $2::uuid,actor_user.email,'user',account_id::text,'admin_granted' from granted cross join public.arcus_accounts actor_user where actor_user.id=$2::uuid returning id
      )
      select g.account_id, a.username, a.email, g.role, g.granted_at
      from granted g join public.arcus_accounts a on a.id = g.account_id
    `, [email, owner.id]);
    if (!result.rows[0]) return json({ error: "No existing account has that email. They must create an ARCUS account first; access is bound to that account ID." }, 404);
    return json({ admin: result.rows[0], message: `Admin access granted to ${result.rows[0].email}.` }, 201);
  } catch (error) {
    if (error instanceof ProfileInputError) return json({ error: error.message }, error.status);
    return json({ error: "Admin access could not be granted." }, 503);
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Request origin was not accepted." }, 403);
  try {
    const owner = await getOwnerAccountFromRequest(request);
    if (!owner) return json({ error: "Only the platform owner can revoke admin access." }, 403);
    const parsed = revokeSchema.safeParse(await readProfileBody(request));
    if (!parsed.success) return json({ error: "Choose a valid admin account." }, 400);
    const result = await getDatabasePool().query<{ count: number }>(`
      with removed as (
        delete from public.arcus_admin_access
        where account_id = $1::uuid and account_id <> $2::uuid
        returning account_id, approved_email
      ), audit as (
        insert into public.arcus_admin_access_audit (actor_id, target_account_id, target_email, action)
        select $2::uuid, account_id, approved_email, 'revoked' from removed returning id
      ), main_audit as (
        insert into public.arcus_admin_audit(actor_id,actor_email,target_type,target_id,action)
        select $2::uuid,actor_user.email,'user',account_id::text,'admin_revoked' from removed cross join public.arcus_accounts actor_user where actor_user.id=$2::uuid returning id
      ) select count(*)::int as count from removed
    `, [parsed.data.accountId, owner.id]);
    if (!result.rows[0]?.count) return json({ error: "That admin account was not found." }, 404);
    return json({ ok: true, message: "Admin access revoked." });
  } catch (error) {
    if (error instanceof ProfileInputError) return json({ error: error.message }, error.status);
    return json({ error: "Admin access could not be revoked." }, 503);
  }
}
