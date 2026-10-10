import type { Metadata } from "next";
import { Clock3, ScrollText } from "lucide-react";
import { getAdminActivity } from "@/features/admin/repository";

export const metadata: Metadata = { title: "Audit Log", description: "Review moderator and owner actions across ARCUS." };
const labels: Record<string, string> = {
  user_updated: "Edited user profile", user_warned: "Issued user warning", user_suspended: "Suspended user for 7 days",
  user_unsuspended: "Lifted user suspension", user_banned: "Permanently banned user", user_unbanned: "Restored user access",
  exercise_updated: "Updated exercise", exercise_deleted: "Deleted exercise", feature_flag_updated: "Changed feature flag",
  announcement_updated: "Updated global announcement", admin_granted: "Granted moderator access", admin_revoked: "Revoked moderator access",
};

export default async function AdminAuditPage() {
  const activity = await getAdminActivity();
  return <section>
    <p className="admin-eyebrow">Accountability</p><h1 className="admin-page-title">Audit log</h1>
    <p className="admin-page-description">Owner and moderator actions, with the acting account and timestamp recorded for review.</p>
    <article className="mt-8 rounded-2xl border border-stone-200 bg-white p-5 sm:p-8">
      <div className="mb-5 flex items-center gap-3"><ScrollText className="text-emerald-900" size={22} aria-hidden="true"/><div><h2 className="m-0 text-lg font-semibold tracking-tight">Recent actions</h2><p className="mb-0 mt-1 text-sm text-stone-500">Showing the latest {activity.length} recorded changes.</p></div></div>
      {activity.length ? <ol className="m-0 divide-y divide-stone-100 p-0">
        {activity.map(item => <li key={item.id} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 py-4 first:pt-0 last:pb-0">
          <div className="flex min-w-0 items-start gap-3"><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100 text-stone-600"><Clock3 size={16} aria-hidden="true"/></span><div className="min-w-0"><p className="m-0 text-sm font-medium text-stone-900">{labels[item.action] ?? item.action}</p><p className="mb-0 mt-1 break-all text-xs text-stone-500">Target: {item.targetType} · {item.targetId}</p><p className="mb-0 mt-1 break-all text-xs text-stone-600">By {item.actorEmail || `@${item.actorUsername}`}</p></div></div>
          <time dateTime={item.createdAt} className="pl-12 text-xs text-stone-400 sm:pl-0">{new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }).format(new Date(item.createdAt))}</time>
        </li>)}
      </ol> : <p className="m-0 rounded-xl bg-stone-50 px-4 py-6 text-sm text-stone-500">No admin actions have been recorded yet.</p>}
    </article>
  </section>;
}
