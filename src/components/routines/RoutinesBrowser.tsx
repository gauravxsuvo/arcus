"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Dumbbell, LoaderCircle, Pencil, Play, Trash2, X } from "lucide-react";
import { useWorkout } from "@/components/shared/workout-provider";
import { useToast } from "@/components/shared/toast-provider";
import { createWorkout, type WorkoutExercise, type WorkoutRecord } from "@/features/workouts/model";
import { getActiveWorkout, saveWorkout } from "@/features/workouts/repository";
import { deleteRoutine, reorderRoutines, startRoutine, updateRoutine, type RoutineDTO } from "@/features/routines/actions";
import styles from "./routines.module.css";

function minutes(routine: RoutineDTO) {
  const seconds = routine.exercises.reduce((total, exercise) => total + exercise.sets * ((exercise.targetReps ?? 8) * 4 + exercise.restSeconds), 0);
  return Math.max(1, Math.round(seconds / 60));
}

export function RoutinesBrowser({ initialRoutines, isPro }: { initialRoutines: RoutineDTO[]; isPro: boolean }) {
  const router = useRouter();
  const { setWorkout } = useWorkout();
  const { showToast } = useToast();
  const [routines, setRoutines] = useState(initialRoutines);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");

  const launch = async (id: string) => {
    if (pendingId) return;
    setPendingId(id); setError("");
    try {
      const active = await getActiveWorkout();
      if (active) { showToast("Finish or resume your active workout before starting a routine.", "error"); router.push("/workout"); return; }
      const { routine, previous } = await startRoutine(id);
      const workout = createWorkout();
      const exercises: WorkoutExercise[] = routine.exercises.map((exercise) => {
        const last = previous[exercise.exerciseId];
        return {
          id: crypto.randomUUID(), exerciseId: exercise.exerciseId, name: exercise.name, muscle: exercise.muscle,
          equipment: exercise.equipment, restSeconds: exercise.restSeconds,
          sets: Array.from({ length: exercise.sets }, (_, index) => ({
            id: crypto.randomUUID(), index, weight: null, reps: null, rpe: null, completed: false, completedAt: null, setType: exercise.setTypes[index] ?? "working",
            previousWeight: last?.weight ?? null, previousReps: last?.reps ?? exercise.targetReps,
          })),
        };
      });
      const activeWorkout: WorkoutRecord = { ...workout, name: routine.name, notes: routine.notes, exercises };
      await saveWorkout(activeWorkout);
      setWorkout(activeWorkout);
      router.push("/workout");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start this routine."); }
    finally { setPendingId(null); }
  };

  const remove = async (routine: RoutineDTO) => {
    if (pendingId) return;
    if (!window.confirm(`Delete “${routine.name}”?`)) return;
    const previous = routines;
    setRoutines(current => current.filter(item => item.id !== routine.id));
    setPendingId(routine.id); setError("");
    try { await deleteRoutine(routine.id); showToast(`${routine.name} deleted`); }
    catch (cause) { setRoutines(previous); setError(cause instanceof Error ? cause.message : "Could not delete this routine."); }
    finally { setPendingId(null); }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= routines.length || pendingId) return;
    const previous = routines;
    const next = [...routines]; [next[index], next[target]] = [next[target], next[index]];
    setRoutines(next); setPendingId("order"); setError("");
    try { await reorderRoutines(next.map(item => item.id)); }
    catch (cause) { setRoutines(previous); setError(cause instanceof Error ? cause.message : "Could not reorder routines."); }
    finally { setPendingId(null); }
  };

  const edit = async (event: React.FormEvent<HTMLFormElement>, routine: RoutineDTO) => {
    event.preventDefault();
    if (pendingId) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    const old = routine;
    const optimistic = { ...routine, name, notes, updatedAt: new Date().toISOString() };
    setRoutines(current => current.map(item => item.id === routine.id ? optimistic : item));
    setPendingId(routine.id); setError("");
    try { const saved = await updateRoutine(routine.id, optimistic); setRoutines(current => current.map(item => item.id === routine.id ? saved : item)); setEditing(null); showToast("Routine updated"); }
    catch (cause) { setRoutines(current => current.map(item => item.id === old.id ? old : item)); setError(cause instanceof Error ? cause.message : "Could not update this routine."); }
    finally { setPendingId(null); }
  };

  return <main className={`workout-shell ${styles.page}`}>
    <header className="workout-top"><Link className="back-link" href="/workout"><ArrowLeft size={17}/> Workout</Link><span className="offline-badge"><Dumbbell size={14}/> TRAINING LIBRARY</span></header>
    <section className={styles.heading}><p className="eyebrow"><span className="live-dot"/> YOUR TRAINING</p><div><h1>Routines<span>.</span></h1><Link className="outline-button" href="/pro">{isPro ? "ARCUS Pro" : "Free plan · 4 routines"}<ArrowRight size={15}/></Link></div><p>Save a familiar session once. Start it in a tap whenever you’re ready.</p></section>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {routines.length === 0 ? <section className={styles.empty}><span><Dumbbell size={20}/></span><h2>Your training, ready to repeat.</h2><p>Save an active workout as a routine and it will live here with your exercise order, set targets, and rest periods.</p><Link href="/workout" className="action-button">Open workout logger <ArrowRight size={15}/></Link></section> : <section className={styles.list} aria-label="Saved routines">
      {routines.map((routine, index) => <article className={styles.card} key={routine.id}>
        <header><div><span className={styles.count}>{String(index + 1).padStart(2, "0")}</span><div><h2>{routine.name}</h2><p>{routine.exercises.length} exercises <span>·</span> about {minutes(routine)} min</p></div></div><div className={styles.tools}><button type="button" aria-label={`Move ${routine.name} up`} disabled={index === 0 || pendingId !== null} onClick={() => void move(index, -1)}><ArrowUp size={15}/></button><button type="button" aria-label={`Move ${routine.name} down`} disabled={index === routines.length - 1 || pendingId !== null} onClick={() => void move(index, 1)}><ArrowDown size={15}/></button><button type="button" aria-label={`Edit ${routine.name}`} onClick={() => setEditing(editing === routine.id ? null : routine.id)}><Pencil size={15}/></button><button type="button" aria-label={`Delete ${routine.name}`} disabled={pendingId !== null} onClick={() => void remove(routine)}><Trash2 size={15}/></button></div></header>
        <ul>{routine.exercises.slice(0, 3).map((exercise) => <li key={exercise.exerciseId}><span>{exercise.name}</span><small>{exercise.sets} × {exercise.targetReps ?? "—"}</small></li>)}</ul>
        {routine.exercises.length > 3 && <p className={styles.more}>+{routine.exercises.length - 3} more exercises</p>}
        {editing === routine.id && <form className={styles.edit} onSubmit={event => void edit(event, routine)}><label>Name<input name="name" defaultValue={routine.name} maxLength={100} required/></label><label>Notes<textarea name="notes" defaultValue={routine.notes} maxLength={1000}/></label><div><button type="button" className="outline-button" onClick={() => setEditing(null)}><X size={14}/> Cancel</button><button type="submit" className="action-button" disabled={pendingId === routine.id}>{pendingId === routine.id ? <LoaderCircle size={15}/> : null}Save changes</button></div></form>}
        <button type="button" className={styles.start} disabled={pendingId !== null} onClick={() => void launch(routine.id)}>{pendingId === routine.id ? <LoaderCircle className={styles.spin} size={17}/> : <Play size={17} fill="currentColor"/>}Start routine<ArrowRight size={16}/></button>
      </article>)}
    </section>}
    {!isPro && <p className={styles.limit}>Free includes up to 4 saved routines. <Link href="/pro">See ARCUS Pro</Link> for unlimited templates.</p>}
  </main>;
}
