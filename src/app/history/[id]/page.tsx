"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { useLocalRouteId } from "@/components/shared/use-local-route-id";
import { getCompletedWorkouts,getWorkoutById } from "@/features/workouts/repository";
import type { WorkoutRecord } from "@/features/workouts/model";
import { WorkoutDetail } from "@/components/history/workout-detail";
import { WorkoutEditor } from "@/components/history/workout-editor";
import { usePageTitle } from "@/components/shared/page-title";

export default function HistoryDetail() {
  const id = useLocalRouteId();
  const [workout, setWorkout] = useState<WorkoutRecord | null>(null);
  const [history, setHistory] = useState<WorkoutRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  usePageTitle(workout ? `${editing ? "Edit " : ""}${workout.name || "Workout"}` : "Workout history");
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setEditing(new URLSearchParams(window.location.search).get("edit") === "1");
    void Promise.all([getWorkoutById(id), getCompletedWorkouts()]).then(([current, completed]) => {
      if (!cancelled) { setWorkout(current); setHistory(completed); setReady(true); }
    }).catch(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [id]);
  function setEditMode(value: boolean) {
    setEditing(value); setMessage("");
    window.history.replaceState(null, "", `${window.location.pathname}${value ? "?edit=1" : ""}`);
    if (!value) requestAnimationFrame(() => document.querySelector<HTMLButtonElement>("[data-edit-workout]")?.focus());
  }
  if (workout && editing && workout.status === "completed") return <main className="workout-shell workout-edit-shell"><WorkoutEditor key={workout.id} workout={workout} history={history} onCancel={() => setEditMode(false)} onSaved={saved => {
    setWorkout(saved); setHistory(current => current.map(item => item.id === saved.id ? saved : item));
    setEditMode(false); setMessage("Workout updated and saved on this device.");
  }}/></main>;
  return <main className="workout-shell"><header className="workout-top"><Link className="back-link" href="/history">← History</Link></header>{message && <p className="inline-message" role="status">{message}</p>}{workout ? <WorkoutDetail workout={workout} history={history} onEdit={() => setEditMode(true)}/> : <p>{ready ? "Workout not found on this device." : "Loading session…"}</p>}</main>;
}
