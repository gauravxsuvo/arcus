"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Ban, LoaderCircle, MessageSquareWarning, Pencil, ShieldCheck, ShieldOff, UserRoundX } from "lucide-react";
import type { AdminUserRow } from "@/features/admin/model";
import { canManageUser } from "@/features/admin/access";
import { AdminActionDialog, submitAdminAction } from "./admin-action-dialog";
import { DetailField, RowActions } from "./row-actions";

type DialogMode = "edit" | "warn" | "suspend" | "unsuspend" | "ban" | "unban" | null;

export function UserManagementActions({ user, ownerId, actorRole }: { user: AdminUserRow; ownerId: string; actorRole: "OWNER" | "MODERATOR" }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const targetIsPrivileged = !canManageUser(actorRole, user.role, user.id, ownerId);

  function open(mode: Exclude<DialogMode, null>) { setError(""); setDialog(mode); }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run({ action: "user.update", userId: user.id, username: String(form.get("username") ?? ""), email: String(form.get("email") ?? ""), name: String(form.get("name") ?? "") });
  }

  async function saveWarning(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run({ action: "user.warn", userId: user.id, message: String(form.get("message") ?? "") });
  }

  async function confirmStatus() {
    const action = dialog === "suspend" ? "user.suspend" : dialog === "unsuspend" ? "user.unsuspend" : user.isBanned ? "user.unban" : "user.ban";
    await run({ action, userId: user.id });
  }

  async function run(payload: Record<string, string>) {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await submitAdminAction(payload);
      setMessage(result); setDialog(null); router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The change could not be saved.");
    } finally { setBusy(false); }
  }

  const actions = [
    { label: "Edit user", icon: Pencil, disabled: targetIsPrivileged, disabledReason: targetIsPrivileged ? "Protected admin accounts cannot be changed by this role." : undefined, onSelect: () => open("edit") },
    { label: "Issue warning", icon: MessageSquareWarning, disabled: targetIsPrivileged, disabledReason: targetIsPrivileged ? "Protected admin accounts cannot be moderated by this role." : undefined, onSelect: () => open("warn") },
    { label: user.isSuspended ? "Lift suspension" : "Suspend for 7 days", icon: user.isSuspended ? ShieldOff : UserRoundX, destructive: !user.isSuspended, disabled: targetIsPrivileged || user.isBanned, disabledReason: targetIsPrivileged ? "Protected admin accounts cannot be moderated by this role." : user.isBanned ? "Lift the permanent ban first." : undefined, onSelect: () => open(user.isSuspended ? "unsuspend" : "suspend") },
    { label: user.isBanned ? "Restore access" : "Permanently ban", icon: user.isBanned ? ShieldCheck : Ban, destructive: !user.isBanned, disabled: targetIsPrivileged, disabledReason: targetIsPrivileged ? "Protected admin accounts cannot be moderated by this role." : undefined, onSelect: () => open(user.isBanned ? "unban" : "ban") },
  ];
  const isStatusDialog = dialog === "suspend" || dialog === "unsuspend" || dialog === "ban" || dialog === "unban";
  const dialogTitle = dialog === "warn" ? "Issue a warning" : dialog === "suspend" ? "Suspend for 7 days?" : dialog === "unsuspend" ? "Lift this suspension?" : dialog === "ban" ? "Permanently ban this user?" : "Restore this user’s access?";
  const dialogDescription = dialog === "warn" ? `Record a warning for @${user.username}. They will see it on their profile.` : dialog === "suspend" ? `@${user.username} will be signed out and blocked from signing in for 7 days.` : dialog === "unsuspend" ? `@${user.username} will be able to sign in again.` : dialog === "ban" ? `@${user.username} will be signed out and permanently blocked from signing in.` : `@${user.username} will be able to sign in again.`;

  return <>
    <div className="flex flex-col items-end gap-1">
      <RowActions label={user.username} detailsTitle="User details" actions={actions} details={<>
        <div className="mb-4 flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-full border border-teal-100 bg-teal-50 text-sm font-semibold text-teal-700" aria-hidden="true">{user.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "U"}</span><div><p className="font-semibold text-slate-900">{user.name || user.username}</p><p className="mt-1 text-sm text-slate-500">@{user.username}</p></div></div>
        <dl><DetailField label="Role">{user.role}</DetailField><DetailField label="Account status">{user.isBanned ? "Permanently banned" : user.isSuspended ? `Suspended until ${new Date(user.suspendedUntil ?? "").toLocaleString()}` : "Active"}</DetailField><DetailField label="User ID" mono>{user.id}</DetailField><DetailField label="Name">{user.name || "Not available"}</DetailField><DetailField label="Username">@{user.username}</DetailField><DetailField label="Email address">{user.email || "Not available"}</DetailField><DetailField label="Joined">{new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(user.createdAt))}</DetailField><DetailField label="Recorded workouts">{user.workoutCount.toLocaleString("en-US")}</DetailField></dl>
      </>} />
      {message && <span role="status" className="max-w-36 text-right text-[10px] leading-4 text-teal-700">{message}</span>}
    </div>
    {dialog === "edit" && <AdminActionDialog title="Edit user" description="Update the profile shown across ARCUS. Their password and workout history stay unchanged." busy={busy} onClose={() => setDialog(null)} footer={<><button type="button" onClick={() => setDialog(null)} disabled={busy} className="admin-button h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-600 hover:bg-slate-100">Cancel</button><button form="admin-edit-user" type="submit" disabled={busy} className="admin-button admin-button-primary inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium">{busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true"/>}Save user</button></>}>
      <form id="admin-edit-user" onSubmit={event => void saveEdit(event)} className="grid gap-4">
        <Field label="Display name"><input name="name" defaultValue={user.name} minLength={1} maxLength={80} required autoComplete="name"/></Field>
        <Field label="Username"><input name="username" defaultValue={user.username} minLength={3} maxLength={32} pattern="[A-Za-z0-9_]+" required autoComplete="username"/></Field>
        <Field label="Email address"><input name="email" type="email" defaultValue={user.email} maxLength={254} required autoComplete="email"/></Field>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      </form>
    </AdminActionDialog>}
    {dialog === "warn" && <AdminActionDialog title={dialogTitle} description={dialogDescription} busy={busy} onClose={() => setDialog(null)} footer={<><button type="button" onClick={() => setDialog(null)} disabled={busy} className="admin-button h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-600 hover:bg-slate-100">Cancel</button><button form="admin-warn-user" type="submit" disabled={busy} className="admin-button admin-button-primary inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium">{busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true"/>}Send warning</button></>}>
      <form id="admin-warn-user" onSubmit={event => void saveWarning(event)} className="grid gap-3"><label className="grid gap-1.5 text-sm font-medium text-slate-700">Message<textarea name="message" required minLength={1} maxLength={500} rows={4} placeholder="Explain what needs to change…" className="rounded-lg border border-slate-300 p-3 text-sm"/></label>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}</form>
    </AdminActionDialog>}
    {isStatusDialog && <AdminActionDialog title={dialogTitle} description={dialogDescription} busy={busy} onClose={() => setDialog(null)} footer={<><button type="button" onClick={() => setDialog(null)} disabled={busy} className="admin-button h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-600 hover:bg-slate-100">Cancel</button><button type="button" onClick={() => void confirmStatus()} disabled={busy} className={`admin-button inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white ${dialog === "suspend" || dialog === "ban" ? "bg-rose-700 hover:bg-rose-800" : "admin-button-primary"}`}>{busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true"/> : <AlertTriangle size={16} aria-hidden="true"/>}{dialog === "suspend" ? "Suspend user" : dialog === "unsuspend" ? "Lift suspension" : dialog === "ban" ? "Permanently ban" : "Restore access"}</button></>}>
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500"><Ban aria-hidden="true" size={19}/></span><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{user.name || user.username}</p><p className="mt-0.5 truncate text-xs text-slate-500">@{user.username} · {user.email}</p></div></div>
      {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
    </AdminActionDialog>}
  </>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium text-slate-700">{label}{children}</label>;
}
