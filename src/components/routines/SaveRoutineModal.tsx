"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { BookmarkPlus, Check, Crown, LoaderCircle, X } from "lucide-react";
import type { WorkoutRecord } from "@/features/workouts/model";
import { saveWorkoutAsRoutine } from "@/features/routines/actions";
import styles from "./save-routine-modal.module.css";

export function SaveRoutineModal({ workout, label = "Save as routine", className }: { workout: WorkoutRecord; label?: string; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(workout.name || "Workout routine");
  const [message, setMessage] = useState("");
  const [proGate, setProGate] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const exercises = workout.exercises.map((exercise) => ({
    exerciseId: exercise.exerciseId,
    name: exercise.name,
    muscle: exercise.muscle,
    equipment: exercise.equipment,
    sets: Math.max(1, Math.min(20, exercise.sets.length)),
    targetReps: exercise.sets.find((set) => set.setType !== "warmup" && set.reps !== null)?.reps ?? null,
    restSeconds: exercise.restSeconds,
    setTypes: exercise.sets.slice(0,20).map((set) => set.setType ?? "working"),
  }));
  const open = () => { setName(workout.name || "Workout routine"); setMessage(""); setProGate(false); setSaved(false); dialog.current?.showModal(); };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        const result = await saveWorkoutAsRoutine({ name, notes: workout.notes, exercises });
        if (result.status === "pro_required") { setProGate(true); return; }
        setSaved(true);
        setMessage(`“${result.routine.name}” is saved to your routines.`);
      } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save this routine."); }
    });
  };
  return <>
    <button type="button" className={className ?? "outline-button"} onClick={open}><BookmarkPlus size={15}/>{label}</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="save-routine-title">
      <form onSubmit={submit}>
        <header><div><span className={styles.kicker}>YOUR TRAINING LIBRARY</span><h2 id="save-routine-title">Save as a routine</h2><p>{workout.exercises.length} exercises · future sessions start with your last logged numbers as hints.</p></div><button type="button" className={styles.close} aria-label="Close" onClick={() => dialog.current?.close()}><X size={18}/></button></header>
        {proGate ? <div className={styles.proGate} role="status"><Crown size={21}/><p>Free plan is limited to 4 routines. Upgrade to ARCUS Pro for unlimited templates.</p><Link href="/pro" className={styles.primary} onClick={() => dialog.current?.close()}>Explore ARCUS Pro</Link></div> : saved ? <div className={styles.success} role="status"><Check size={18}/>{message}</div> : <>
          <label className={styles.field}>Routine name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required autoFocus/></label>
          <div className={styles.preview}>{workout.exercises.slice(0, 5).map((exercise) => <div key={exercise.id}><span>{exercise.name}</span><small>{exercise.sets.length} sets</small></div>)}{workout.exercises.length > 5 && <small>+{workout.exercises.length - 5} more</small>}</div>
          {message && <p className={styles.error} role="alert">{message}</p>}
        </>}
        <footer>{saved ? <button type="button" className={styles.primary} onClick={() => dialog.current?.close()}>Done</button> : <><button type="button" className={styles.secondary} onClick={() => dialog.current?.close()}>Cancel</button>{!proGate && <button type="submit" className={styles.primary} disabled={pending || exercises.length === 0}>{pending ? <LoaderCircle className={styles.spin} size={16}/> : <BookmarkPlus size={16}/>}Save routine</button>}</>}</footer>
      </form>
    </dialog>
  </>;
}
