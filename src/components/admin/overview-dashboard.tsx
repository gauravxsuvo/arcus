import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Database,
  Dumbbell,
  Info,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AdminOverview } from "@/features/admin/model";
import type { AdminFeatureFlagState, AdminPulseItem } from "@/features/admin/model";
import { AdminLink } from "./admin-shell";
import { UserGrowthChart } from "./user-growth-chart";
import { AdminLivePulse } from "./admin-live-pulse";
import { FeatureFlags } from "./feature-flags";

const numberFormat = new Intl.NumberFormat("en");
const snapshotFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

function StatCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: number;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <article className="admin-panel min-w-0 rounded-xl border border-[#e2e8ef] bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="!m-0 !text-[13px] !font-medium !tracking-normal text-[#68788b]">{label}</h2>
        <Icon className="mt-0.5 shrink-0 text-[#8795a4]" size={17} strokeWidth={1.7} aria-hidden="true" />
      </div>
      <p className="mb-2 mt-5 text-[38px] font-semibold leading-none tracking-[-0.055em] text-[#172638] tabular-nums sm:text-[42px]">
        {numberFormat.format(value)}
      </p>
      <p className="m-0 text-[11px] leading-relaxed text-[#68788b]">{description}</p>
    </article>
  );
}

export function OverviewDashboard({ data, pulse = [], featureFlags = { flags: { social_feed: false, pro_tier: false, maintenance_mode: false }, configured: false }, canManage = true }: { data: AdminOverview; pulse?: AdminPulseItem[]; featureFlags?: AdminFeatureFlagState; canManage?: boolean }) {
  return (
    <div className="space-y-7 sm:space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 mt-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#087f8c]">Platform pulse</p>
          <h1 className="!m-0 !text-[32px] !font-semibold !leading-tight !tracking-[-0.045em] text-[#172638] sm:!text-[36px]">Overview</h1>
          <p className="mb-0 mt-2 text-[13px] leading-relaxed text-[#68788b]">A clear view of your community and its training.</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#68788b]">
          <CalendarDays size={14} aria-hidden="true" />
          <span>Snapshot · <time dateTime={data.asOf}>{snapshotFormat.format(new Date(data.asOf))} UTC</time></span>
        </div>
      </header>

      <section aria-label="Platform statistics" className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4 xl:gap-4">
        <StatCard label="Total users" value={data.totalUsers} description="Registered accounts on the platform" icon={Users} />
        <StatCard label="Workouts today" value={data.workoutsToday} description="Completed and synced today · UTC" icon={Dumbbell} />
        <StatCard label="Exercises in database" value={data.totalExercises} description="Synced custom definitions" icon={Database} />
        <StatCard label="New signups this week" value={data.signupsThisWeek} description="Registered since Monday · UTC" icon={UserPlus} />
      </section>

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <UserGrowthChart growth={data.growth} />

        <aside className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-1" aria-label="Platform context and management">
          <section className="admin-panel rounded-xl border border-[#e2e8ef] bg-white p-5 sm:p-6" aria-labelledby="platform-snapshot-heading">
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 id="platform-snapshot-heading" className="!m-0 !text-[14px] !font-semibold !tracking-[-0.02em] text-[#172638]">Exercise inventory</h2>
              <BookOpen size={16} className="text-[#8795a4]" aria-hidden="true" />
            </div>
            <dl className="m-0 space-y-4 text-[12px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-[#68788b]"><span className="h-1.5 w-1.5 rounded-full bg-[#087f8c]" aria-hidden="true" />Built-in catalog</dt>
                <dd className="m-0 font-semibold text-[#172638] tabular-nums">{numberFormat.format(data.builtInExercises)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-[#68788b]"><span className="h-1.5 w-1.5 rounded-full bg-[#a3b1bf]" aria-hidden="true" />Custom in database</dt>
                <dd className="m-0 font-semibold text-[#172638] tabular-nums">{numberFormat.format(data.customExercises)}</dd>
              </div>
            </dl>
            <p className="mb-0 mt-5 border-t border-[#edf1f5] pt-4 text-[11px] leading-relaxed text-[#68788b]">The built-in catalog ships with the app. Custom definitions appear here after syncing.</p>
          </section>

          <section className="admin-panel rounded-xl border border-[#e2e8ef] bg-white p-5 sm:p-6" aria-labelledby="manage-platform-heading">
            <h2 id="manage-platform-heading" className="!mb-3 !mt-0 !text-[14px] !font-semibold !tracking-[-0.02em] text-[#172638]">Manage your platform</h2>
            <div className="divide-y divide-[#edf1f5]">
              <AdminLink href="/admin/users" className="group flex min-h-16 items-center gap-3 py-3 text-[#172638]">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#f3f7f9] text-[#68788b] transition-colors group-hover:bg-[#e7f3f4] group-hover:text-[#087f8c]"><Users size={16} aria-hidden="true" /></span>
                <span className="flex-1"><span className="block text-[12px] font-medium">Users</span><span className="mt-0.5 block text-[11px] text-[#68788b]">Explore your community</span></span>
                <ArrowRight size={15} className="text-[#8795a4] transition-transform group-hover:translate-x-0.5 group-hover:text-[#087f8c]" aria-hidden="true" />
              </AdminLink>
              <AdminLink href="/admin/exercises" className="group flex min-h-16 items-center gap-3 py-3 text-[#172638]">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#f3f7f9] text-[#68788b] transition-colors group-hover:bg-[#e7f3f4] group-hover:text-[#087f8c]"><Dumbbell size={16} aria-hidden="true" /></span>
                <span className="flex-1"><span className="block text-[12px] font-medium">Exercises</span><span className="mt-0.5 block text-[11px] text-[#68788b]">Review exercise definitions</span></span>
                <ArrowRight size={15} className="text-[#8795a4] transition-transform group-hover:translate-x-0.5 group-hover:text-[#087f8c]" aria-hidden="true" />
              </AdminLink>
            </div>
          </section>
        </aside>
      </div>

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
        <AdminLivePulse initialItems={pulse}/>
        <FeatureFlags initialFlags={featureFlags.flags} configured={featureFlags.configured} canManage={canManage}/>
      </div>

      <div className="flex items-start gap-2.5 border-t border-[#e2e8ef] pt-4 text-[11px] leading-relaxed text-[#68788b]">
        <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p className="m-0">Counts reflect synced platform records. Sessions in progress are not tracked by the server. Today and this week use UTC.</p>
      </div>
    </div>
  );
}
