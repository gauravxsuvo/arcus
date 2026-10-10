"use client";

import { Mail } from "lucide-react";
import type { AdminTablePage, AdminUserRow } from "@/features/admin/model";
import { DataTable, type DataTableColumn } from "./data-table";
import { UserManagementActions } from "./user-management-actions";

function joinedDate(value: string, full = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: full ? "long" : "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function initials(row: AdminUserRow) {
  return (row.name || row.username).trim().split(/\s+/).slice(0, 2).map(word => word.charAt(0).toUpperCase()).join("") || "U";
}

function columns(ownerId: string, actorRole: "OWNER" | "MODERATOR"): DataTableColumn<AdminUserRow>[] { return [
  {
    id: "member",
    header: "Member",
    cell: row => <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-teal-100 bg-teal-50 text-xs font-semibold text-teal-700" aria-hidden="true">{initials(row)}</span><div className="min-w-0"><p className="font-medium text-slate-800">{row.name || row.username}</p><p className="mt-0.5 text-xs text-slate-400">@{row.username}</p></div></div>,
  },
  {
    id: "email",
    header: "Email address",
    cell: row => <span className="flex items-center gap-2 text-xs text-slate-500"><Mail aria-hidden="true" size={14} className="shrink-0 text-slate-300" />{row.email || "Not available"}</span>,
  },
  { id: "joined", header: "Joined", cell: row => <time dateTime={row.createdAt} className="whitespace-nowrap text-xs text-slate-500">{joinedDate(row.createdAt)}</time> },
  { id: "workouts", header: "Workouts", className: "text-right", cell: row => <span className="inline-flex min-w-7 justify-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium tabular-nums text-slate-600">{row.workoutCount.toLocaleString("en-US")}</span> },
  { id: "status", header: "Status", cell: row => <div className="flex flex-wrap gap-1.5"><span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${row.role !== "USER" ? "border-sky-200 bg-sky-50 text-sky-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{row.role}</span><span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${row.isBanned ? "border-rose-200 bg-rose-50 text-rose-700" : row.isSuspended ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-100 bg-emerald-50 text-emerald-800"}`}>{row.isBanned ? "Banned" : row.isSuspended ? "Suspended" : "Active"}</span></div> },
  {
    id: "actions",
    header: <span className="sr-only">Actions</span>,
    className: "w-14 text-right",
    cell: row => <UserManagementActions user={row} ownerId={ownerId} actorRole={actorRole}/> ,
  },
]; }

export function UsersTable({ data, ownerId, actorRole }: { data: AdminTablePage<AdminUserRow>; ownerId: string; actorRole: "OWNER" | "MODERATOR" }) {
  return <DataTable data={data} columns={columns(ownerId, actorRole)} getRowId={row => row.id} basePath="/admin/users" caption="User directory" itemLabel="users" searchPlaceholder="Search name, username or email…" emptyTitle="No users found" emptyDescription={data.query ? "Try a different name, username or email address, or clear your search." : "Registered users will appear here once accounts are created."} tableClassName="min-w-[900px]" />;
}
