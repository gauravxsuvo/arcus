"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BarChart3, TrendingUp } from "lucide-react";
import { buildWeeklyVolume, type OneRepMaxMethod } from "@/features/analytics/engine";
import { buildExerciseTrend, strengthExerciseOptions, type StrengthMetric } from "@/features/analytics/chart-data";
import { formatWeight, toDisplayWeight, weightUnit } from "@/features/training/logic";
import { useProfile } from "@/components/shared/user-profile-provider";
import type { WorkoutRecord } from "@/features/workouts/model";
import InteractiveChart from "./interactive-chart";
import styles from "./charts.module.css";

export default function ProgressCharts({ workouts, method }: { workouts: WorkoutRecord[]; method: OneRepMaxMethod }) {
  const { preferences } = useProfile();
  const units = preferences.units;
  const options = useMemo(() => strengthExerciseOptions(workouts), [workouts]);
  const [chosen, setChosen] = useState("");
  const exerciseId = options.some(option => option.id === chosen) ? chosen : options[0]?.id || "";
  const [metric, setMetric] = useState<StrengthMetric>("estimated_1rm");
  const weeks = useMemo(() => buildWeeklyVolume(workouts, 4, new Date(), preferences.weekStart), [workouts, preferences.weekStart]);
  const trend = useMemo(() => buildExerciseTrend(workouts, exerciseId, metric, method), [workouts, exerciseId, metric, method]);
  const total = weeks.reduce((sum, week) => sum + week.volume, 0);
  const sessions = weeks.reduce((sum, week) => sum + week.sessions, 0);
  const rawChange = trend.length > 1 ? trend[trend.length - 1].value - trend[0].value : null;
  const change = rawChange !== null && Math.abs(toDisplayWeight(rawChange, units)) < .05 ? 0 : rawChange;
  return <section className={styles.grid} aria-label="Your training trends">
    <article className={styles.card}>
      <header className={styles.heading}><div><p>WORKLOAD</p><h2>Weekly volume</h2></div><BarChart3 size={20} aria-hidden="true"/></header>
      <div className={styles.summary}><strong>{formatWeight(total, units)}</strong><span>Last 4 weeks · {sessions} {sessions === 1 ? "session" : "sessions"}</span></div>
      {total > 0 ? <InteractiveChart label="Weekly training volume over the last four weeks" unit={weightUnit(units)} kind="bar" points={weeks.map(week => {
        const end = new Date(week.start); end.setDate(end.getDate() + 6);
        return { id: week.start.toISOString(), date: week.start.toISOString(), label: week.label, value: toDisplayWeight(week.volume, units), fullDate: `${week.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`, detail: `${week.sessions} completed ${week.sessions === 1 ? "session" : "sessions"}` };
      })}/> : <div className={styles.empty}><BarChart3 size={28}/><h3>Your work will show here.</h3><p>Complete a weighted set to build your weekly volume chart.</p><Link href="/workout">Start a workout <ArrowUpRight size={15}/></Link></div>}
      <p className={styles.note}>Completed working sets · weight × reps · week starts {preferences.weekStart}.</p>
    </article>
    <article className={styles.card}>
      <header className={styles.heading}><div><p>STRENGTH</p><h2>Lift progression</h2></div><TrendingUp size={20} aria-hidden="true"/></header>
      {options.length > 0 && <><label className={styles.exerciseSelect}>Exercise<select aria-label="Progress chart exercise" value={exerciseId} onChange={event => setChosen(event.target.value)}>{options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><div className={styles.tabs} role="group" aria-label="Strength chart metric">{([['estimated_1rm','Estimated 1RM'],['top_weight','Top weight']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={metric === value} onClick={() => setMetric(value)}>{label}</button>)}</div></>}
      {trend.length > 0 ? <><div className={styles.strengthSummary}><strong>{formatWeight(trend[trend.length - 1].value, units)}</strong>{change !== null && <span className={change > 0 ? styles.positive : undefined}>{change > 0 ? "+" : ""}{formatWeight(change, units)} across {trend.length} sessions</span>}</div><InteractiveChart key={`${exerciseId}-${metric}-${method}-${units}`} label={metric === "estimated_1rm" ? "Estimated one rep max over time" : "Heaviest working weight over time"} unit={weightUnit(units)} points={trend.map(point => ({ ...point, label: new Date(point.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: toDisplayWeight(point.value, units), detail: point.name }))}/></> : <div className={styles.empty}><TrendingUp size={28}/><h3>{options.length ? "A little more data needed." : "Your strength story starts here."}</h3><p>{options.length ? "Estimated 1RM uses weighted working sets of 1–12 reps. Try Top weight for higher-rep sessions." : "Log weighted working sets, then choose a lift to see its progress."}</p><Link href="/workout">Log a session <ArrowUpRight size={15}/></Link></div>}
      <p className={styles.note}>{metric === "estimated_1rm" ? `${method === "epley" ? "Epley" : "Brzycki"} estimate · 1–12 reps · ` : "Heaviest completed working set · "}last 30 sessions.{trend.length === 1 ? " Add another session to see a trend." : ""}</p>
    </article>
  </section>;
}
