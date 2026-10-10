import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAuthorizationFromRequest } from "@/lib/auth/admin";
import { ProfileInputError, readProfileBody } from "@/lib/auth/avatar";
import { getDatabasePool } from "@/lib/db/pool";

export const runtime = "nodejs";
const uuid = z.string().uuid();
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("user.update"), userId: uuid, username: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9_]+$/), email: z.string().trim().email().max(254), name: z.string().trim().min(1).max(80) }),
  z.object({ action: z.literal("user.warn"), userId: uuid, message: z.string().trim().min(1).max(500) }),
  z.object({ action: z.literal("user.suspend"), userId: uuid }),
  z.object({ action: z.literal("user.unsuspend"), userId: uuid }),
  z.object({ action: z.literal("user.ban"), userId: uuid }),
  z.object({ action: z.literal("user.unban"), userId: uuid }),
  z.object({ action: z.literal("exercise.update"), accountId: uuid, exerciseId: z.string().min(1).max(100), name: z.string().trim().min(1).max(200), muscle: z.string().trim().min(1).max(100), equipment: z.string().trim().min(1).max(100) }),
  z.object({ action: z.literal("exercise.delete"), accountId: uuid, exerciseId: z.string().min(1).max(100) }),
]);

function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } }); }
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin"); if (!origin) return false;
  const url = new URL(request.url); const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return origin === `${forwardedProto ? `${forwardedProto.replace(/:$/, "")}:` : url.protocol}//${forwardedHost ?? request.headers.get("host") ?? url.host}`;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Request origin was not accepted." }, 403);
  try {
    const authorization = await getAdminAuthorizationFromRequest(request);
    if (!authorization) return json({ error: "Admin access is required." }, 401);
    const { account: actor, role } = authorization;
    const parsed = actionSchema.safeParse(await readProfileBody(request));
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Check the submitted fields." }, 400);
    const pool = getDatabasePool();
    const ownerId = process.env.ARCUS_ADMIN_ACCOUNT_ID!;

    switch (parsed.data.action) {
      case "user.update": {
        const input = parsed.data;
        const result = await pool.query<{ count: number }>(`
          with updated as (
            update public.arcus_accounts a
            set username = $3, username_normalized = lower($3), email = $4,
                email_normalized = lower($4), display_name = $5, updated_at = now()
            where a.id = $1::uuid and a.id <> $6::uuid
              and ($7::text = 'OWNER' or not exists (select 1 from public.arcus_admin_access g where g.account_id = a.id))
            returning a.id
          ), audit as (
            insert into public.arcus_admin_audit(actor_id,actor_email,target_type,target_id,action,details)
            select $2::uuid,$8,'user',id::text,'user_updated',jsonb_build_object('fields',jsonb_build_array('username','email','name')) from updated returning id
          ) select count(*)::int as count from updated
        `, [input.userId, actor.id, input.username, input.email, input.name, ownerId, role, actor.email]);
        if (!result.rows[0]?.count) return json({ error: "User not found or this account is protected at your role level." }, 404);
        return json({ ok: true, message: "User details saved." });
      }
      case "user.warn": {
        const input = parsed.data;
        const result = await pool.query<{ count: number }>(`
          with target as (
            select a.id from public.arcus_accounts a where a.id = $1::uuid and a.id <> $5::uuid
              and ($6::text = 'OWNER' or not exists (select 1 from public.arcus_admin_access g where g.account_id = a.id))
          ), warning as (
            insert into public.arcus_user_warnings(account_id,actor_id,actor_email,message)
            select id,$2::uuid,$4,$3 from target returning id,account_id
          ), audit as (
            insert into public.arcus_admin_audit(actor_id,actor_email,target_type,target_id,action,details)
            select $2::uuid,$4,'user',account_id::text,'user_warned',jsonb_build_object('warningId',id) from warning returning id
          ) select count(*)::int as count from warning
        `, [input.userId, actor.id, input.message, actor.email, ownerId, role]);
        if (!result.rows[0]?.count) return json({ error: "User not found or this account is protected at your role level." }, 404);
        return json({ ok: true, message: "Warning recorded and visible on the user profile." });
      }
      case "user.suspend": case "user.unsuspend": case "user.ban": case "user.unban": {
        const input = parsed.data; const action = input.action;
        const isSuspend = action === "user.suspend"; const isUnsuspend = action === "user.unsuspend";
        const isBan = action === "user.ban"; const isUnban = action === "user.unban";
        const result = await pool.query<{ updated: number; revoked: number }>(`
          with changed as (
            update public.arcus_accounts a set
              is_banned = case when $3 then true when $4 then false else a.is_banned end,
              is_suspended = case when $5 then true when $6 then false when $3 or $4 then false else a.is_suspended end,
              suspended_until = case when $5 then now() + interval '7 days' when $6 or $3 or $4 then null else a.suspended_until end,
              suspension_reason = case when $5 then 'Temporary administrative suspension' when $6 or $3 or $4 then null else a.suspension_reason end,
              updated_at = now()
            where a.id = $1::uuid and a.id <> $7::uuid
              and ($8::text = 'OWNER' or not exists (select 1 from public.arcus_admin_access g where g.account_id = a.id))
            returning a.id
          ), revoked as (
            delete from public.arcus_sessions where account_id in (select id from changed) returning id
          ), audit as (
            insert into public.arcus_admin_audit(actor_id,actor_email,target_type,target_id,action,details)
            select $2::uuid,$9,'user',id::text,$10,jsonb_build_object('durationDays',case when $5 then 7 else null end,'revokedSessions',(select count(*) from revoked)) from changed returning id
          ) select (select count(*)::int from changed) as updated,(select count(*)::int from revoked) as revoked
        `, [input.userId, actor.id, isBan, isUnban, isSuspend, isUnsuspend, ownerId, role, actor.email,
          isBan ? "user_banned" : isUnban ? "user_unbanned" : isSuspend ? "user_suspended" : "user_unsuspended"]);
        if (!result.rows[0]?.updated) return json({ error: "User not found or this account is protected at your role level." }, 404);
        return json({ ok: true, message: isBan ? "User permanently banned and signed out." : isUnban ? "User access restored." : isSuspend ? "User suspended for 7 days and signed out." : "Suspension lifted and access restored." });
      }
      case "exercise.update": case "exercise.delete": {
        if (role !== "OWNER") return json({ error: "Only the owner can manage the shared exercise database." }, 403);
        if (parsed.data.action === "exercise.update") {
          const input = parsed.data;
          const result = await pool.query<{ count: number }>(`
            with changed as (
              update public.arcus_library set payload = payload || jsonb_build_object('name',$3::text,'muscle',$4::text,'equipment',$5::text,'updatedAt',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),updated_at=now()
              where account_id=$1::uuid and id=$2 and kind='exercise' and payload->>'deleted' is distinct from 'true' returning account_id,id
            ), audit as (
              insert into public.arcus_admin_audit(actor_id,actor_email,target_type,target_id,action,details)
              select $6::uuid,$7,'exercise',concat(account_id,'/',id),'exercise_updated',jsonb_build_object('fields',jsonb_build_array('name','muscle','equipment')) from changed returning id
            ) select count(*)::int as count from changed
          `, [input.accountId,input.exerciseId,input.name,input.muscle,input.equipment,actor.id,actor.email]);
          if (!result.rows[0]?.count) return json({ error: "Custom exercise not found." }, 404);
          return json({ ok: true, message: "Exercise details saved." });
        }
        const input = parsed.data;
        const result = await pool.query<{ count: number }>(`
          with changed as (
            update public.arcus_library set payload=payload||jsonb_build_object('deleted',true,'updatedAt',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),updated_at=now()
            where account_id=$1::uuid and id=$2 and kind='exercise' and payload->>'deleted' is distinct from 'true' returning account_id,id
          ), audit as (
            insert into public.arcus_admin_audit(actor_id,actor_email,target_type,target_id,action)
            select $3::uuid,$4,'exercise',concat(account_id,'/',id),'exercise_deleted' from changed returning id
          ) select count(*)::int as count from changed
        `, [input.accountId,input.exerciseId,actor.id,actor.email]);
        if (!result.rows[0]?.count) return json({ error: "Custom exercise not found or already removed." }, 404);
        return json({ ok: true, message: "Custom exercise removed from the shared library." });
      }
    }
  } catch (error) {
    if (error instanceof ProfileInputError) return json({ error: error.message }, error.status);
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    if (code === "23505") return json({ error: "That username or email is already in use." }, 409);
    console.error("Admin action failed.", code || "database error");
    return json({ error: "The admin action could not be saved." }, 503);
  }
}
