"use client";

import { NumericInput } from "@/components/shared/numeric-input";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, Dumbbell, Plus, Scale, Target } from "lucide-react";
import { buildWeeklyVolume, calculateMuscleVolume, estimateOneRepMax, findPersonalRecords, getCompletedSets, recommendNextLoad, type OneRepMaxMethod } from "@/features/analytics/engine";
import type { WorkoutExercise } from "@/features/workouts/model";
import type { PhysiqueEntry } from "@/features/physique/model";
import { MEASUREMENT_SITES } from "@/features/physique/model";
import { deletePhysiqueEntry, listPhysiqueEntries, savePhysiqueEntry } from "@/features/local-data/repository";
import { getCompletedWorkouts } from "@/features/workouts/repository";
import type { WorkoutRecord } from "@/features/workouts/model";
import { syncPhysiqueEntry } from "@/features/workouts/sync";
import { findPlateauSignals, getReadinessLabel, getReadinessScore, type Readiness } from "@/features/analytics/intelligence";
import dynamic from "next/dynamic";
import { useProfile } from "@/components/shared/user-profile-provider";
import { formatWeight,formatLoadReason,fromDisplayWeight,toDisplayWeight,weightUnit } from "@/features/training/logic";
import { muscleRecovery } from "@/features/training/muscle-recovery";
import { LineChart } from "@/components/progress/line-chart";
const SleepTrendCard=dynamic(()=>import("@/components/recovery/SleepTrendCard").then(module=>module.SleepTrendCard),{ssr:false,loading:()=> <div className="analytics-panel" aria-hidden="true" style={{minHeight:260}}/>});
const WeightTrendChart=dynamic(()=>import("@/components/weight/WeightTrendChart").then(module=>module.WeightTrendChart),{ssr:false,loading:()=> <div className="analytics-panel" aria-hidden="true" style={{minHeight:280}}/>});
const ProgressCharts=dynamic(()=>import("@/components/progress/progress-charts"),{ssr:false,loading:()=> <div className="loading-block" role="status">Preparing your charts…</div>});
const AdvancedAnalytics=dynamic(()=>import("@/components/progress/advanced-analytics"),{ssr:false});

function displayDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function createEntry(kind: PhysiqueEntry["kind"], metric: string, value: number, unit: PhysiqueEntry["unit"]): PhysiqueEntry {
  return { id: crypto.randomUUID(), kind, metric, value, unit, measuredAt: new Date().toISOString(), notes: "", syncStatus: "pending" };
}

export default function ProgressPage() {
  const {preferences}=useProfile();const units=preferences.units;
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([]);
  const [entries, setEntries] = useState<PhysiqueEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [bodyweightValue, setBodyweightValue] = useState("");
  const [measurementValue, setMeasurementValue] = useState("");
  const [measurementSite, setMeasurementSite] = useState<string>(MEASUREMENT_SITES[0]);
  const [oneRepMaxMethod, setOneRepMaxMethod] = useState<OneRepMaxMethod>("epley");
  const [energy, setEnergy] = useState<number | null>(null);

  const refresh = async () => {
    const [history, physique] = await Promise.all([getCompletedWorkouts(), listPhysiqueEntries()]);
    setWorkouts(history); setEntries(physique); setReady(true);
  };
  useEffect(() => { let cancelled = false; void Promise.all([getCompletedWorkouts(), listPhysiqueEntries()]).then(([history, physique]) => { if (!cancelled) { setWorkouts(history); setEntries(physique); setReady(true); } }).catch(() => { if (!cancelled) { setMessage("Could not load saved training data."); setReady(true); } }); return () => { cancelled = true; }; }, []);

  const weekly = useMemo(() => buildWeeklyVolume(workouts,12,new Date(),preferences.weekStart), [workouts,preferences.weekStart]);
  const muscles = useMemo(() => calculateMuscleVolume(workouts), [workouts]);
  const recovery = useMemo(() => muscleRecovery(workouts), [workouts]);
  const prs = useMemo(() => findPersonalRecords(workouts, oneRepMaxMethod), [workouts, oneRepMaxMethod]);
  const bestE1rm = useMemo(() => workouts.flatMap((workout) => workout.exercises.flatMap((exercise) => getCompletedSets(exercise).map((set) => estimateOneRepMax(set.weight ?? 0, set.reps ?? 0, oneRepMaxMethod)))).reduce((best, value) => Math.max(best, value), 0), [workouts, oneRepMaxMethod]);
  const bodyweight = entries.filter((entry) => entry.kind === "bodyweight").sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const bodyweightChange = bodyweight.length > 1 ? bodyweight[bodyweight.length - 1].value - bodyweight[0].value : null;
  const totalVolume = weekly.reduce((sum, item) => sum + item.volume, 0);
  const recentlySeen = new Set<string>();
  const progression: WorkoutExercise[] = [];
  for (const workout of workouts) for (const exercise of workout.exercises) if (!recentlySeen.has(exercise.exerciseId)) { recentlySeen.add(exercise.exerciseId); progression.push(exercise); }
  const readinessScore = getReadinessScore(workouts, energy);
  const readiness = getReadinessLabel(readinessScore);
  const plateauSignals = findPlateauSignals(workouts);

  async function logBodyweight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = fromDisplayWeight(Number(bodyweightValue),units);
    if (!Number.isFinite(value) || value < 20 || value > 500) { setMessage(`Enter a bodyweight between ${formatWeight(20,units)} and ${formatWeight(500,units)}.`); return; }
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
      <section className="progress-stats"><article><span>SESSIONS</span><strong>{workouts.length}</strong><small>completed workouts</small></article><article><span>12 WEEK VOLUME</span><strong>{formatWeight(totalVolume,units)}</strong><small>total lifted</small></article><article><span>BEST EST. 1RM</span><strong>{bestE1rm ? formatWeight(bestE1rm,units) : "—"}</strong><small>{oneRepMaxMethod === "epley" ? "Epley" : "Brzycki"} estimate</small></article><article><span>PERSONAL RECORDS</span><strong>{prs.length}</strong><small>estimated 1RM milestones</small></article></section>
      <SleepTrendCard standalone/>
      <WeightTrendChart units={units}/>
      <section className="analytics-toolbar"><div><p className="eyebrow">STRENGTH MODEL</p><strong>Choose your 1RM estimate</strong><small>Use the same method over time for a consistent trend.</small></div><label>FORMULA<select value={oneRepMaxMethod} onChange={(event) => setOneRepMaxMethod(event.target.value as OneRepMaxMethod)}><option value="epley">Epley</option><option value="brzycki">Brzycki</option></select></label></section>
      <ProgressCharts workouts={workouts} method={oneRepMaxMethod}/>
      <AdvancedAnalytics workouts={workouts} entries={entries}/>
      <section className="intelligence-grid"><article className="intelligence-card"><div><p className="eyebrow">TRAINING READINESS</p><h2>{readiness === "ready" ? "Good to push." : readiness === "steady" ? "Build steadily." : "Recover first."}</h2><p>Based on recent frequency, completed sets, and your check-in.</p></div><div className={`readiness-score readiness-${readiness as Readiness}`}><strong>{readinessScore}</strong><span>/ 100</span></div><div className="energy-checkin"><span>HOW DO YOU FEEL TODAY?</span>{[2, 5, 8, 10].map((value) => <button key={value} className={energy === value ? "selected" : ""} onClick={() => setEnergy(value)}>{value === 2 ? "Low" : value === 5 ? "Okay" : value === 8 ? "Good" : "Great"}</button>)}</div></article><article className="intelligence-card"><div><p className="eyebrow">PLATEAU CHECK</p><h2>{plateauSignals.length ? "A few lifts need a change." : "No plateau signal yet."}</h2><p>{plateauSignals.length ? "Try a rep range change, lighter technique week, or small load reset." : "Keep logging three or more exposures to unlock useful signals."}</p></div>{plateauSignals.length > 0 && <div className="plateau-list">{plateauSignals.map((signal) => <div key={signal.name}><strong>{signal.name}</strong><span>{signal.change >= 0 ? "+" : ""}{signal.change}% e1RM change</span></div>)}</div>}</article></section>
      <section className="analytics-grid" style={{gridTemplateColumns:"minmax(0,1fr)"}}>
        <article className="analytics-panel"><div className="panel-heading"><div><p className="eyebrow">DISTRIBUTION MODEL</p><h2>Muscles trained</h2></div><Target size={18} className="panel-icon"/></div>{muscles.length ? <div className="muscle-list">{muscles.slice(0, 8).map((item) => <div className="muscle-line" key={item.muscle}><div><span>{item.muscle}</span><small>{formatWeight(item.volume,units)}</small></div><div className="muscle-bar"><i style={{ width: `${Math.max(3, item.volume / muscles[0].volume * 100)}%` }}/></div></div>)}</div> : <div className="analytics-empty">Complete a workout to see the muscle groups in your log.</div>}<p className="method-note">Uses each exercise’s primary muscle. This reflects catalog classification, not measured physiological stimulus.</p></article>
      </section>
      <section className="analytics-panel recovery-panel"><div className="panel-heading"><div><p className="eyebrow">RECENT TRAINING LOAD</p><h2>Muscle recovery map</h2></div><Target size={18} className="panel-icon"/></div>{recovery.length ? <div className="muscle-recovery-list">{recovery.map(item => { const elapsed = item.hoursSinceTraining ?? 0; const progress = Math.min(100, elapsed / 48 * 100); return <article className="muscle-recovery-row" data-status={item.status} key={item.muscle}><div className="recovery-row-heading"><strong>{item.muscle}</strong><span className="recovery-status">{item.status === "recovering" ? "Recovering" : "Ready"}</span></div><div className="recovery-meter" role="progressbar" aria-label={`${item.muscle} recovery estimate`} aria-valuemin={0} aria-valuemax={48} aria-valuenow={Math.min(48, elapsed)} aria-valuetext={`${item.status === "recovering" ? "Recovering" : "Ready"}; last trained ${elapsed} hours ago`}><span style={{ width: `${progress}%` }}/></div><div className="recovery-row-foot"><span>{item.status === "recovering" ? `Trained ${elapsed}h ago` : `Last trained ${Math.floor(elapsed / 24)}d ago`}</span><small>{item.workingSetsLast7Days} working {item.workingSetsLast7Days === 1 ? "set" : "sets"} · 7d</small></div></article>; })}</div> : <div className="analytics-empty">Log a working set to see recent muscle-group activity.</div>}<p className="method-note">A simple 48-hour recency guide based on your log. Recovery varies by person and session; use this as context, not a readiness or medical measurement.</p></section>

      <section className="analytics-grid lower-analytics"><article className="analytics-panel"><div className="panel-heading"><div><p className="eyebrow">STRENGTH MILESTONES</p><h2>Personal records</h2></div><Target size={18} className="panel-icon"/></div>{prs.length ? <div className="pr-list">{prs.slice(0, 6).map((pr) => <div className="pr-row" key={`${pr.workoutId}-${pr.exerciseId}-${pr.weight}-${pr.reps}`}><span className="pr-badge"><Check size={14}/></span><span className="pr-main"><strong>{pr.exerciseName}</strong><small>{displayDate(pr.workoutDate)} · {formatWeight(pr.weight,units)} × {pr.reps}</small></span><span className="pr-value">{toDisplayWeight(pr.estimatedOneRepMax,units).toFixed(1)}<small> e1RM</small></span></div>)}</div> : <div className="analytics-empty">Your first estimated strength record will appear after you log weighted sets.</div>}<p className="method-note">Estimated 1RM uses the {oneRepMaxMethod === "epley" ? "Epley" : "Brzycki"} formula for sets of 1–12 reps. It is a training estimate, not a tested max.</p></article>
        <article className="analytics-panel"><div className="panel-heading"><div><p className="eyebrow">NEXT SESSION GUIDANCE</p><h2>Load suggestions</h2></div><ArrowUpRight size={18} className="panel-icon"/></div>{progression.length ? <div className="suggestion-list">{progression.slice(0, 5).map((exercise) => { const suggestion = recommendNextLoad(exercise); return <div className="suggestion-row" key={exercise.id}><Dumbbell size={15}/><div><strong>{exercise.name}</strong><small>{formatLoadReason(suggestion.reason,units)}</small></div>{suggestion.load !== null && <b>{formatWeight(suggestion.load,units)}</b>}</div>; })}</div> : <div className="analytics-empty">Log a few working sets to get explainable load suggestions.</div>}<p className="method-note">Double progression: increase by {formatWeight(2.5,units)} after all completed sets reach 12 reps. Confirm the suggestion suits your equipment and plan.</p></article></section>

      <section className="physique-section"><div className="panel-heading"><div><p className="eyebrow">BODYWEIGHT & MEASUREMENTS</p><h2>Track the whole picture</h2></div><Scale size={18} className="panel-icon"/></div><div className="physique-grid"><article className="analytics-panel physique-card"><h3>Bodyweight</h3><p>Use your preferred units. Entries are saved on this device.</p><form className="physique-form" onSubmit={(event) => void logBodyweight(event)}><NumericInput aria-label={`Bodyweight in ${weightUnit(units)}`} inputMode="decimal" min={Math.ceil(toDisplayWeight(20,units)*10)/10} max={Math.floor(toDisplayWeight(500,units)*10)/10} step="0.1" placeholder="e.g. 72.4" value={bodyweightValue} onChange={(event) => setBodyweightValue(event.target.value)} required/><span>{weightUnit(units).toUpperCase()}</span><button className="small-action" aria-label="Save bodyweight"><Plus size={16}/></button></form>{bodyweight.length > 1 && <><div className="bodyweight-stat"><strong>{formatWeight(bodyweight[bodyweight.length - 1].value,units)}</strong><span>{bodyweightChange !== null && `${bodyweightChange > 0 ? "+" : ""}${formatWeight(bodyweightChange,units)} since first log`}</span></div><LineChart label="Bodyweight trend" unit={weightUnit(units)} points={bodyweight.slice(-12).map((item) => ({ date:item.measuredAt, label: displayDate(item.measuredAt), value: toDisplayWeight(item.value,units) }))}/></>}{bodyweight.length === 0 && <div className="analytics-empty compact-empty">Your weight trend will appear here.</div>}</article>
        <article className="analytics-panel physique-card"><h3>Body measurements</h3><p>Measure under similar conditions for useful comparisons.</p><form className="measurement-form" onSubmit={(event) => void logMeasurement(event)}><select aria-label="Measurement area" value={measurementSite} onChange={(event) => setMeasurementSite(event.target.value)}>{MEASUREMENT_SITES.map((site) => <option key={site}>{site}</option>)}</select><NumericInput aria-label="Measurement in centimeters" inputMode="decimal" min="1" max="300" step="0.1" placeholder="cm" value={measurementValue} onChange={(event) => setMeasurementValue(event.target.value)} required/><button className="small-action" aria-label="Save measurement"><Plus size={16}/></button></form><div className="measurement-list">{entries.filter((item) => item.kind === "measurement").slice(0, 6).map((entry) => <div className="measurement-row" key={entry.id}><span>{entry.metric}<small>{displayDate(entry.measuredAt)}</small></span><strong>{entry.value.toFixed(1)} cm</strong><button onClick={() => void removeEntry(entry)} aria-label={`Delete ${entry.metric} measurement`}>×</button></div>)}{entries.every((item) => item.kind !== "measurement") && <div className="analytics-empty compact-empty">Your measurements will be listed here.</div>}</div></article></div></section>
    </>}{message && <p role="status" className="inline-message">{message}</p>}
  </main>;
}
