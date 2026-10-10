"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, Megaphone, Send } from "lucide-react";

export function GlobalAnnouncementEditor({ initialMessage }: { initialMessage: string }) {
  const [message, setMessage] = useState(initialMessage);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/admin/announcement", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not update announcement.");
      setStatus(message.trim() ? "Announcement published." : "Announcement cleared.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not update announcement."); }
    finally { setBusy(false); }
  }
  return <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8" aria-labelledby="global-announcement-title">
    <div className="flex items-start gap-3"><Megaphone size={22} className="mt-0.5 shrink-0 text-emerald-900" aria-hidden="true"/><div><h2 id="global-announcement-title" className="text-lg font-semibold tracking-tight">Global announcement</h2><p className="mt-1 text-sm leading-6 text-stone-500">Show a dismissible notice at the top of the app for everyone. Leave blank and save to clear it.</p></div></div>
    <form onSubmit={event => void save(event)} className="mt-5 grid gap-3"><label htmlFor="global-announcement" className="sr-only">Announcement text</label><textarea id="global-announcement" value={message} onChange={event => setMessage(event.target.value)} maxLength={240} rows={3} placeholder="Scheduled maintenance at 12 AM" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-emerald-700"/><div className="flex items-center justify-between gap-3"><span className="text-xs text-stone-400">{message.length}/240 characters</span><button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">{busy ? <LoaderCircle size={15} className="animate-spin"/> : <Send size={15}/>}Save announcement</button></div><p role="status" aria-live="polite" className="m-0 min-h-5 text-xs text-emerald-800">{status}</p></form>
  </section>;
}
