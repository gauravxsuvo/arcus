"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { WorkoutShareModal } from "@/components/social/workout-share-modal";
import { usePageTitle } from "@/components/shared/page-title";
import { useProfile } from "@/components/shared/user-profile-provider";
import { formatWeight,detectRecords } from "@/features/training/logic";
import { useLocalRouteId } from "@/components/shared/use-local-route-id";
import { ArrowRight, Check, Dumbbell, Sparkles, Trophy } from "lucide-react";

import { calculateWorkoutTotals, type WorkoutRecord } from "@/features/workouts/model";
import { getCompletedWorkouts, getWorkoutById } from "@/features/workouts/repository";

function durationLabel(seconds: number) {
  const hours = Math.floor(seconds / 3600), minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}

function selectedVolume(workout: WorkoutRecord, ids: Set<string>) {
  return workout.exercises.filter((exercise) => ids.has(exercise.exerciseId)).flatMap((exercise) => exercise.sets)
    .filter((set) => set.completed).reduce((sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0), 0);
}

export default function WorkoutCompletePage() {
  const {preferences}=useProfile();
  const id = useLocalRouteId();
  const [workout, setWorkout] = useState<WorkoutRecord | null>(null);
  const [history, setHistory] = useState<WorkoutRecord[]>([]);
  const [ready, setReady] = useState(false);
  usePageTitle(workout ? `${workout.name || "Workout"} · Complete` : "Workout complete");
  useEffect(() => {
    let cancelled = false;
    void Promise.all([getWorkoutById(id), getCompletedWorkouts()]).then(([current, completed]) => {
      if (!cancelled) { setWorkout(current); setHistory(completed); setReady(true); }
    }).catch(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [id]);

  const totals = workout ? calculateWorkoutTotals(workout) : null;
  const personalRecords = useMemo(() => workout ? detectRecords(history).filter((record) => record.workoutId === workout.id) : [], [history, workout]);
  const rpeValues = workout?.exercises.flatMap((exercise) => exercise.sets.filter((set) => set.completed && set.rpe !== null).map((set) => set.rpe as number)) ?? [];
  const averageRpe = rpeValues.length ? rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length : null;
  const muscles = [...new Set(workout?.exercises.map((exercise) => exercise.muscle) ?? [])];
  const previous = workout ? history.find((item) => item.id !== workout.id && (item.completedAt ?? "") < (workout.completedAt ?? "") && item.exercises.some((exercise) => workout.exercises.some((current) => current.exerciseId === exercise.exerciseId))) : null;
  const comparableIds = new Set(previous?.exercises.filter((exercise) => workout?.exercises.some((current) => current.exerciseId === exercise.exerciseId)).map((exercise) => exercise.exerciseId) ?? []);
  const previousVolume = previous ? selectedVolume(previous, comparableIds) : 0;
  const currentVolume = workout ? selectedVolume(workout, comparableIds) : 0;
  const volumeChange = previousVolume ? Math.round((currentVolume - previousVolume) / previousVolume * 100) : null;

  if (!ready) return <main className="workout-shell"><div className="loading-block">Putting your session summary together…</div></main>;
  if (!workout || !totals) return <main className="workout-shell"><section className="empty-exercises"><h3>Session not found.</h3><p>This workout may no longer be saved on this device.</p><Link className="text-action" href="/history">Open history <ArrowRight size={15}/></Link></section></main>;

  return <main className="workout-shell completion-shell"><header className="workout-top"><Link className="brand" href="/dashboard"><span className="brand-mark">A</span><span>ARCUS<span className="brand-period">.</span></span></Link><span className="offline-badge"><span/> SESSION SAVED</span></header>
    <section className="completion-hero"><div className="completion-check"><Check size={25}/></div><p className="eyebrow"><span className="live-dot"/> SESSION COMPLETE</p><h1>Good work<span>.</span></h1><p>{workout.name} · {new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date(workout.completedAt ?? workout.startedAt))}</p></section>
    <WorkoutShareModal workout={workout}/><section className="completion-stats"><article><span>DURATION</span><strong>{durationLabel(totals.durationSeconds)}</strong></article><article><span>WORKING SETS</span><strong>{totals.sets}</strong></article><article><span>TOTAL REPS</span><strong>{totals.reps}</strong></article><article><span>VOLUME</span><strong>{formatWeight(totals.volume,preferences.units)}</strong></article></section>
    <div className="analytics-grid completion-grid"><article className="analytics-panel"><div className="panel-heading"><div><p className="eyebrow">PERSONAL RECORDS</p><h2>{personalRecords.length ? `${personalRecords.length} strength ${personalRecords.length === 1 ? "milestone" : "milestones"}` : "Keep building"}</h2></div><Trophy className="panel-icon" size={18}/></div>{personalRecords.length ? <div className="pr-list">{personalRecords.map((record) => <div className="pr-row" key={record.id}><span className="pr-badge"><Trophy size={13}/></span><span className="pr-main"><strong>{record.exerciseName}</strong><small>{record.type==="volume"?"Session volume":record.type==="1rm"?"Single-rep best":"Estimated 1RM"}</small></span><span className="pr-value">{formatWeight(record.value,preferences.units)}</span></div>)}</div> : <div className="analytics-empty">New single-rep, estimated 1RM and session-volume records will appear here.</div>}{averageRpe !== null && <div className="completion-rpe"><span>AVERAGE RPE</span><strong>{averageRpe.toFixed(1)} / 10</strong></div>}</article>
      <article className="analytics-panel"><div className="panel-heading"><div><p className="eyebrow">SESSION FOCUS</p><h2>{muscles.length} muscle {muscles.length === 1 ? "group" : "groups"}</h2></div><Dumbbell className="panel-icon" size={18}/></div><div className="focus-pills">{muscles.length ? muscles.map((muscle) => <span key={muscle}>{muscle}</span>) : <p>No exercises were added to this session.</p>}</div>{previous && <div className="comparison-card"><span>VS YOUR PREVIOUS COMPARABLE SESSION</span><strong className={volumeChange !== null && volumeChange > 0 ? "comparison-positive" : ""}>{volumeChange === null ? "Comparison unavailable" : `${volumeChange > 0 ? "+" : ""}${volumeChange}% volume`}</strong><small>{previous.name} · {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(previous.completedAt ?? previous.startedAt))}</small></div>}</article></div>
    <section className="completion-exercises"><div className="panel-heading"><div><p className="eyebrow">THE DETAILS</p><h2>What you trained</h2></div><Sparkles size={18} className="panel-icon"/></div>{workout.exercises.map((exercise) => <article className="completion-exercise" key={exercise.id}><div><strong>{exercise.name}</strong><small>{exercise.muscle} · {exercise.sets.filter((set) => set.completed).length} sets completed</small></div><span>{exercise.sets.filter((set) => set.completed).map((set) => `${set.weight===null?"BW":formatWeight(set.weight,preferences.units)} × ${set.reps??"—"}`).join("  ·  ")}</span></article>)}</section>
    {workout.notes && <section className="detail-notes completion-notes"><span>SESSION NOTES</span><p>{workout.notes}</p></section>}
    <footer className="completion-actions"><Link className="outline-button" href={`/history/${workout.id}?edit=1`}>Edit workout</Link><Link className="outline-button" href="/history">View history</Link><Link className="action-button" href="/dashboard">Back to dashboard <ArrowRight size={15}/></Link></footer>
  </main>;
}
