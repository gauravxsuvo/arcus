"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, ChevronRight, Dumbbell, History as HistoryIcon } from "lucide-react";
import { calculateWorkoutTotals, type WorkoutRecord } from "@/features/workouts/model";
import { getCompletedWorkouts } from "@/features/workouts/repository";

function prettyDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function prettyDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes} min`;
}

export default function HistoryPage() {
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([]);
  const [selected, setSelected] = useState<WorkoutRecord | null>(null);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [exerciseFilter, setExerciseFilter] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getCompletedWorkouts().then((rows) => { if (!cancelled) { setWorkouts(rows); setReady(true); } })
      .catch(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  const exerciseOptions = useMemo(() => [...new Map(workouts.flatMap((workout) => workout.exercises.map((exercise) => [exercise.exerciseId, exercise.name] as const))).entries()], [workouts]);
  const muscleOptions = useMemo(() => [...new Set(workouts.flatMap((workout) => workout.exercises.map((exercise) => exercise.muscle)))].sort(), [workouts]);
  const filteredWorkouts = useMemo(() => workouts.filter((workout) => {
    const date = (workout.completedAt ?? workout.startedAt).slice(0, 10);
    const haystack = `${workout.name} ${workout.notes} ${workout.exercises.map((exercise) => exercise.name).join(" ")}`.toLocaleLowerCase();
    return (!query.trim() || haystack.includes(query.trim().toLocaleLowerCase()))
      && (!exerciseFilter || workout.exercises.some((exercise) => exercise.exerciseId === exerciseFilter))
      && (!muscleFilter || workout.exercises.some((exercise) => exercise.muscle === muscleFilter))
      && (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
  }), [workouts, query, exerciseFilter, muscleFilter, fromDate, toDate]);

  return (
    <main className="workout-shell history-shell">
      <header className="workout-top"><Link className="back-link" href="/dashboard"><ArrowLeft size={17} /> Dashboard</Link><Link className="offline-badge" href="/workout"><span /> START SESSION</Link></header>
      <section className="history-heading"><p className="eyebrow"><span className="live-dot" /> YOUR TRAINING LOG</p><h1>History<span>.</span></h1><p>Every session you finish on this device, in one place.</p></section>
      {!ready ? <div className="loading-block">Loading training history…</div> : workouts.length === 0 ? <section className="empty-exercises history-empty"><div className="empty-mark"><HistoryIcon size={22} /></div><h3>Your log starts here.</h3><p>Completed workouts will appear with the work you recorded.</p><Link className="text-action" href="/workout">Start your first workout <ChevronRight size={15} /></Link></section> : (
        <>
        <section className="history-filters"><label className="search-box"><input aria-label="Search workout history" placeholder="Search workout, exercise, or notes" value={query} onChange={(event) => setQuery(event.target.value)}/></label><select aria-label="Filter by exercise" value={exerciseFilter} onChange={(event) => setExerciseFilter(event.target.value)}><option value="">All exercises</option>{exerciseOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><select aria-label="Filter by muscle" value={muscleFilter} onChange={(event) => setMuscleFilter(event.target.value)}><option value="">All muscles</option>{muscleOptions.map((muscle) => <option key={muscle}>{muscle}</option>)}</select><label className="date-filter"><span>FROM</span><input type="date" aria-label="From date" value={fromDate} onChange={(event) => setFromDate(event.target.value)}/></label><label className="date-filter"><span>TO</span><input type="date" aria-label="To date" value={toDate} onChange={(event) => setToDate(event.target.value)}/></label></section>
        {filteredWorkouts.length === 0 ? <div className="analytics-empty">No sessions match these filters. Clear a filter or change the search.</div> : <div className="history-layout">
          <section className="history-list" aria-label="Completed workouts"><p className="history-result-count">{filteredWorkouts.length} SESSIONS</p>{filteredWorkouts.map((workout) => {
            const totals = calculateWorkoutTotals(workout);
            const isSelected = selected?.id === workout.id;
            return <button className={`history-item ${isSelected ? "history-item-selected" : ""}`} key={workout.id} onClick={() => setSelected(workout)}>
              <span className="history-calendar"><CalendarDays size={17} /></span><span className="history-main"><strong>{workout.name || "Workout"}</strong><small>{prettyDate(workout.completedAt ?? workout.startedAt)} · {workout.syncStatus === "synced" ? "Synced" : "Saved on device"}</small></span><span className="history-metrics"><strong>{totals.sets}</strong><small>SETS</small></span><span className="history-metrics"><strong>{prettyDuration(totals.durationSeconds)}</strong><small>DURATION</small></span><ChevronRight className="history-chevron" size={17} />
            </button>;
          })}</section>
          <aside className="history-detail">{selected ? <>
            <div className="detail-kicker"><span>SESSION SUMMARY</span><span>{prettyDate(selected.completedAt ?? selected.startedAt)}</span></div><h2>{selected.name || "Workout"}</h2>
            <div className="detail-stats"><div><strong>{calculateWorkoutTotals(selected).sets}</strong><span>SETS</span></div><div><strong>{calculateWorkoutTotals(selected).reps}</strong><span>REPS</span></div><div><strong>{calculateWorkoutTotals(selected).volume.toLocaleString()}</strong><span>KG VOLUME</span></div></div>
            <div className="detail-exercises"><p className="eyebrow">EXERCISES · {selected.exercises.length}</p>{selected.exercises.map((exercise) => <div className="detail-exercise" key={exercise.id}><span className="exercise-glyph"><Dumbbell size={15} /></span><div><strong>{exercise.name}</strong><small>{exercise.sets.filter((set) => set.completed).map((set) => `${set.weight ?? "—"} × ${set.reps ?? "—"}`).join("  ·  ") || "No completed sets"}</small></div></div>)}</div>
            {selected.notes && <div className="detail-notes"><span>SESSION NOTES</span><p>{selected.notes}</p></div>}
          </> : <div className="detail-placeholder"><HistoryIcon size={24} /><p>Select a session to see its exercises and numbers.</p></div>}</aside>
        </div>}
        </>
      )}
    </main>
  );
}
