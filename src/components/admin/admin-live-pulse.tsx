"use client";

import { Activity, Dumbbell, UserRoundPlus, Wrench, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { AdminPulseItem } from "@/features/admin/model";

function relativeTime(value: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const icons = { signup: UserRoundPlus, workout: Dumbbell, admin: Wrench } as const;

export function AdminLivePulse({ initialItems }: { initialItems: AdminPulseItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [now, setNow] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setNow(Date.now());
    let active = true;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      setRefreshing(true);
      try {
        const response = await fetch("/api/admin/pulse", { cache: "no-store" });
        if (!response.ok) throw new Error("Feed unavailable");
        const data = await response.json() as { items: AdminPulseItem[] };
        if (active) { setItems(data.items); setError(false); }
      } catch { if (active) setError(true); }
      finally { if (active) setRefreshing(false); }
    };
    const timer = window.setInterval(() => { setNow(Date.now()); void refresh(); }, 20_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  return <section className="admin-panel min-w-0 p-5 sm:p-6" aria-labelledby="admin-live-pulse-title">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <Activity size={16} className="text-blue-400" aria-hidden="true" />
        <h2 id="admin-live-pulse-title" className="!m-0 !text-sm !font-semibold !tracking-normal text-zinc-100">Live pulse</h2>
        <span className="rounded-full border border-emerald-900/70 bg-emerald-950/50 px-2 py-0.5 text-[10px] text-emerald-300">LIVE</span>
      </div>
      <RefreshCw size={14} className={`text-zinc-500 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
    </div>
    <p className="mb-4 mt-0 text-xs text-zinc-500">Recent signups, completed workouts, and owner actions · refreshes every 20s</p>
    {error && <p role="status" className="mb-3 text-xs text-amber-300">Couldn’t refresh. Showing the latest available activity.</p>}
    {items.length ? <ol className="max-h-[390px] divide-y divide-white/[0.06] overflow-y-auto pr-1">
      {items.map(item => {
        const Icon = icons[item.kind];
        return <li key={item.id} className="flex min-w-0 items-start gap-3 py-3 first:pt-0 last:pb-0">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-zinc-400"><Icon size={14} aria-hidden="true" /></span>
          <p className="m-0 min-w-0 flex-1 text-xs leading-5 text-zinc-300"><span className="font-medium text-zinc-100">@{item.username}</span> {item.summary}</p>
          <time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString()} className="shrink-0 pt-0.5 text-[10px] tabular-nums text-zinc-500">{now ? relativeTime(item.createdAt, now) : "—"}</time>
        </li>;
      })}
    </ol> : <p className="m-0 rounded-lg border border-dashed border-white/10 px-4 py-7 text-center text-xs text-zinc-500">No platform activity yet.</p>}
  </section>;
}
