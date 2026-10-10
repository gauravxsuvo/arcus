"use client";

import { useState } from "react";
import { AlertTriangle, Check, LoaderCircle, Radio, ShieldAlert, UsersRound } from "lucide-react";
import type { AdminFeatureFlags, FeatureFlagKey } from "@/features/admin/model";

const options: Array<{ key: FeatureFlagKey; title: string; description: string; icon: typeof Radio; danger?: boolean }> = [
  { key: "social_feed", title: "Enable Social Feed", description: "Allow social activity surfaces to appear in the app.", icon: UsersRound },
  { key: "pro_tier", title: "Enable Pro Tier", description: "Expose paid-tier access when billing is connected.", icon: Radio },
  { key: "maintenance_mode", title: "Maintenance Mode", description: "Signal the app to pause consumer access during an incident.", icon: ShieldAlert, danger: true },
];

export function FeatureFlags({ initialFlags, configured, canManage = true }: { initialFlags: AdminFeatureFlags; configured: boolean; canManage?: boolean }) {
  const [flags, setFlags] = useState(initialFlags);
  const [busy, setBusy] = useState<FeatureFlagKey | null>(null);
  const [message, setMessage] = useState("");

  async function toggle(key: FeatureFlagKey, enabled: boolean) {
    if (busy) return;
    const before = flags[key];
    setFlags(current => ({ ...current, [key]: enabled }));
    setBusy(key);
    setMessage("");
    try {
      const response = await fetch("/api/admin/feature-flags", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, enabled }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save this setting.");
      setMessage(`${options.find(option => option.key === key)?.title} ${enabled ? "enabled" : "disabled"}.`);
    } catch (error) {
      setFlags(current => ({ ...current, [key]: before }));
      setMessage(error instanceof Error ? error.message : "Could not save this setting.");
    } finally { setBusy(null); }
  }

  return <section className="admin-panel min-w-0 p-5 sm:p-6" aria-labelledby="admin-feature-flags-title">
    <div className="mb-2 flex items-center gap-2.5"><AlertTriangle size={16} className="text-amber-300" aria-hidden="true"/><h2 id="admin-feature-flags-title" className="!m-0 !text-sm !font-semibold !tracking-normal text-zinc-100">Feature flags</h2></div>
    <p className="mb-4 mt-0 text-xs leading-relaxed text-zinc-500">{!canManage ? "Only the owner can change runtime feature flags." : configured ? "Changes save to PostgreSQL immediately. Maintenance pauses consumer screens; Social Feed and Pro Tier are ready for those features when shipped." : "Database setup is pending. Apply 0007_admin_feature_flags.sql to enable these controls."}</p>
    <ul className="m-0 list-none divide-y divide-white/[0.06] p-0">
      {options.map(({ key, title, description, icon: Icon, danger }) => <li key={key} className="flex items-center gap-3 py-3 first:pt-1 last:pb-1">
        <Icon size={16} className={danger ? "shrink-0 text-amber-300" : "shrink-0 text-zinc-500"} aria-hidden="true"/>
        <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-zinc-200">{title}</span><span className="mt-0.5 block text-[11px] leading-relaxed text-zinc-500">{description}</span></span>
        <button type="button" role="switch" aria-checked={flags[key]} aria-label={title} disabled={!canManage || !configured || busy !== null} onClick={() => void toggle(key, !flags[key])} className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${flags[key] ? danger ? "border-amber-500 bg-amber-500" : "border-blue-500 bg-blue-500" : "border-zinc-700 bg-zinc-800"}`}>
          <span className={`absolute top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white shadow transition-transform ${flags[key] ? "translate-x-[22px]" : "translate-x-0.5"}`}>
            {busy === key ? <LoaderCircle size={12} className="animate-spin text-zinc-600" aria-hidden="true"/> : flags[key] ? <Check size={12} className="text-blue-700" aria-hidden="true"/> : null}
          </span>
        </button>
      </li>)}
    </ul>
    <p className="sr-only" role="status" aria-live="polite">{message}</p>
  </section>;
}
