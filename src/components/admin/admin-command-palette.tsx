"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Database, LoaderCircle, RefreshCw, Search, Settings2, UsersRound, X } from "lucide-react";

const commands = [
  { title: "Go to Users", detail: "Open account directory", href: "/admin/users", icon: UsersRound },
  { title: "Go to Exercise DB", detail: "Review exercise catalog", href: "/admin/exercises", icon: BookOpen },
  { title: "Go to Settings", detail: "Owner controls and activity", href: "/admin/settings", icon: Settings2 },
] as const;

export function AdminCommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => commands.filter(command => `${command.title} ${command.detail}`.toLowerCase().includes(query.toLowerCase().trim())), [query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(value => !value);
        setQuery("");
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  async function clearCache() {
    if (!window.confirm("Clear ARCUS offline cache for this browser? Pages will be cached again as you use the app.")) return;
    setBusy(true);
    try {
      if (!("caches" in window)) { setStatus("Cache Storage is unavailable in this browser."); return; }
      const names = await window.caches.keys();
      const arcusCaches = names.filter(name => name.startsWith("arcus-shell-"));
      await Promise.all(arcusCaches.map(name => window.caches.delete(name)));
      setStatus(`Cleared ${arcusCaches.length} ARCUS offline cache${arcusCaches.length === 1 ? "" : "s"}.`);
    } catch { setStatus("Could not clear the offline cache."); }
    finally { setBusy(false); }
  }

  function refreshData() {
    setOpen(false);
    setStatus("Refreshing admin data…");
    router.refresh();
  }

  return <>
    <button type="button" onClick={() => { setOpen(true); setQuery(""); }} className="admin-button inline-flex h-9 items-center gap-2 rounded-lg border border-[#292a30] bg-[#111114] px-3 text-xs text-[#a1a1aa] hover:border-[#3b82f6]/50 hover:text-white" aria-label="Open command palette" title="Command palette · Ctrl K">
      <Search size={14} aria-hidden="true"/><span className="hidden sm:inline">Commands</span><kbd className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">⌘K</kbd>
    </button>
    <span className="admin-visually-hidden" role="status" aria-live="polite">{status}</span>
    {open && <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 px-4 pt-[min(18vh,150px)] backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="admin-command-title" className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#30313a] bg-[#111114] shadow-2xl shadow-black/60">
        <h2 id="admin-command-title" className="sr-only">Admin command palette</h2>
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-4">
          <Search className="shrink-0 text-zinc-500" size={18} aria-hidden="true"/>
          <input id="admin-command-search" ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search pages and actions…" aria-label="Search admin commands" className="h-14 min-w-0 flex-1 border-none bg-transparent text-sm text-zinc-100 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-zinc-600" />
          <button type="button" onClick={() => setOpen(false)} aria-label="Close command palette" className="grid h-9 w-9 place-items-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-white"><X size={17}/></button>
        </div>
        <div className="max-h-[min(60vh,460px)] overflow-y-auto p-2">
          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[.16em] text-zinc-600">Navigation</p>
          {filtered.map(({ title, detail, href, icon: Icon }) => <button key={href} type="button" onClick={() => go(href)} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-zinc-200 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
            <Icon size={16} className="text-zinc-500" aria-hidden="true"/><span className="flex-1 text-sm">{title}<small className="ml-2 text-xs text-zinc-600">{detail}</small></span><span className="text-zinc-600">↵</span>
          </button>)}
          {filtered.length === 0 && <p className="px-3 py-5 text-sm text-zinc-500">No matching page.</p>}
          <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[.16em] text-zinc-600">Quick actions</p>
          <button type="button" onClick={() => void clearCache()} disabled={busy} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-zinc-200 hover:bg-white/[0.06] disabled:opacity-50">
            {busy ? <LoaderCircle size={16} className="animate-spin text-zinc-500" aria-hidden="true"/> : <Database size={16} className="text-zinc-500" aria-hidden="true"/>}<span className="flex-1 text-sm">Clear Cache<small className="ml-2 text-xs text-zinc-600">Remove ARCUS offline files in this browser</small></span>
          </button>
          <button type="button" onClick={refreshData} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-zinc-200 hover:bg-white/[0.06]">
            <RefreshCw size={16} className="text-zinc-500" aria-hidden="true"/><span className="flex-1 text-sm">Force Refresh Data<small className="ml-2 text-xs text-zinc-600">Re-fetch the current admin page</small></span>
          </button>
        </div>
        <footer className="flex items-center justify-between border-t border-white/[0.08] px-4 py-2.5 text-[10px] text-zinc-600"><span>ARCUS owner console</span><span>ESC to close</span></footer>
      </section>
    </div>}
  </>;
}
