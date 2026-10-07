"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, CheckCircle2, Clock3, Copy, Dumbbell, Flame, Plus, Search, Trash2, X } from "lucide-react";
import { exerciseCatalog, searchExercises, type Exercise } from "@/features/exercises/catalog";
import { calculateWorkoutTotals, createWorkout, type LoggedSet, type WorkoutExercise, type WorkoutRecord } from "@/features/workouts/model";
import { deleteWorkout, getActiveWorkout, getCompletedWorkouts, saveWorkout } from "@/features/workouts/repository";
import { syncCompletedWorkout } from "@/features/workouts/sync";
import { listCustomExercises, listPrograms, markExerciseUsed, getExercisePreferences } from "@/features/local-data/repository";
import { findPersonalRecords } from "@/features/analytics/engine";

function newSet(index: number): LoggedSet {
  return { id: crypto.randomUUID(), index, weight: null, reps: null, rpe: null, completed: false, completedAt: null };
}

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}` : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function comparableVolume(workout: WorkoutRecord, exerciseIds: Set<string>) {
  return workout.exercises.filter((exercise) => exerciseIds.has(exercise.exerciseId)).flatMap((exercise) => exercise.sets)
    .filter((set) => set.completed).reduce((sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0), 0);
}

export default function WorkoutPage() {
  const [workout, setWorkout] = useState<WorkoutRecord | null>(null);
  const [completedWorkout, setCompletedWorkout] = useState<WorkoutRecord | null>(null);
  const [history, setHistory] = useState<WorkoutRecord[]>([]);
  const [catalog, setCatalog] = useState<Exercise[]>(exerciseCatalog);
  const [preferences, setPreferences] = useState<{ id: string; favorite: boolean; usedAt: string | null; useCount: number }[]>([]);
  const [ready, setReady] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [restLeft, setRestLeft] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getActiveWorkout(), getCompletedWorkouts(), listPrograms(), listCustomExercises(), getExercisePreferences()]).then(async ([saved, completed, programs, customExercises, exercisePreferences]) => {
      if (!cancelled) {
        setHistory(completed);
        const availableExercises = [...exerciseCatalog, ...customExercises];
        setCatalog(availableExercises);
        setPreferences(exercisePreferences);
        const params = new URLSearchParams(window.location.search);
        const requested = availableExercises.find((exercise) => exercise.id === params.get("add"));
        let current = saved;
        if (requested) {
          current ??= createWorkout();
          if (!current.exercises.some((exercise) => exercise.exerciseId === requested.id)) {
            const item: WorkoutExercise = {
              id: crypto.randomUUID(), exerciseId: requested.id, name: requested.name, muscle: requested.muscle,
              equipment: requested.equipment, restSeconds: requested.restSeconds, sets: [newSet(0), newSet(1), newSet(2)],
            };
            current = { ...current, exercises: [...current.exercises, item] };
            await saveWorkout(current);
            void markExerciseUsed(requested.id);
          }
        }
        const program = programs.find((item) => item.id === params.get("program"));
        const programDay = program?.days.find((item) => item.id === params.get("day"));
        if (program && programDay) {
          current ??= createWorkout();
          if (!saved) current = { ...current, name: `${program.name} · ${programDay.name}` };
          const planned = programDay.exercises.map((exercise) => ({
            id: crypto.randomUUID(), exerciseId: exercise.exerciseId, name: exercise.name, muscle: exercise.muscle,
            equipment: exercise.equipment, restSeconds: exercise.restSeconds, targetRepMin: exercise.repMin,
            targetRepMax: exercise.repMax, targetProgressionMethod: exercise.progressionMethod,
            targetProgressionValue: exercise.progressionValue, sets: Array.from({ length: exercise.sets }, (_, index) => newSet(index)),
          }));
          current = { ...current, exercises: [...current.exercises, ...planned] };
          await saveWorkout(current);
        }
        if (requested) window.history.replaceState(null, "", "/workout");
        if (programDay) window.history.replaceState(null, "", "/workout");
        setWorkout(current);
        if (current) {
          setElapsed(Math.floor((Date.now() - Date.parse(current.startedAt)) / 1000));
          if (current.restUntil && Date.parse(current.restUntil) > Date.now()) {
            setRestEnd(Date.parse(current.restUntil));
            setRestLeft(Math.ceil((Date.parse(current.restUntil) - Date.now()) / 1000));
          }
        }
        setReady(true);
      }
    }).catch(() => { if (!cancelled) { setMessage("Local storage is unavailable in this browser."); setReady(true); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!workout) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - Date.parse(workout.startedAt)) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [workout]);

  useEffect(() => {
    if (!restEnd) return;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((restEnd - Date.now()) / 1000));
      setRestLeft(left);
      if (left === 0) setRestEnd(null);
    }, 250);
    return () => window.clearInterval(timer);
  }, [restEnd]);

  const persist = useCallback((updated: WorkoutRecord) => {
    setWorkout(updated);
    void saveWorkout(updated).catch(() => setMessage("Could not save locally. Keep this tab open and retry."));
  }, []);

  const beginWorkout = async () => {
    const active = createWorkout();
    try {
      await saveWorkout(active);
      setWorkout(active);
      setElapsed(0);
      setMessage("");
    } catch {
      setMessage("Could not start: browser storage is unavailable.");
    }
  };

  const addExercise = (exercise: Exercise) => {
    if (!workout) return;
    const item: WorkoutExercise = {
      id: crypto.randomUUID(), exerciseId: exercise.id, name: exercise.name, muscle: exercise.muscle,
      equipment: exercise.equipment, restSeconds: exercise.restSeconds, sets: [newSet(0), newSet(1), newSet(2)],
    };
    persist({ ...workout, exercises: [...workout.exercises, item] });
    void markExerciseUsed(exercise.id);
    setPickerOpen(false);
    setQuery("");
  };

  const updateSet = (exerciseId: string, setId: string, update: Partial<LoggedSet>) => {
    if (!workout) return;
    const exercises = workout.exercises.map((exercise) => exercise.id !== exerciseId ? exercise : {
      ...exercise, sets: exercise.sets.map((set) => set.id === setId ? { ...set, ...update } : set),
    });
    persist({ ...workout, exercises });
  };

  const addSet = (exerciseId: string) => {
    if (!workout) return;
    const exercises = workout.exercises.map((exercise) => exercise.id !== exerciseId ? exercise : {
      ...exercise, sets: [...exercise.sets, newSet(exercise.sets.length)],
    });
    persist({ ...workout, exercises });
  };

  const removeExercise = (exerciseId: string) => {
    if (!workout) return;
    persist({ ...workout, exercises: workout.exercises.filter((exercise) => exercise.id !== exerciseId) });
  };

  const moveExercise = (exerciseId: string, direction: -1 | 1) => {
    if (!workout) return;
    const current = workout.exercises.findIndex((item) => item.id === exerciseId);
    const target = current + direction;
    if (current < 0 || target < 0 || target >= workout.exercises.length) return;
    const exercises = [...workout.exercises];
    [exercises[current], exercises[target]] = [exercises[target], exercises[current]];
    persist({ ...workout, exercises });
  };

  const removeSet = (exerciseId: string, setId: string) => {
    if (!workout) return;
    const exercises = workout.exercises.map((item) => {
      if (item.id !== exerciseId || item.sets.length < 2) return item;
      return { ...item, sets: item.sets.filter((set) => set.id !== setId).map((set, index) => ({ ...set, index })) };
    });
    persist({ ...workout, exercises });
  };

  const moveSet = (exerciseId: string, setId: string, direction: -1 | 1) => {
    if (!workout) return;
    const exercises = workout.exercises.map((item) => {
      if (item.id !== exerciseId) return item;
      const current = item.sets.findIndex((set) => set.id === setId);
      const target = current + direction;
      if (current < 0 || target < 0 || target >= item.sets.length) return item;
      const sets = [...item.sets];
      [sets[current], sets[target]] = [sets[target], sets[current]];
      return { ...item, sets: sets.map((set, index) => ({ ...set, index })) };
    });
    persist({ ...workout, exercises });
  };

  const duplicateSet = (exerciseId: string, set: LoggedSet) => {
    if (!workout) return;
    const exercises = workout.exercises.map((item) => item.id !== exerciseId ? item : {
      ...item,
      sets: [...item.sets, { ...set, id: crypto.randomUUID(), index: item.sets.length, completed: false, completedAt: null }],
    });
    persist({ ...workout, exercises });
  };

  const completeSet = (exercise: WorkoutExercise, set: LoggedSet) => {
    if (set.completed) {
      const exercises = workout?.exercises.map((item) => item.id !== exercise.id ? item : {
        ...item, sets: item.sets.map((current) => current.id === set.id ? { ...current, completed: false, completedAt: null } : current),
      });
      if (workout && exercises) persist({ ...workout, exercises, restUntil: null });
      setRestEnd(null);
      return;
    }
    const timestamp = new Date().toISOString();
    const restEndAt = Date.now() + exercise.restSeconds * 1000;
    const exercises = workout?.exercises.map((item) => item.id !== exercise.id ? item : {
      ...item, sets: item.sets.map((current) => current.id === set.id ? { ...current, completed: true, completedAt: timestamp } : current),
    });
    if (workout && exercises) persist({ ...workout, exercises, restUntil: new Date(restEndAt).toISOString() });
    setRestEnd(restEndAt);
    setRestLeft(exercise.restSeconds);
  };

  const finishWorkout = async () => {
    if (!workout || !workout.exercises.some((exercise) => exercise.sets.some((set) => set.completed))) {
      setMessage("Log at least one completed set before finishing.");
      return;
    }
    const finished = { ...workout, status: "completed" as const, completedAt: new Date().toISOString(), restUntil: null, syncStatus: "pending" as const };
    await saveWorkout(finished);
    void syncCompletedWorkout(finished).catch(() => saveWorkout({ ...finished, syncStatus: "error" }));
    setCompletedWorkout(finished);
    setWorkout(null);
    setRestEnd(null);
  };

  const cancelWorkout = async () => {
    if (!workout || !window.confirm("Delete this workout and all its sets?")) return;
    await deleteWorkout(workout.id);
    setWorkout(null);
    setRestEnd(null);
  };

  const results = useMemo(() => {
    const matches = searchExercises(query, catalog);
    if (query.trim()) return matches;
    const byId = new Map(preferences.map((preference) => [preference.id, preference]));
    return [...matches].sort((a, b) => {
      const left = byId.get(a.id), right = byId.get(b.id);
      const rank = (preference: typeof left) => preference?.usedAt && Date.now() - Date.parse(preference.usedAt) < 30 * 86400000 ? 0 : preference?.favorite ? 1 : preference?.useCount ? 2 : 3;
      return rank(left) - rank(right) || (right?.useCount ?? 0) - (left?.useCount ?? 0) || a.name.localeCompare(b.name);
    });
  }, [query, catalog, preferences]);
  const previousByExercise = useMemo(() => {
    const previous = new Map<string, WorkoutExercise>();
    for (const session of history) {
      for (const item of session.exercises) {
        if (!previous.has(item.exerciseId)) previous.set(item.exerciseId, item);
      }
    }
    return previous;
  }, [history]);
  const totals = workout ? calculateWorkoutTotals(workout) : null;
  const completionTotals = completedWorkout ? calculateWorkoutTotals(completedWorkout) : null;
  const completionRecords = completedWorkout ? findPersonalRecords([...history, completedWorkout]).filter((record) => record.workoutId === completedWorkout.id) : [];
  const completedRpes = completedWorkout?.exercises.flatMap((exercise) => exercise.sets.filter((set) => set.completed && set.rpe !== null).map((set) => set.rpe as number)) ?? [];
  const completionMuscles = [...new Set(completedWorkout?.exercises.map((exercise) => exercise.muscle) ?? [])];
  const comparableSession = completedWorkout ? history.find((session) => (session.completedAt ?? "") < (completedWorkout.completedAt ?? "") && session.exercises.some((exercise) => completedWorkout.exercises.some((current) => current.exerciseId === exercise.exerciseId))) : null;
  const comparableExerciseIds = new Set(comparableSession?.exercises.filter((exercise) => completedWorkout?.exercises.some((current) => current.exerciseId === exercise.exerciseId)).map((exercise) => exercise.exerciseId) ?? []);
  const priorVolume = comparableSession ? comparableVolume(comparableSession, comparableExerciseIds) : 0;
  const currentComparableVolume = completedWorkout ? comparableVolume(completedWorkout, comparableExerciseIds) : 0;
  const comparableChange = priorVolume ? Math.round((currentComparableVolume - priorVolume) / priorVolume * 100) : null;

  if (!ready) return <main className="workout-shell"><div className="loading-block">Restoring your session…</div></main>;
  if (completedWorkout && completionTotals) return <main className="workout-shell completion-shell"><header className="workout-top"><Link className="brand" href="/dashboard"><span className="brand-mark">F</span><span>FORGE<span className="brand-period">.</span></span></Link><span className="offline-badge"><span/> SAVED ON THIS DEVICE</span></header><section className="completion-hero"><div className="completion-check"><Check size={25}/></div><p className="eyebrow"><span className="live-dot"/> SESSION COMPLETE</p><h1>Good work<span>.</span></h1><p>{completedWorkout.name} · {new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date(completedWorkout.completedAt ?? completedWorkout.startedAt))}</p></section><section className="completion-stats"><article><span>DURATION</span><strong>{formatTime(completionTotals.durationSeconds)}</strong></article><article><span>WORKING SETS</span><strong>{completionTotals.sets}</strong></article><article><span>TOTAL REPS</span><strong>{completionTotals.reps}</strong></article><article><span>VOLUME</span><strong>{completionTotals.volume.toLocaleString()} <small>kg</small></strong></article></section><div className="analytics-grid completion-grid"><article className="analytics-panel"><div className="panel-heading"><div><p className="eyebrow">PERSONAL RECORDS</p><h2>{completionRecords.length ? `${completionRecords.length} strength ${completionRecords.length === 1 ? "milestone" : "milestones"}` : "Keep building"}</h2></div><CheckCircle2 className="panel-icon" size={18}/></div>{completionRecords.length ? completionRecords.map((record) => <div className="pr-row" key={`${record.exerciseId}-${record.weight}-${record.reps}`}><span className="pr-main"><strong>{record.exerciseName}</strong><small>{record.weight} kg × {record.reps} reps</small></span><span className="pr-value">{record.estimatedOneRepMax.toFixed(1)}<small> e1RM</small></span></div>) : <p className="method-note">Your first estimated strength record will appear when a set improves your previous best.</p>}{completedRpes.length > 0 && <div className="completion-rpe"><span>AVERAGE RPE</span><strong>{(completedRpes.reduce((sum, value) => sum + value, 0) / completedRpes.length).toFixed(1)} / 10</strong></div>}</article><article className="analytics-panel"><div className="panel-heading"><div><p className="eyebrow">SESSION FOCUS</p><h2>{completionMuscles.length} muscle {completionMuscles.length === 1 ? "group" : "groups"}</h2></div><Dumbbell className="panel-icon" size={18}/></div><div className="focus-pills">{completionMuscles.map((muscle) => <span key={muscle}>{muscle}</span>)}</div>{comparableSession && <div className="comparison-card"><span>VS PREVIOUS COMPARABLE SESSION</span><strong className={comparableChange !== null && comparableChange > 0 ? "comparison-positive" : ""}>{comparableChange === null ? "Comparison unavailable" : `${comparableChange > 0 ? "+" : ""}${comparableChange}% volume`}</strong><small>{comparableSession.name}</small></div>}<p className="method-note">Saved locally. Forge will sync this session when a connection and account are available.</p></article></div><footer className="completion-actions"><Link className="outline-button" href="/history">View history</Link><button className="action-button" onClick={() => void beginWorkout()}>Start another <ArrowRight size={15}/></button></footer></main>;
  if (!workout) return (
    <main className="workout-shell">
      <header className="workout-top"><Link className="back-link" href="/dashboard"><ArrowLeft size={17} /> Dashboard</Link><span className="offline-badge"><span /> SAVED ON THIS DEVICE</span></header>
      <section className="start-panel"><p className="eyebrow"><span className="live-dot" /> TRAINING SESSION</p><div className="start-icon"><Dumbbell size={26} /></div><h1>Start a workout.</h1><p>Your session saves to this device as you go. You can add exercises, log sets, and come back after a refresh.</p><button className="action-button" onClick={() => void beginWorkout()}>Start empty workout <Plus size={17} /></button>{message && <p className="inline-message">{message}</p>}</section>
    </main>
  );

  return (
    <main className="workout-shell">
      <header className="workout-top"><Link className="back-link" href="/dashboard"><ArrowLeft size={17} /> Leave session</Link><span className="offline-badge"><span /> SAVED ON THIS DEVICE</span></header>
      <section className="workout-heading">
        <div><p className="eyebrow"><span className="live-dot" /> ACTIVE SESSION</p><input aria-label="Workout name" className="workout-name" value={workout.name} onChange={(event) => persist({ ...workout, name: event.target.value })} /></div>
        <div className="elapsed-chip"><Clock3 size={16} /><span>{formatTime(elapsed)}</span></div>
      </section>
      <section className="session-summary"><div><strong>{workout.exercises.length}</strong><span>EXERCISES</span></div><div><strong>{totals?.sets ?? 0}</strong><span>SETS LOGGED</span></div><div><strong>{(totals?.volume ?? 0).toLocaleString()}</strong><span>KG VOLUME</span></div><div className="summary-sync"><span className="live-dot" /> LOCAL SAVED</div></section>

      <div className="section-heading"><div><p className="eyebrow">YOUR SESSION</p><h2>Exercise log</h2></div><button className="outline-button" onClick={() => setPickerOpen(!pickerOpen)}>{pickerOpen ? <X size={16} /> : <Plus size={16} />}{pickerOpen ? "Close" : "Add exercise"}</button></div>

      {pickerOpen && <section className="exercise-picker"><label className="search-box"><Search size={17} /><input autoFocus placeholder="Search exercises or aliases" value={query} onChange={(event) => setQuery(event.target.value)} /><span>⌘ K</span></label><div className="picker-results">{results.map((exercise) => <button className="picker-result" key={exercise.id} onClick={() => addExercise(exercise)}><span className="exercise-glyph"><Dumbbell size={16} /></span><span className="picker-name"><strong>{exercise.name}</strong><small>{exercise.muscle} · {exercise.equipment}</small></span><Plus size={17} /></button>)}{results.length === 0 && <p className="empty-search">No matching exercises. Try an alias or muscle group.</p>}</div></section>}

      {workout.exercises.length === 0 && !pickerOpen && <section className="empty-exercises"><div className="empty-mark"><Dumbbell size={23} /></div><h3>A clean slate.</h3><p>Add your first exercise and log the work as you go.</p><button className="text-action" onClick={() => setPickerOpen(true)}>Browse exercise catalog <ArrowLeft className="rotate-arrow" size={15} /></button></section>}

      <section className="exercise-stack">{workout.exercises.map((exercise, exerciseIndex) => <article className="exercise-card" key={exercise.id}>
        <header className="exercise-card-head"><div className="exercise-title"><span className="exercise-order">{String(exerciseIndex + 1).padStart(2, "0")}</span><div><h3>{exercise.name}</h3><p>{exercise.muscle} <span>·</span> {exercise.equipment}{exercise.targetRepMin && exercise.targetRepMax ? <span> · {exercise.targetRepMin}–{exercise.targetRepMax} reps</span> : null}</p></div></div><div className="exercise-actions"><button className="icon-button" aria-label={`Move ${exercise.name} up`} disabled={exerciseIndex === 0} onClick={() => moveExercise(exercise.id, -1)}><ArrowUp size={15}/></button><button className="icon-button" aria-label={`Move ${exercise.name} down`} disabled={exerciseIndex === workout.exercises.length - 1} onClick={() => moveExercise(exercise.id, 1)}><ArrowDown size={15}/></button><button className="icon-button remove-button" aria-label={`Remove ${exercise.name}`} onClick={() => removeExercise(exercise.id)}><Trash2 size={16} /></button></div></header>
        <div className="last-time"><span>LAST TIME</span><span>{previousByExercise.get(exercise.exerciseId)?.sets.filter((set) => set.completed).map((set) => `${set.weight ?? "—"} × ${set.reps ?? "—"}${set.rpe === null ? "" : ` @ ${set.rpe}`}`).join("  ·  ") || "No previous session recorded"}</span></div>
        <div className="set-table"><div className="set-table-head"><span>SET</span><span>KG</span><span>REPS</span><span>RPE</span><span>DONE</span></div>{exercise.sets.map((set, index) => <div className={`set-row ${set.completed ? "set-row-done" : ""}`} key={set.id}>
          <div className="set-index">{index + 1}</div>
          <input aria-label={`Set ${index + 1} weight`} inputMode="decimal" type="number" min="0" step="0.5" placeholder="—" value={set.weight ?? ""} onChange={(event) => updateSet(exercise.id, set.id, { weight: event.target.value === "" ? null : Math.max(0, Number(event.target.value)) })} />
          <input aria-label={`Set ${index + 1} reps`} inputMode="numeric" type="number" min="0" step="1" placeholder="—" value={set.reps ?? ""} onChange={(event) => updateSet(exercise.id, set.id, { reps: event.target.value === "" ? null : Math.max(0, Math.floor(Number(event.target.value))) })} />
          <input aria-label={`Set ${index + 1} RPE`} inputMode="decimal" type="number" min="0" max="10" step="0.5" placeholder="—" value={set.rpe ?? ""} onChange={(event) => updateSet(exercise.id, set.id, { rpe: event.target.value === "" ? null : Math.min(10, Math.max(0, Number(event.target.value))) })} />
          <div className="set-row-actions"><button className={`complete-set ${set.completed ? "complete-set-active" : ""}`} aria-label={set.completed ? `Undo set ${index + 1}` : `Complete set ${index + 1}`} onClick={() => completeSet(exercise, set)}>{set.completed ? <Check size={17} /> : <CheckCircle2 size={19} />}</button><details className="set-actions"><summary aria-label={`Set ${index + 1} actions`}>···</summary><div className="set-action-menu"><button onClick={() => moveSet(exercise.id, set.id, -1)} disabled={index === 0}><ArrowUp size={13}/> Move up</button><button onClick={() => moveSet(exercise.id, set.id, 1)} disabled={index === exercise.sets.length - 1}><ArrowDown size={13}/> Move down</button><button onClick={() => duplicateSet(exercise.id, set)}><Copy size={13}/> Duplicate</button><button onClick={() => removeSet(exercise.id, set.id)} disabled={exercise.sets.length < 2}><Trash2 size={13}/> Delete</button></div></details></div>
        </div>)}</div>
        <button className="add-set-button" onClick={() => addSet(exercise.id)}><Plus size={15} /> Add set</button>
      </article>)}</section>

      {restEnd && <aside className="rest-timer"><div className="rest-icon"><Flame size={17} /></div><div className="rest-copy"><span>REST TIMER</span><strong>{formatTime(restLeft)}</strong></div><div className="rest-controls"><button onClick={() => { const next = Math.max(0, restLeft - 15); setRestEnd(Date.now() + next * 1000); setRestLeft(next); persist({ ...workout, restUntil: new Date(Date.now() + next * 1000).toISOString() }); }} aria-label="Subtract 15 seconds">−15</button><button onClick={() => { const next = restLeft + 15; setRestEnd(Date.now() + next * 1000); setRestLeft(next); persist({ ...workout, restUntil: new Date(Date.now() + next * 1000).toISOString() }); }} aria-label="Add 15 seconds">+15</button><button onClick={() => { setRestEnd(null); persist({ ...workout, restUntil: null }); }} aria-label="Skip rest timer"><X size={17} /></button></div></aside>}

      <label className="notes-field"><span>SESSION NOTES</span><textarea placeholder="Anything to remember for next time?" value={workout.notes} onChange={(event) => persist({ ...workout, notes: event.target.value })} /></label>
      {message && <p className="inline-message">{message}</p>}
      <footer className="finish-row"><button className="cancel-workout" onClick={() => void cancelWorkout()}><Trash2 size={16} /> Delete workout</button><button className="action-button finish-button" onClick={() => void finishWorkout()}>Finish workout <Check size={17} /></button></footer>
    </main>
  );
}
