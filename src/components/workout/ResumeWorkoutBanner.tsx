"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Play, Trash2 } from "lucide-react";
import type { WorkoutRecord } from "@/features/workouts/model";
import { deleteWorkout, saveWorkout } from "@/features/workouts/repository";
import { clearWorkoutDraft, readWorkoutDraft, type WorkoutDraft } from "@/lib/workout-draft-storage";
import { useWorkout } from "@/components/shared/workout-provider";
import styles from "./resume-workout-banner.module.css";

export function ResumeWorkoutBanner({ activeWorkout, onDiscard }: { activeWorkout: WorkoutRecord | null; onDiscard: () => void }) {
  const router = useRouter();
  const { setWorkout } = useWorkout();
  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ageMinutes, setAgeMinutes] = useState(0);

  useEffect(() => {
    const found = readWorkoutDraft();
    setDraft(found);
    if (found) setAgeMinutes(Math.max(0, Math.floor((Date.now() - found.startedAt) / 60_000)));
  }, []);

  const record = activeWorkout?.status === "active" && activeWorkout.id === draft?.id ? activeWorkout : draft?.record ?? null;
  if (!draft || !record || (activeWorkout?.status === "active" && activeWorkout.id !== draft.id)) return null;

  const resume = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (record.id !== activeWorkout?.id) await saveWorkout(record);
      setWorkout(record);
      router.push("/workout");
    } catch {
      setError("Could not open the saved session. Your draft is still on this device.");
      setBusy(false);
    }
  };

  const discard = async () => {
    if (busy || !window.confirm("Discard this workout and all of its logged sets?")) return;
    setBusy(true);
    try {
      await deleteWorkout(record.id);
      clearWorkoutDraft(record.id);
      setWorkout((current) => current?.id === record.id ? null : current);
      setDraft(null);
      onDiscard();
    } catch {
      setError("Could not discard this session. It is still saved on this device.");
    } finally {
      setBusy(false);
    }
  };

  return <aside className={styles.banner} aria-label="Active workout recovery">
    <div className={styles.copy}><span className={styles.icon}><Clock3 size={17}/></span><div><strong>Active session found</strong><p>{record.name || "Workout"} <span>· Started {ageMinutes} min{ageMinutes === 1 ? "" : "s"} ago</span></p></div></div>
    <div className={styles.actions}><button className={styles.resume} type="button" onClick={() => void resume()} disabled={busy}><Play size={15} fill="currentColor"/>{busy ? "Opening…" : "Resume"}</button><button className={styles.discard} type="button" onClick={() => void discard()} disabled={busy}><Trash2 size={15}/><span>Discard</span></button></div>{error && <p className={styles.error} role="alert">{error}</p>}
  </aside>;
}
