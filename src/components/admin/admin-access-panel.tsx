"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import type { AdminAccessRow, AdminAccessState } from "@/features/admin/model";

export function AdminAccessPanel({ initialState }: { initialState: AdminAccessState }) {
  const [admins, setAdmins] = useState(initialState.admins);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialState.configured ? "" : "Admin access table is not installed yet. Apply migration 0008 before granting access.");

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !initialState.configured) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const result = await response.json() as { admin?: { account_id: string; username: string; email: string; role: "MODERATOR"; granted_at: string }; error?: string; message?: string };
      if (!response.ok || !result.admin) throw new Error(result.error || "Could not grant access.");
      const row: AdminAccessRow = { accountId: result.admin.account_id, username: result.admin.username, email: result.admin.email, role: result.admin.role, grantedBy: "you", grantedAt: result.admin.granted_at };
      setAdmins(current => [row, ...current.filter(item => item.accountId !== row.accountId)]);
      setEmail(""); setMessage(result.message || `Admin access granted to ${row.email}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not grant access."); }
    finally { setBusy(false); }
  }

  async function remove(admin: AdminAccessRow) {
    if (busy || !initialState.configured || !window.confirm(`Revoke admin access for ${admin.email}?`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/access", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId: admin.accountId }) });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Could not revoke access.");
      setAdmins(current => current.filter(item => item.accountId !== admin.accountId));
      setMessage(result.message || "Admin access revoked.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not revoke access."); }
    finally { setBusy(false); }
  }

  return <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8" aria-labelledby="admin-access-heading">
    <div className="flex items-start gap-3">
      <ShieldCheck className="mt-0.5 shrink-0 text-emerald-900" size={22} aria-hidden="true"/>
      <div><h2 id="admin-access-heading" className="text-lg font-semibold tracking-tight">Approved moderator accounts</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-stone-500">Grant moderator access to an existing ARCUS account. Moderators can manage standard users, but cannot act on the owner or another moderator. Only the owner can manage this list.</p></div>
    </div>
    <form onSubmit={event => void add(event)} className="mt-5 flex flex-col gap-3 sm:flex-row">
      <label className="sr-only" htmlFor="approved-admin-email">Account email</label>
      <input id="approved-admin-email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="person@example.com" disabled={!initialState.configured || busy} className="min-h-11 min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-blue-500 focus:outline-none"/>
      <button type="submit" disabled={!initialState.configured || busy || !email.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <LoaderCircle className="animate-spin" size={16} aria-hidden="true"/> : <UserPlus size={16} aria-hidden="true"/>}Grant moderator</button>
    </form>
    <p className="mt-2 text-xs leading-5 text-stone-500">They must create their ARCUS account first. Email-only approvals are not used, so a different account cannot claim access by reusing an address.</p>
    {admins.length ? <ul className="mt-5 divide-y divide-stone-100 rounded-xl border border-stone-200">
      {admins.map(admin => <li key={admin.accountId} className="flex min-w-0 items-center gap-3 px-3 py-3 sm:px-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">{admin.username.slice(0, 1).toUpperCase()}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-stone-800">@{admin.username}</span><span className="block truncate text-xs text-stone-500">{admin.email} · {admin.role}</span></span>
        <button type="button" onClick={() => void remove(admin)} disabled={!initialState.configured || busy} aria-label={`Revoke admin access for ${admin.email}`} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-50"><UserMinus size={15} aria-hidden="true"/><span className="hidden sm:inline">Revoke</span></button>
      </li>)}
    </ul> : <p className="mt-5 rounded-xl bg-stone-50 px-4 py-5 text-center text-sm text-stone-500">No additional admins approved.</p>}
    <p role="status" aria-live="polite" className={`mt-3 min-h-5 text-xs ${message.includes("could not") || message.includes("not found") || message.includes("not installed") || message.includes("must create") ? "text-rose-700" : "text-emerald-800"}`}>{message}</p>
  </section>;
}
