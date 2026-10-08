"use client";

import { useId } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import styles from "./charts.module.css";

export type ChartDatum = { id: string; label: string; date: string; value: number; secondary?: number | null; detail?: string; fullDate?: string };

function dateValue(date: string) {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00` : date);
}
function fullDate(date: string) {
  const value = dateValue(date);
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? value.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : value.toLocaleString(undefined, { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" });
}
const number = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
const compact = (value: number) => new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);

function ExactTooltip({ active, payload, unit, secondaryLabel }: Pick<TooltipContentProps, "active" | "payload"> & { unit: string; secondaryLabel?: string }) {
  const point = payload?.[0]?.payload as ChartDatum | undefined;
  if (!active || !point) return null;
  return <div className={styles.tooltip} role="status" aria-live="polite">
    <span>{point.fullDate || fullDate(point.date)}</span>
    <strong>{number(point.value)} <small>{unit}</small></strong>
    {typeof point.secondary === "number" && secondaryLabel && <p>{secondaryLabel}: {number(point.secondary)}%</p>}
    {point.detail && <p>{point.detail}</p>}
  </div>;
}

export default function InteractiveChart({ points, label, unit, kind = "line", secondaryLabel }: {
  points: ChartDatum[]; label: string; unit: string; kind?: "bar" | "line"; secondaryLabel?: string;
}) {
  const id = useId().replace(/:/g, "");
  const data = points.map(point => ({ ...point, timestamp: dateValue(point.date).getTime() }));
  const singleDate = data.length === 1 ? data[0].timestamp : null;
  const sameDay = data.length > 1 && Math.max(...data.map(point => point.timestamp)) - Math.min(...data.map(point => point.timestamp)) < 86_400_000;
  const hasSecondary = Boolean(secondaryLabel && points.some(point => typeof point.secondary === "number"));
  return <figure className={styles.figure} aria-label={label}>
    <div className={styles.plot}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 360, height: 228 }}>
        <ComposedChart data={data} margin={{ top: 16, right: hasSecondary ? 0 : 14, bottom: 4, left: -12 }} accessibilityLayer aria-label={`${label}; use arrow keys to explore values`}>
          <defs><linearGradient id={`chart-fill-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-accent)" stopOpacity={.22}/><stop offset="100%" stopColor="var(--chart-accent)" stopOpacity={0}/></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="var(--feature-border)" strokeDasharray="3 6"/>
          {kind === "bar" ? <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--feature-muted)", fontSize: 11 }} interval={0} tickMargin={12}/> : <XAxis dataKey="timestamp" type="number" scale="time" domain={singleDate === null ? ["dataMin", "dataMax"] : [singleDate - 86_400_000, singleDate + 86_400_000]} tickFormatter={timestamp => sameDay ? new Date(timestamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })} tickLine={false} axisLine={false} tick={{ fill: "var(--feature-muted)", fontSize: 11 }} tickMargin={12} minTickGap={28} tickCount={4}/>}
          <YAxis tickFormatter={compact} tickLine={false} axisLine={false} tick={{ fill: "var(--feature-muted)", fontSize: 11 }} width={56} tickCount={4} domain={kind === "bar" ? [0, "auto"] : [(min: number) => Math.max(0, Math.floor(min * .9)), (max: number) => Math.ceil(max * 1.1)]}/>
          {hasSecondary && <YAxis yAxisId="secondary" orientation="right" domain={[0, 60]} tickFormatter={value => `${value}%`} tickLine={false} axisLine={false} tick={{ fill: "var(--feature-muted)", fontSize: 10 }} width={38}/>}
          <Tooltip trigger="click" isAnimationActive={false} cursor={kind === "bar" ? { fill: "var(--chart-accent)", fillOpacity: .06 } : { stroke: "var(--feature-muted)", strokeDasharray: "3 4" }} content={props => <ExactTooltip {...props} unit={unit} secondaryLabel={secondaryLabel}/>} wrapperStyle={{ zIndex: 2, pointerEvents: "none" }}/>
          {kind === "bar" ? <Bar dataKey="value" name={label} fill="var(--chart-accent)" radius={[5, 5, 0, 0]} maxBarSize={48} isAnimationActive="auto" animationDuration={350}/> : <Area dataKey="value" name={label} type="monotone" stroke="var(--chart-accent)" strokeWidth={2.5} fill={`url(#chart-fill-${id})`} dot={{ r: 4, strokeWidth: 2, stroke: "var(--feature-card)", fill: "var(--chart-accent)" }} activeDot={{ r: 6, stroke: "var(--feature-card)", strokeWidth: 3 }} isAnimationActive="auto" animationDuration={350}/>}
          {hasSecondary && <Line yAxisId="secondary" dataKey="secondary" name={secondaryLabel} stroke="var(--chart-secondary)" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} connectNulls={false} isAnimationActive="auto" animationDuration={350}/>}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <figcaption className={styles.caption}><span>{kind === "bar" ? "Tap a bar for the exact total" : "Tap a point for the exact value"}</span><span>{unit}{hasSecondary ? " · dashed: body fat %" : ""}</span></figcaption>
    <details className={styles.data}><summary>View chart data</summary><div className={styles.tableScroll}><table><caption className={styles.srOnly}>{label}</caption><thead><tr><th scope="col">Date</th><th scope="col">{unit}</th>{hasSecondary && <th scope="col">{secondaryLabel}</th>}</tr></thead><tbody>{points.map(point => <tr key={point.id}><th scope="row">{point.fullDate || fullDate(point.date)}{point.detail && <small>{point.detail}</small>}</th><td>{number(point.value)}</td>{hasSecondary && <td>{point.secondary == null ? "—" : `${number(point.secondary)}%`}</td>}</tr>)}</tbody></table></div></details>
  </figure>;
}
