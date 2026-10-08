"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BarChart3, Dumbbell, Star } from "lucide-react";
import { ExerciseSettingsPanel } from "@/components/exercises/exercise-settings";
import { LineChart } from "@/components/progress/line-chart";
import { exerciseContent } from "@/features/exercises/content";
import { useProfile } from "@/components/shared/user-profile-provider";
import { formatWeight,formatLoadReason,toDisplayWeight } from "@/features/training/logic";
import { useLocalRouteId } from "@/components/shared/use-local-route-id";
import { exerciseCatalog, type Exercise } from "@/features/exercises/catalog";
import { findExerciseAlternatives } from "@/features/exercises/alternatives";
import { findPersonalRecords, recommendNextLoad } from "@/features/analytics/engine";
import type { WorkoutExercise, WorkoutRecord } from "@/features/workouts/model";
import { getCompletedWorkouts } from "@/features/workouts/repository";
import { getExercisePreferences, listCustomExercises, markExerciseUsed, setExerciseFavorite } from "@/features/local-data/repository";

export default function ExerciseDetailPage() {
  const {preferences}=useProfile();
  const id = useLocalRouteId();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [catalog, setCatalog] = useState<Exercise[]>(exerciseCatalog);
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([]);
  const [favorite, setFavorite] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listCustomExercises(), getCompletedWorkouts(), getExercisePreferences()]).then(([custom, history, preferences]) => {
      if (cancelled) return;
      const all = [...exerciseCatalog, ...custom];
      setCatalog(all); setExercise(all.find((item) => item.id === id) ?? null); setWorkouts(history); setFavorite(preferences.find((item) => item.id === id)?.favorite ?? false); setReady(true);
    }).catch(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [id]);

  const history = useMemo(() => workouts.flatMap((workout) => workout.exercises.map((item) => ({ workout, item }))).filter(({ item }) => item.exerciseId === id), [workouts, id]);
  const records = useMemo(() => findPersonalRecords(workouts).filter((record) => record.exerciseId === id), [workouts, id]);
  const best = records[0];
  const latest = history[0]?.item as WorkoutExercise | undefined;
  const alternatives = exercise ? findExerciseAlternatives(exercise, catalog) : [];
  const suggestion = latest ? recommendNextLoad(latest) : null;

  async function toggleFavorite() {
    if (!exercise) return;
    await setExerciseFavorite(exercise.id, !favorite); setFavorite(!favorite);
  }

  if (!ready) return <main className="workout-shell"><div className="loading-block">Loading exercise…</div></main>;
  if (!exercise) return <main className="workout-shell"><header className="workout-top"><Link className="back-link" href="/exercises"><ArrowLeft size={17}/> Exercises</Link></header><section className="empty-exercises"><h3>Exercise not found.</h3><Link className="text-action" href="/exercises">Back to exercise library <ArrowRight size={15}/></Link></section></main>;

  return <main className="workout-shell exercise-detail-shell"><header className="workout-top"><Link className="back-link" href="/exercises"><ArrowLeft size={17}/> Exercises</Link><button className={`favorite-button ${favorite ? "favorite-active" : ""}`} aria-label={favorite ? "Remove from favorites" : "Add to favorites"} onClick={() => void toggleFavorite()}><Star size={18} fill={favorite ? "currentColor" : "none"}/></button></header>
    <section className="exercise-detail-hero"><span className="exercise-glyph"><Dumbbell size={24}/></span><p className="eyebrow">EXERCISE OVERVIEW</p><h1>{exercise.name}<span>.</span></h1><p>{exercise.muscle} · {exercise.equipment} · {exercise.pattern}</p><Link className="action-button" href={`/workout?add=${encodeURIComponent(exercise.id)}`} onClick={() => void markExerciseUsed(exercise.id)}>Add to workout <ArrowRight size={16}/></Link></section>
    <section className="feature-panel"><h2>How to perform it</h2><p>{exerciseContent(exercise).instructions}</p><div className="focus-pills">{exerciseContent(exercise).primary.map(m=><span key={m}>Primary · {m}</span>)}{exerciseContent(exercise).secondary.map(m=><span key={m}>Secondary · {m}</span>)}</div><video controls={Boolean(exercise.videoUrl)} preload="none" poster="/demos/placeholder.svg" src={exercise.videoUrl} aria-label={`${exercise.name} demo`}/>{!exercise.videoUrl&&<p className="feature-muted">Demo coming soon. Exercise videos can be added to the catalog later.</p>}</section><ExerciseSettingsPanel id={exercise.id}/><section className="feature-panel"><h2>Load progression · last 20 sessions</h2><LineChart label={`Top load in ${preferences.units==="metric"?"kg":"lb"}`} points={history.slice(0,20).reverse().map(({workout,item})=>({label:new Date(workout.completedAt??workout.startedAt).toLocaleDateString(),value:toDisplayWeight(Math.max(0,...item.sets.filter(s=>s.completed&&s.setType!=="warmup").map(s=>s.weight??0)),preferences.units)}))}/></section>
    <section className="exercise-detail-grid"><article className="analytics-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR NUMBERS</p><h2>Performance</h2></div><BarChart3 size={18} className="panel-icon"/></div><div className="detail-stats"><div><strong>{best ? formatWeight(best.estimatedOneRepMax,preferences.units) : "—"}</strong><span>BEST EST. 1RM</span></div><div><strong>{history.length}</strong><span>RECENT EXPOSURES</span></div></div>{best && <p className="method-note">Best recorded set: {formatWeight(best.weight,preferences.units)} × {best.reps} on {new Date(best.workoutDate).toLocaleDateString()}.</p>}{suggestion && <div className="comparison-card"><span>NEXT SESSION</span><strong>{suggestion.load ? formatWeight(suggestion.load,preferences.units) : "Keep building"}</strong><small>{formatLoadReason(suggestion.reason,preferences.units)}</small></div>}</article><article className="analytics-panel"><p className="eyebrow">RECENT SESSIONS</p>{history.slice(0, 5).map(({ workout, item }) => <div className="detail-exercise" key={`${workout.id}-${item.id}`}><span className="exercise-glyph"><Dumbbell size={14}/></span><div><strong>{new Date(workout.completedAt ?? workout.startedAt).toLocaleDateString()}</strong><small>{item.sets.filter((set) => set.completed).map((set) => `${set.weight===null?"BW":formatWeight(set.weight,preferences.units)} × ${set.reps ?? "—"}`).join(" · ")}</small></div></div>)}{!history.length && <p className="analytics-empty">Log this exercise to build a performance history.</p>}</article></section>
    <section className="analytics-panel exercise-alternatives"><div className="panel-heading"><div><p className="eyebrow">WHEN EQUIPMENT CHANGES</p><h2>Suggested alternatives</h2></div></div>{alternatives.length ? alternatives.map(({ exercise: alternative, reason }) => <Link className="saved-day" href={`/workout?add=${encodeURIComponent(alternative.id)}`} key={alternative.id}><div><strong>{alternative.name}</strong><small>{alternative.muscle} · {alternative.equipment} · {reason}</small></div><ArrowRight size={15}/></Link>) : <p className="analytics-empty">No close alternatives in your current catalog.</p>}</section>
  </main>;
}
