"use client";

import { useId } from "react";
import { ChevronDown, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { AdminOverview } from "@/features/admin/model";

type GrowthPoint = AdminOverview["growth"][number];
const numberFormat = new Intl.NumberFormat("en");
const compactFormat = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const shortDateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const fullDateFormat = new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

function formatDay(date: string, full = false) {
  return (full ? fullDateFormat : shortDateFormat).format(new Date(`${date}T00:00:00Z`));
}

function GrowthTooltip({ active, payload, label }: TooltipContentProps) {
  const count = payload?.[0]?.value;
  if (!active || typeof count !== "number" || typeof label !== "string") return null;

  return (
    <div className="rounded-lg border border-[#e2e8ef] bg-white px-3.5 py-3 shadow-lg shadow-[#172638]/5">
      <p className="m-0 text-[11px] text-[#68788b]">{formatDay(label, true)}</p>
      <p className="mb-0 mt-1.5 flex items-center gap-2 text-[12px] text-[#172638]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#087f8c]" aria-hidden="true" />
        <strong className="font-semibold tabular-nums">{numberFormat.format(count)}</strong> registered {count === 1 ? "account" : "accounts"}
      </p>
    </div>
  );
}

export function UserGrowthChart({ growth }: { growth: GrowthPoint[] }) {
  const id = useId().replaceAll(":", "");
  const gradientId = `admin-user-growth-${id}`;
  const headingId = `admin-user-growth-heading-${id}`;
  const summaryId = `admin-user-growth-summary-${id}`;
  const points = [...growth].sort((left, right) => left.date.localeCompare(right.date));
  const first = points[0];
  const latest = points[points.length - 1];
  const hasUsers = points.some(point => point.users > 0);

  return (
    <section className="admin-panel min-w-0 overflow-hidden rounded-xl border border-[#e2e8ef] bg-white" aria-labelledby={headingId}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-6 sm:px-6">
        <div>
          <h2 id={headingId} className="!m-0 !text-[16px] !font-semibold !tracking-[-0.02em] text-[#172638]">User growth</h2>
          <p className="mb-0 mt-1.5 text-[12px] text-[#68788b]">Cumulative registered accounts</p>
        </div>
        <span className="rounded-md border border-[#e2e8ef] bg-[#fafbfd] px-2.5 py-1.5 text-[10px] font-medium text-[#68788b]">{points.length === 30 ? "Last 30 days" : `${points.length} daily observations`}</span>
      </header>

      {hasUsers && first && latest ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3 px-5 pb-3 pt-6 sm:px-6">
            <div>
              <p className="m-0 text-[30px] font-semibold leading-none tracking-[-0.045em] text-[#172638] tabular-nums">{numberFormat.format(latest.users)}</p>
              <p className="mb-0 mt-2 text-[11px] text-[#68788b]">{latest.users === 1 ? "account" : "accounts"} by {formatDay(latest.date)}</p>
            </div>
            <div className="mb-0.5 flex items-center gap-1.5 text-[10px] text-[#68788b]"><span className="h-1.5 w-1.5 rounded-full bg-[#087f8c]" aria-hidden="true" />Registered accounts</div>
          </div>
          <p id={summaryId} className="sr-only">Cumulative registered accounts from {formatDay(first.date, true)} to {formatDay(latest.date, true)}. The count starts at {numberFormat.format(first.users)} and ends at {numberFormat.format(latest.users)}. Use the arrow keys on the chart to inspect daily values, or open the daily counts table below.</p>
          <div className="h-[260px] min-w-0 px-2 sm:h-[285px] sm:px-4" role="group" aria-label="Cumulative user growth chart" aria-describedby={summaryId}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 700, height: 285 }}>
              <AreaChart data={points} margin={{ top: 15, right: 12, bottom: 5, left: 0 }} accessibilityLayer>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#25262b" strokeDasharray="3 4" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#85868f", fontSize: 10 }} tickMargin={12} minTickGap={35} interval="preserveStartEnd" tickFormatter={date => formatDay(String(date))} />
                <YAxis width={48} axisLine={false} tickLine={false} tick={{ fill: "#85868f", fontSize: 10 }} tickMargin={9} allowDecimals={false} domain={[0, (maximum: number) => Math.max(4, maximum + Math.ceil(maximum * 0.08))]} tickFormatter={value => Number(value) >= 10000 ? compactFormat.format(Number(value)) : numberFormat.format(Number(value))} />
                <Tooltip content={GrowthTooltip} cursor={{ stroke: "#425b81", strokeDasharray: "3 4" }} />
                <Area type="monotone" dataKey="users" name="Registered accounts" stroke="#3b82f6" strokeWidth={2.2} fill={`url(#${gradientId})`} dot={points.length === 1 ? { r: 3, fill: "#3b82f6", stroke: "#09090b", strokeWidth: 2 } : false} activeDot={{ r: 4, stroke: "#09090b", strokeWidth: 2, fill: "#3b82f6" }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="px-5 pb-5 pt-3 sm:px-6">
            <p className="m-0 text-[10px] leading-relaxed text-[#8795a4]">{formatDay(first.date)}–{formatDay(latest.date)} · Daily account totals by signup date · UTC</p>
          </div>
        </>
      ) : (
        <div className="flex min-h-[310px] flex-col items-center justify-center px-6 py-10 text-center">
          <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-[#eef7f8] text-[#087f8c]"><TrendingUp size={21} strokeWidth={1.6} aria-hidden="true" /></span>
          <h3 className="!m-0 !text-[14px] !font-semibold !tracking-normal text-[#172638]">{points.length ? "Your community starts here" : "No signup history available"}</h3>
          <p className="mb-0 mt-2 max-w-[280px] text-[12px] leading-relaxed text-[#68788b]">{points.length ? "As people create accounts, their registrations will build this growth curve." : "Daily account totals will appear here when signup history is available."}</p>
        </div>
      )}

      {points.length > 0 && (
        <details className="group border-t border-[#edf1f5]">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 text-[11px] font-medium text-[#68788b] transition-colors hover:bg-[#fafbfd] hover:text-[#087f8c] sm:px-6 [&::-webkit-details-marker]:hidden">
            View daily counts
            <ChevronDown size={14} className="transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="max-h-72 overflow-auto px-5 pb-4 sm:px-6">
            <table className="w-full border-collapse text-left text-[11px]">
              <caption className="sr-only">Cumulative registered accounts by UTC signup date</caption>
              <thead className="sticky top-0 bg-white text-[#68788b]"><tr><th scope="col" className="border-b border-[#e2e8ef] py-2 font-medium">Date (UTC)</th><th scope="col" className="border-b border-[#e2e8ef] py-2 text-right font-medium">Registered accounts</th></tr></thead>
              <tbody>{points.map(point => <tr key={point.date} className="border-b border-[#f0f3f6] last:border-0"><th scope="row" className="py-2.5 font-normal text-[#68788b]"><time dateTime={point.date}>{formatDay(point.date, true)}</time></th><td className="py-2.5 text-right text-[#172638] tabular-nums">{numberFormat.format(point.users)}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
