import "server-only";
import { cache } from "react";
import { requireAdmin } from "@/lib/auth/admin";
import { getDatabasePool } from "@/lib/db/pool";
import { exerciseCatalog } from "@/features/exercises/catalog";
import type { AdminAccessRow, AdminAccessState, AdminActivityRow, AdminExerciseRow, AdminFeatureFlagState, AdminFeatureFlags, AdminOverview, AdminPulseItem, AdminTablePage, AdminUserRow, FeatureFlagKey } from "./model";
import { isOwnerAccount } from "@/lib/auth/admin";
import type { parseAdminQuery } from "./query";

type QueryOptions = ReturnType<typeof parseAdminQuery>;

// A single aggregate query after authentication avoids per-card round trips.
export const getAdminOverview = cache(async (): Promise<AdminOverview> => {
  await requireAdmin();
  try {
    const result = await getDatabasePool().query<{
      total_users: string; workouts_today: string; custom_exercises: string;
      signups_this_week: string; growth: AdminOverview["growth"]; as_of: string;
    }>(`
      with bounds as (
        select (now() at time zone 'UTC')::date as today,
          date_trunc('week', now() at time zone 'UTC') at time zone 'UTC' as week_start
      ), daily as (
        select (created_at at time zone 'UTC')::date as day, count(*) as signups
        from public.arcus_accounts
        where created_at >= ((select today - 29 from bounds)::timestamp at time zone 'UTC')
        group by 1
      ), timeline as (
        select bounds.today - 29 + days.n as day, coalesce(daily.signups, 0) as signups
        from bounds cross join generate_series(0, 29) as days(n)
        left join daily on daily.day = bounds.today - 29 + days.n
      ), growth as (
        select day,
          (select count(*) from public.arcus_accounts
            where created_at < ((select today - 29 from bounds)::timestamp at time zone 'UTC'))
          + sum(signups) over (order by day) as users
        from timeline
      )
      select
        (select count(*) from public.arcus_accounts) as total_users,
        (select count(*) from public.arcus_accounts where created_at >= bounds.week_start) as signups_this_week,
        (select count(*) from public.arcus_library where kind = 'exercise'
          and payload ->> 'deleted' is distinct from 'true') as custom_exercises,
        (select count(*) from public.arcus_workouts where payload ->> 'status' = 'completed'
          and left(payload ->> 'completedAt', 10) = to_char(bounds.today, 'YYYY-MM-DD')) as workouts_today,
        (select jsonb_agg(jsonb_build_object('date', to_char(day, 'YYYY-MM-DD'), 'users', users) order by day) from growth) as growth,
        to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as as_of
      from bounds
    `);
    const row = result.rows[0];
    const customExercises = Number(row.custom_exercises);
    return {
      totalUsers: Number(row.total_users), workoutsToday: Number(row.workouts_today),
      totalExercises: customExercises, signupsThisWeek: Number(row.signups_this_week),
      customExercises, builtInExercises: exerciseCatalog.length,
      growth: row.growth.map(point => ({ date: point.date, users: Number(point.users) })), asOf: row.as_of,
    };
  } catch { throw new Error("The admin data service is temporarily unavailable."); }
});

export async function getAdminUsers(options: QueryOptions): Promise<AdminTablePage<AdminUserRow>> {
  // Check at the data boundary too: Next layouts can persist across navigation.
  await requireAdmin();
  try {
    const result = await getDatabasePool().query<{ total: number; page: number; rows: AdminUserRow[] }>(`
      with matching as (
        select a.id, a.username, a.email, a.display_name, a.created_at, a.is_banned,
          a.is_suspended, a.suspended_until,
          case when a.id = $4::uuid then 'OWNER'
            when g.role = 'MODERATOR' then 'MODERATOR' else 'USER' end as role
        from public.arcus_accounts a left join public.arcus_admin_access g on g.account_id = a.id
        where $1::text = '' or strpos(username_normalized, lower($1)) > 0
          or strpos(email_normalized, lower($1)) > 0 or strpos(lower(display_name), lower($1)) > 0
      ), bounds as (
        select count(*)::int as total,
          least($2::int, greatest(1, ceil(count(*)::numeric / $3::int)::int)) as page from matching
      ), paged as (
        select * from matching order by created_at desc, id
        limit $3::int offset (select (page - 1) * $3::int from bounds)
      ), workout_counts as (
        select account_id, count(*) as total from public.arcus_workouts
        where account_id in (select id from paged) group by account_id
      )
      select bounds.total, bounds.page, coalesce((
        select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username,
          'name', p.display_name, 'email', p.email, 'createdAt', p.created_at,
          'workoutCount', coalesce(w.total, 0), 'isBanned', p.is_banned,
          'isSuspended', p.is_suspended and (p.suspended_until is null or p.suspended_until > now()),
          'suspendedUntil', p.suspended_until, 'role', p.role) order by p.created_at desc, p.id)
        from paged p left join workout_counts w on w.account_id = p.id
      ), '[]'::jsonb) as rows from bounds
    `, [options.query, options.page, options.pageSize, process.env.ARCUS_ADMIN_ACCOUNT_ID ?? null]);
    const row = result.rows[0];
    return { ...row, rows: row.rows.map(user => ({ ...user, workoutCount: Number(user.workoutCount) })), pageSize: options.pageSize, query: options.query };
  } catch { throw new Error("The admin user directory is temporarily unavailable."); }
}

export async function getAdminExercises(options: QueryOptions): Promise<{ data: AdminTablePage<AdminExerciseRow>; muscleOptions: string[] }> {
  await requireAdmin();
  try {
    const catalog = exerciseCatalog.map(({ id, name, muscle, equipment }) => ({ id, name, muscle, equipment }));
    const result = await getDatabasePool().query<{
      total: number; page: number; rows: AdminExerciseRow[]; muscles: string[];
    }>(`
      with definitions as (
        select id, name, muscle, equipment, 'built-in'::text as source, null::text as owner,
          null::text as owner_account_id, null::text as library_id
        from jsonb_to_recordset($1::jsonb) as builtins(id text, name text, muscle text, equipment text)
        union all
        select concat(l.account_id, '/', l.id), coalesce(nullif(l.payload ->> 'name', ''), 'Untitled exercise'),
          coalesce(nullif(l.payload ->> 'muscle', ''), 'Unspecified'),
          coalesce(nullif(l.payload ->> 'equipment', ''), 'Unspecified'), 'custom', a.username,
          l.account_id::text, l.id
        from public.arcus_library l join public.arcus_accounts a on a.id = l.account_id
        where l.kind = 'exercise' and l.payload ->> 'deleted' is distinct from 'true'
      ), matching as (
        select * from definitions where ($2::text = '' or strpos(lower(name), lower($2)) > 0
          or strpos(lower(equipment), lower($2)) > 0 or strpos(lower(muscle), lower($2)) > 0)
          and ($3::text = '' or muscle = $3)
      ), bounds as (
        select count(*)::int as total,
          least($4::int, greatest(1, ceil(count(*)::numeric / $5::int)::int)) as page from matching
      ), paged as (
        select * from matching order by lower(name), id
        limit $5::int offset (select (page - 1) * $5::int from bounds)
      )
      select bounds.total, bounds.page, coalesce((
        select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'muscle', muscle,
          'equipment', equipment, 'source', source, 'ownerUsername', owner,
          'ownerAccountId', owner_account_id, 'libraryId', library_id) order by lower(name), id)
        from paged
      ), '[]'::jsonb) as rows,
      coalesce((select jsonb_agg(muscle order by muscle) from (select distinct muscle from definitions) groups), '[]'::jsonb) as muscles
      from bounds
    `, [JSON.stringify(catalog), options.query, options.muscle, options.page, options.pageSize]);
    const row = result.rows[0];
    return { data: { rows: row.rows, total: row.total, page: row.page, pageSize: options.pageSize, query: options.query }, muscleOptions: row.muscles };
  } catch { throw new Error("The admin exercise directory is temporarily unavailable."); }
}

export const getAdminActivity = cache(async (): Promise<AdminActivityRow[]> => {
  await requireAdmin();
  try {
    const result = await getDatabasePool().query<AdminActivityRow>(`
      select l.id, l.action, l.target_type as "targetType", l.target_id as "targetId",
        a.username as "actorUsername", l.actor_email as "actorEmail", l.created_at as "createdAt"
      from public.arcus_admin_audit l
      join public.arcus_accounts a on a.id = l.actor_id
      order by l.created_at desc, l.id desc limit 25
    `);
    return result.rows;
  } catch { throw new Error("The admin activity log is temporarily unavailable."); }
});

const defaultFeatureFlags: AdminFeatureFlags = { social_feed: false, pro_tier: false, maintenance_mode: false };

export async function getAdminFeatureFlags(): Promise<AdminFeatureFlagState> {
  await requireAdmin();
  try {
    const result = await getDatabasePool().query<{ flag_key: FeatureFlagKey; enabled: boolean }>(
      "select flag_key, enabled from public.arcus_feature_flags",
    );
    return { flags: result.rows.reduce((flags, row) => ({ ...flags, [row.flag_key]: row.enabled }), { ...defaultFeatureFlags }), configured: true };
  } catch { return { flags: { ...defaultFeatureFlags }, configured: false }; }
}

export async function getAdminGlobalAnnouncement(): Promise<string> {
  await requireAdmin();
  try {
    const result = await getDatabasePool().query<{ setting_value: string }>(
      "select setting_value from public.arcus_platform_settings where setting_key='global_announcement'",
    );
    return result.rows[0]?.setting_value ?? "";
  } catch { return ""; }
}

export async function getAdminLivePulse(): Promise<AdminPulseItem[]> {
  await requireAdmin();
  try {
    const result = await getDatabasePool().query<AdminPulseItem>(`
      with events as (
        select 'signup:' || a.id::text as id, 'signup'::text as kind,
          a.username, 'joined ARCUS'::text as summary, a.created_at as "createdAt"
        from public.arcus_accounts a
        union all
        select 'workout:' || w.account_id::text || ':' || w.id::text, 'workout', a.username,
          'completed ' || coalesce(nullif(w.payload ->> 'name', ''), 'a workout'), w.updated_at
        from public.arcus_workouts w
        join public.arcus_accounts a on a.id = w.account_id
        where w.payload ->> 'status' = 'completed'
        union all
        select 'admin:' || l.id::text, 'admin', a.username,
          case l.action
            when 'user_updated' then 'updated a user account'
            when 'user_warned' then 'issued a user warning'
            when 'user_suspended' then 'suspended a user for 7 days'
            when 'user_unsuspended' then 'lifted a user suspension'
            when 'user_banned' then 'banned a user account'
            when 'user_unbanned' then 'restored a user account'
            when 'exercise_updated' then 'updated an exercise'
            when 'exercise_deleted' then 'removed an exercise'
            when 'admin_granted' then 'granted moderator access'
            when 'admin_revoked' then 'revoked moderator access'
            when 'feature_flag_updated' then 'changed a feature flag'
            when 'announcement_updated' then 'updated the global announcement'
            else 'changed platform settings'
          end,
          l.created_at
        from public.arcus_admin_audit l
        join public.arcus_accounts a on a.id = l.actor_id
      )
      select id, kind, username, summary, "createdAt"
      from events order by "createdAt" desc, id desc limit 20
    `);
    return result.rows;
  } catch { throw new Error("The live activity feed is temporarily unavailable."); }
}

export async function getAdminAccessState(): Promise<AdminAccessState> {
  const account = await requireAdmin();
  if (!isOwnerAccount(account)) return { admins: [], configured: false };
  try {
    const result = await getDatabasePool().query<AdminAccessRow>(`
      select g.account_id as "accountId", a.username, a.email, g.role,
        owner.username as "grantedBy", g.granted_at as "grantedAt"
      from public.arcus_admin_access g
      join public.arcus_accounts a on a.id = g.account_id
      join public.arcus_accounts owner on owner.id = g.granted_by
      order by g.granted_at desc, a.email_normalized
    `);
    return { admins: result.rows, configured: true };
  } catch { return { admins: [], configured: false }; }
}
