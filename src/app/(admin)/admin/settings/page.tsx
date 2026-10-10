import type { Metadata } from "next";
import { ShieldCheck, Database, Clock3 } from "lucide-react";
import { isOwnerAccount, requireAdmin } from "@/lib/auth/admin";
import { getAdminAccessState, getAdminActivity, getAdminGlobalAnnouncement } from "@/features/admin/repository";
import { AdminAccessPanel } from "@/components/admin/admin-access-panel";
import { GlobalAnnouncementEditor } from "@/components/admin/global-announcement-editor";

export const metadata: Metadata = { title: "Settings", description: "Review recent owner actions and ARCUS platform configuration." };

const activityLabels: Record<string, string> = {
  user_updated: "Edited a user account",
  user_banned: "Banned a user account",
  user_unbanned: "Restored account access",
  exercise_updated: "Edited a custom exercise",
  exercise_deleted: "Removed a custom exercise",
  user_warned: "Issued a warning",
  user_suspended: "Suspended a user for 7 days",
  user_unsuspended: "Lifted a user suspension",
  feature_flag_updated: "Updated a feature flag",
  announcement_updated: "Updated the global announcement",
  admin_granted: "Granted moderator access",
  admin_revoked: "Revoked moderator access",
};

export default async function AdminSettingsPage() {
  const [account, activity] = await Promise.all([requireAdmin(), getAdminActivity()]);
  const owner = isOwnerAccount(account);
  const access = owner ? await getAdminAccessState() : null;
  const announcement = owner ? await getAdminGlobalAnnouncement() : "";
  return <section>
    <p className="admin-eyebrow">{owner ? "Owner controls" : "Moderator workspace"}</p>
    <h1 className="admin-page-title">Settings</h1>
    <p className="admin-page-description">Access configuration and the current capabilities of your console.</p>
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <article className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
        <ShieldCheck className="mb-5 text-emerald-900" size={24} aria-hidden="true"/>
        <h2 className="text-lg font-semibold tracking-tight">{owner ? "Owner access" : "Moderator access"}</h2>
        <p className="mt-2 text-sm leading-6 text-stone-500">A valid server session and an approved role are required on every admin page and data request.</p>
        <dl className="mt-6 space-y-4 text-sm">
          <div><dt className="text-stone-500">Account</dt><dd className="mt-1 font-medium">{account.username}</dd></div>
          <div><dt className="text-stone-500">Signed-in email</dt><dd className="mt-1 break-all font-medium">{account.email}</dd></div>
          <div><dt className="text-stone-500">Access level</dt><dd className="mt-1 font-medium">{owner ? "Owner · full platform access" : "Moderator · standard-user moderation"}</dd></div>
        </dl>
      </article>
      <article className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
        <Database className="mb-5 text-emerald-900" size={24} aria-hidden="true"/>
        <h2 className="text-lg font-semibold tracking-tight">Platform connection</h2>
        <dl className="mt-6 space-y-4 text-sm">
          <div><dt className="text-stone-500">Storage</dt><dd className="mt-1 font-medium">Hosted PostgreSQL · Portways</dd></div>
          <div><dt className="text-stone-500">Data scope</dt><dd className="mt-1 leading-6">Registered accounts, synced workouts and synced custom exercises. Device-only drafts are excluded.</dd></div>
          <div><dt className="text-stone-500">Reporting timezone</dt><dd className="mt-1 font-medium">UTC · weeks start Monday</dd></div>
        </dl>
      </article>
    </div>
    {access && <AdminAccessPanel initialState={access}/>}
    {owner && <GlobalAnnouncementEditor initialMessage={announcement}/>}
    <article className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
      <div className="flex items-center gap-3"><Clock3 className="text-emerald-900" size={22} aria-hidden="true"/><div><h2 className="text-lg font-semibold tracking-tight">Management activity</h2><p className="mt-1 text-sm text-stone-500">Recent owner and moderator actions, recorded when each change is saved.</p></div></div>
      {activity.length ? <ol className="mt-5 divide-y divide-stone-100">
        {activity.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0"><p className="text-sm font-medium text-stone-800">{activityLabels[item.action] ?? item.action}</p><p className="mt-0.5 text-xs text-stone-500">{item.targetType} · {item.targetId.slice(-12)} · by {item.actorEmail || `@${item.actorUsername}`}</p></div>
          <time dateTime={item.createdAt} className="text-xs text-stone-400">{new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }).format(new Date(item.createdAt))}</time>
        </li>)}
      </ol> : <p className="mt-5 rounded-xl bg-stone-50 px-4 py-5 text-sm text-stone-500">No admin changes have been made yet.</p>}
    </article>
  </section>;
}
