"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BarChart3, Check, Dumbbell, Plus, Scale, Target } from "lucide-react";
import { buildWeeklyVolume, calculateMuscleVolume, estimateOneRepMax, findPersonalRecords, getCompletedSets, recommendNextLoad } from "@/features/analytics/engine";
import type { WorkoutExercise } from "@/features/workouts/model";
import type { PhysiqueEntry } from "@/features/physique/model";
import { MEASUREMENT_SITES } from "@/features/physique/model";
import { deletePhysiqueEntry, listPhysiqueEntries, savePhysiqueEntry } from "@/features/local-data/repository";
import { getCompletedWorkouts } from "@/features/workouts/repository";
import type { WorkoutRecord } from "@/features/workouts/model";
import { syncPhysiqueEntry } from "@/features/workouts/sync";

function TrendChart({ values, label, color = "#c4ed76", zeroBaseline = false }: { values: { label: string; value: number }[]; label: string; color?: string; zeroBaseline?: boolean }) {
  const width = 640, height = 170, pad = 22;
  const max = Math.max(...values.map((item) => item.value), 1);
  const min = zeroBaseline ? Math.min(...values.map((item) => item.value), 0) : Math.min(...values.map((item) => item.value));
  const range = max - min || 1;
  const points = values.map((item, index) => ({
    x: pad + (values.length <= 1 ? (width - pad * 2) / 2 : index * (width - pad * 2) / (values.length - 1)),
    y: height - pad - ((item.value - min) / range) * (height - pad * 2),
  }));
  return <div className="trend-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
    {[0, 1, 2, 3].map((line) => <line key={line} x1={pad} x2={width - pad} y1={pad + line * (height - pad * 2) / 3} y2={pad + line * (height - pad * 2) / 3} stroke="#30372e" strokeDasharray="3 6"/>)}
    {points.length > 1 && <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points.map((point) => `${point.x},${point.y}`).join(" ")}/>}
    {points.map((point, index) => <circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r="3.5" fill={color}/>)}
    {values.map((item, index) => <text key={`${item.label}-${index}`} x={points[index]?.x ?? width / 2} y={height - 2} textAnchor="middle" fill="#7e8978" fontSize="9">{item.label}</text>)}
  </svg><div className="chart-range"><span>{Math.round(min).toLocaleString()}</span><span>{Math.round(max).toLocaleString()}</span></div></div>;
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function createEntry(kind: PhysiqueEntry["kind"], metric: string, value: number, unit: PhysiqueEntry["unit"]): PhysiqueEntry {
  return { id: crypto.randomUUID(), kind, metric, value, unit, measuredAt: new Date().toISOString(), notes: "", syncStatus: "pending" };
}

export default function ProgressPage() {
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([]);
  const [entries, setEntries] = useState<PhysiqueEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [bodyweightValue, setBodyweightValue] = useState("");
  const [measurementValue, setMeasurementValue] = useState("");
  const [measurementSite, setMeasurementSite] = useState<string>(MEASUREMENT_SITES[0]);

  const refresh = async () => {
    const [history, physique] = await Promise.all([getCompletedWorkouts(), listPhysiqueEntries()]);
    setWorkouts(history); setEntries(physique); setReady(true);
  };
  useEffect(() => { let cancelled = false; void Promise.all([getCompletedWorkouts(), listPhysiqueEntries()]).then(([history, physique]) => { if (!cancelled) { setWorkouts(history); setEntries(physique); setReady(true); } }).catch(() => { if (!cancelled) { setMessage("Could not load saved training data."); setReady(true); } }); return () => { cancelled = true; }; }, []);

  const weekly = useMemo(() => buildWeeklyVolume(workouts), [workouts]);
  const muscles = useMemo(() => calculateMuscleVolume(workouts), [workouts]);
  const prs = useMemo(() => findPersonalRecords(workouts), [workouts]);
  const bestE1rm = useMemo(() => workouts.flatMap((workout) => workout.exercises.flatMap((exercise) => getCompletedSets(exercise).map((set) => estimateOneRepMax(set.weight ?? 0, set.reps ?? 0)))).reduce((best, value) => Math.max(best, value), 0), [workouts]);
  const bodyweight = entries.filter((entry) => entry.kind === "bodyweight").sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const bodyweightChange = bodyweight.length > 1 ? bodyweight[bodyweight.length - 1].value - bodyweight[0].value : null;
  const totalVolume = weekly.reduce((sum, item) => sum + item.volume, 0);
  const recentlySeen = new Set<string>();
  const progression: WorkoutExercise[] = [];
  for (const workout of workouts) for (const exercise of workout.exercises) if (!recentlySeen.has(exercise.exerciseId)) { recentlySeen.add(exercise.exerciseId); progression.push(exercise); }

  async function logBodyweight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(bodyweightValue);
    if (!Number.isFinite(value) || value < 20 || value > 500) { setMessage("Enter a bodyweight between 20 and 500 kg."); return; }
    const entry = createEntry("bodyweight", "Bodyweight", value, "kg");
    await savePhysiqueEntry(entry);
    void syncPhysiqueEntry(entry).catch(() => savePhysiqueEntry({ ...entry, syncStatus: "error" }));
    setBodyweightValue(""); setMessage("Bodyweight saved on this device."); await refresh();
  }

  async function logMeasurement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(measurementValue);
    if (!Number.isFinite(value) || value < 1 || value > 300) { setMessage("Enter a measurement between 1 and 300 cm."); return; }
    const entry = createEntry("measurement", measurementSite, value, "cm");
    await savePhysiqueEntry(entry);
    void syncPhysiqueEntry(entry).catch(() => savePhysiqueEntry({ ...entry, syncStatus: "error" }));
    setMeasurementValue(""); setMessage(`${measurementSite} measurement saved on this device.`); await refresh();
  }

  async function removeEntry(entry: PhysiqueEntry) {
    if (!window.confirm(`Delete this ${entry.kind === "bodyweight" ? "bodyweight" : `${entry.metric} measurement`} entry?`)) return;
    await deletePhysiqueEntry(entry.id); await refresh();
    void syncPhysiqueEntry({ ...entry, deleted: true, syncStatus: "pending" }).catch(() => undefined);
  }

  return <main className="workout-shell progress-shell"><header className="workout-top"><Link className="back-link" href="/dashboard"><ArrowLeft size={17}/> Dashboard</Link><Link className="offline-badge" href="/workout"><span/> TRAINING LOG</Link></header>
    <section className="history-heading"><p className="eyebrow"><span className="live-dot"/> PERFORMANCE & PHYSIQUE</p><h1>Progress<span>.</span></h1><p>Trends and training records calculated from your completed sessions.</p></section>
    {!ready ? <div className="loading-block">Loading your training data…</div> : <>
      <section className="progress-stats"><article><span>SESSIONS</span><strong>{workouts.length}</strong><small>completed workouts</small></article><article><span>12 WEEK VOLUME</span><strong>{totalVolume.toLocaleString()}</strong><small>kg lifted</small></article><article><span>BEST EST. 1RM</span><strong>{bestE1rm ? `${bestE1rm.toFixed(1)} kg` : "—"}</strong><small>Epley estimate · see methodology</small></article><article><span>PERSONAL RECORDS</span><strong>{prs.length}</strong><small>estimated 1RM milestones</small></article></section>
      <section className="analytics-grid"><article className="analytics-panel volume-panel"><div className="panel-heading"><div><p className="eyebrow">CONSISTENCY + WORKLOAD</p><h2>Weekly volume</h2></div><BarChart3 size={18} className="panel-icon"/></div><TrendChart zeroBaseline label="Weekly completed training volume in kilograms" values={weekly.map((item) => ({ label: item.label, value: item.volume }))}/><div className="weekly-legend"><span><i/> VOLUME · KG</span><span>{weekly.reduce((sum, item) => sum + item.sessions, 0)} SESSIONS · 12 WEEKS</span></div></article>
        <article className="analytics-panel"><div className="panel-heading"><div><p className="eyebrow">DISTRIBUTION MODEL</p><h2>Muscles trained</h2></div><Target size={18} className="panel-icon"/></div>{muscles.length ? <div className="muscle-list">{muscles.slice(0, 8).map((item) => <div className="muscle-line" key={item.muscle}><div><span>{item.muscle}</span><small>{item.volume.toLocaleString()} kg</small></div><div className="muscle-bar"><i style={{ width: `${Math.max(3, item.volume / muscles[0].volume * 100)}%` }}/></div></div>)}</div> : <div className="analytics-empty">Complete a workout to see the muscle groups in your log.</div>}<p className="method-note">Uses each exercise’s primary muscle. This reflects catalog classification, not measured physiological stimulus.</p></article>
      </section>

      <section className="analytics-grid lower-analytics"><article className="analytics-panel"><div className="panel-heading"><div><p className="eyebrow">STRENGTH MILESTONES</p><h2>Personal records</h2></div><Target size={18} className="panel-icon"/></div>{prs.length ? <div className="pr-list">{prs.slice(0, 6).map((pr) => <div className="pr-row" key={`${pr.workoutId}-${pr.exerciseId}-${pr.weight}-${pr.reps}`}><span className="pr-badge"><Check size={14}/></span><span className="pr-main"><strong>{pr.exerciseName}</strong><small>{displayDate(pr.workoutDate)} · {pr.weight} kg × {pr.reps}</small></span><span className="pr-value">{pr.estimatedOneRepMax.toFixed(1)}<small> e1RM</small></span></div>)}</div> : <div className="analytics-empty">Your first estimated strength record will appear after you log weighted sets.</div>}<p className="method-note">Estimated 1RM uses the Epley formula for sets of 1–12 reps and is a training estimate, not a tested max.</p></article>
        <article className="analytics-panel"><div className="panel-heading"><div><p className="eyebrow">NEXT SESSION GUIDANCE</p><h2>Load suggestions</h2></div><ArrowUpRight size={18} className="panel-icon"/></div>{progression.length ? <div className="suggestion-list">{progression.slice(0, 5).map((exercise) => { const suggestion = recommendNextLoad(exercise); return <div className="suggestion-row" key={exercise.id}><Dumbbell size={15}/><div><strong>{exercise.name}</strong><small>{suggestion.reason}</small></div>{suggestion.load !== null && <b>{suggestion.load} kg</b>}</div>; })}</div> : <div className="analytics-empty">Log a few working sets to get explainable load suggestions.</div>}<p className="method-note">Double progression: increase by 2.5 kg after all completed sets reach 12 reps. Confirm the suggestion suits your equipment and plan.</p></article></section>

      <section className="physique-section"><div className="panel-heading"><div><p className="eyebrow">BODYWEIGHT & MEASUREMENTS</p><h2>Track the whole picture</h2></div><Scale size={18} className="panel-icon"/></div><div className="physique-grid"><article className="analytics-panel physique-card"><h3>Bodyweight</h3><p>Log in kilograms. Entries are saved on this device.</p><form className="physique-form" onSubmit={(event) => void logBodyweight(event)}><input aria-label="Bodyweight in kg" inputMode="decimal" type="number" min="20" max="500" step="0.1" placeholder="e.g. 72.4" value={bodyweightValue} onChange={(event) => setBodyweightValue(event.target.value)} required/><span>KG</span><button className="small-action" aria-label="Save bodyweight"><Plus size={16}/></button></form>{bodyweight.length > 1 && <><div className="bodyweight-stat"><strong>{bodyweight[bodyweight.length - 1].value.toFixed(1)} kg</strong><span>{bodyweightChange !== null && `${bodyweightChange > 0 ? "+" : ""}${bodyweightChange.toFixed(1)} kg since first log`}</span></div><TrendChart label="Bodyweight trend in kilograms" color="#91b8ff" values={bodyweight.slice(-12).map((item) => ({ label: displayDate(item.measuredAt), value: item.value }))}/></>}{bodyweight.length === 0 && <div className="analytics-empty compact-empty">Your weight trend will appear here.</div>}</article>
        <article className="analytics-panel physique-card"><h3>Body measurements</h3><p>Measure under similar conditions for useful comparisons.</p><form className="measurement-form" onSubmit={(event) => void logMeasurement(event)}><select aria-label="Measurement area" value={measurementSite} onChange={(event) => setMeasurementSite(event.target.value)}>{MEASUREMENT_SITES.map((site) => <option key={site}>{site}</option>)}</select><input aria-label="Measurement in centimeters" inputMode="decimal" type="number" min="1" max="300" step="0.1" placeholder="cm" value={measurementValue} onChange={(event) => setMeasurementValue(event.target.value)} required/><button className="small-action" aria-label="Save measurement"><Plus size={16}/></button></form><div className="measurement-list">{entries.filter((item) => item.kind === "measurement").slice(0, 6).map((entry) => <div className="measurement-row" key={entry.id}><span>{entry.metric}<small>{displayDate(entry.measuredAt)}</small></span><strong>{entry.value.toFixed(1)} cm</strong><button onClick={() => void removeEntry(entry)} aria-label={`Delete ${entry.metric} measurement`}>×</button></div>)}{entries.every((item) => item.kind !== "measurement") && <div className="analytics-empty compact-empty">Your measurements will be listed here.</div>}</div></article></div></section>
    </>}{message && <p role="status" className="inline-message">{message}</p>}
  </main>;
}
