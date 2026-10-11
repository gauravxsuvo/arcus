"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Scale } from "lucide-react";
import { buildWeightTrend, type WeightLog } from "@/features/weight/weight-trend";
import { formatWeight, toDisplayWeight, weightUnit } from "@/features/training/logic";
import styles from "./weight.module.css";

type UnitPreference = "metric" | "imperial";
type ApiLog = WeightLog & { updatedAt?: string };
function displayDate(value: string) { const date = new Date(`${value}T00:00:00`); return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date); }
function displayWeight(value: number, units: UnitPreference) { return formatWeight(value, units, 1).replace(/\s(?:kg|lb)$/, ""); }

export function WeightTrendChart({ units }: { units: UnitPreference }) {
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "signed-out" | "error">("loading");
  const unit = weightUnit(units) === "lb" ? "lbs" : "kg";
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/recovery/weight", { cache: "no-store" });
      if (response.status === 401) { setStatus("signed-out"); return; }
      if (!response.ok) throw new Error("Could not load weigh-ins");
      const data = await response.json() as { logs?: ApiLog[] };
      setLogs(Array.isArray(data.logs) ? data.logs : []); setStatus("ready");
    } catch { setStatus("error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ log?: ApiLog; rollback?: boolean }>).detail;
      if (detail?.rollback) { void load(); return; }
      if (detail?.log) setLogs((current) => [detail.log!, ...current.filter((item) => item.date !== detail.log!.date)].sort((a, b) => b.date.localeCompare(a.date)));
    };
    window.addEventListener("arcus-weight-log-updated", update);
    return () => window.removeEventListener("arcus-weight-log-updated", update);
  }, [load]);
  const trend = useMemo(() => buildWeightTrend(logs), [logs]);
  const plot = useMemo(() => {
    const valid = trend.points.filter((point) => Number.isFinite(point.weightKg));
    if (valid.length < 2) return null;
    const values = [...valid.map((point) => toDisplayWeight(point.weightKg, units)), ...trend.points.flatMap((point) => point.average7dKg === null ? [] : [toDisplayWeight(point.average7dKg, units)])];
    const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
    const xAt = (date: string) => 18 + (trend.points.findIndex((point) => point.date === date) / Math.max(1, trend.points.length - 1)) * 364;
    const yAt = (value: number) => 126 - ((toDisplayWeight(value, units) - min) / span) * 100;
    const average = trend.points.filter((point) => point.average7dKg !== null).map((point) => `${xAt(point.date)},${yAt(point.average7dKg!)}`).join(" ");
    const raw = valid.map((point) => ({ x: xAt(point.date), y: yAt(point.weightKg), date: point.date, kg: point.weightKg }));
    return { average, raw, firstDate: trend.points[0]?.date, lastDate: trend.points.at(-1)?.date };
  }, [trend, units]);
  const current = trend.latestKg === null ? null : toDisplayWeight(trend.latestKg, units);
  const average = trend.average7dKg === null ? null : toDisplayWeight(trend.average7dKg, units);
  const delta = trend.delta30dKg === null ? null : toDisplayWeight(trend.delta30dKg, units);

  return <section className={styles.chartCard} aria-labelledby="weight-trend-title"><header className={styles.chartHeader}><div><p className={styles.eyebrow}>BODYWEIGHT</p><h2 id="weight-trend-title">7-day trend</h2></div><Scale size={18}/></header>
    {status === "loading" ? <div className={styles.chartSkeleton} role="status">Loading your weight trend…</div> : status === "signed-out" ? <div className={styles.chartEmpty}>Sign in to keep a private weight trend.</div> : status === "error" ? <div className={styles.chartEmpty}>Could not load weight history. Refresh to try again.</div> : logs.length === 0 ? <div className={styles.chartEmpty}>Your 7-day average will appear after your first weigh-in.</div> : <>
      <div className={styles.summary}><div><span>CURRENT</span><strong>{current === null ? "—" : displayWeight(current, units)} <small>{unit}</small></strong></div><div><span>7-DAY AVERAGE</span><strong>{average === null ? "—" : <>{displayWeight(average, units)} <small>{unit}</small></>}</strong></div><div><span>30-DAY CHANGE</span><strong className={delta === null ? "" : delta < 0 ? styles.down : styles.up}>{delta === null ? "—" : <>{delta < 0 ? <ArrowDownRight size={16}/> : <ArrowUpRight size={16}/>} {delta > 0 ? "+" : ""}{displayWeight(delta, units)} <small>{unit}</small></>}</strong></div></div>
      {plot && <div className={styles.plotWrap}><svg className={styles.plot} viewBox="0 0 400 150" role="img" aria-label={`Bodyweight raw entries and seven-day average from ${displayDate(plot.firstDate ?? "")} to ${displayDate(plot.lastDate ?? "")}`}><defs><filter id="weight-glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path className={styles.gridline} d="M18 26H382 M18 76H382 M18 126H382"/><polyline className={styles.averageLine} points={plot.average} filter="url(#weight-glow)"/>{plot.raw.map((point) => <circle key={point.date} className={styles.rawPoint} cx={point.x} cy={point.y} r="3.2"><title>{displayDate(point.date)} · {formatWeight(toDisplayWeight(point.kg, units), units, 1)} {unit}</title></circle>)}</svg><div className={styles.axis}><span>{plot.firstDate ? displayDate(plot.firstDate) : ""}</span><span>{plot.lastDate ? displayDate(plot.lastDate) : ""}</span></div><div className={styles.chartLegend}><span><i/> Raw weigh-in</span><span><b/> 7-day average</span></div></div>}
      <p className={styles.chartNote}>The average smooths daily fluctuations. A 30-day change appears after enough history is logged.</p>
    </>}
  </section>;
}
