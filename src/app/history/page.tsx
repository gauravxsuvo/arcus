"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown, ChevronRight, Clipboard, History as HistoryIcon, Search, SlidersHorizontal, Upload, X } from "lucide-react";
import { calculateWorkoutTotals, createWorkout, type WorkoutRecord } from "@/features/workouts/model";
import { getActiveWorkout, getCompletedWorkouts, saveWorkout } from "@/features/workouts/repository";
import { filterWorkoutHistory } from "@/features/workouts/filter";
import { exerciseCatalog } from "@/features/exercises/catalog";
import { listCustomExercises } from "@/features/local-data/repository";
import { parseWorkoutTransfer, workoutToTransferJson, workoutToTransferText } from "@/features/workouts/transfer";
import { workoutSchema } from "@/features/import-export/restore-schema";
import { WorkoutComparison } from "@/components/history/workout-comparison";
import { useProfile } from "@/components/shared/user-profile-provider";
import { detectRecords, formatWeight } from "@/features/training/logic";
import styles from "./history.module.css";

function prettyDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function prettyDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes} min`;
}

export default function HistoryPage() {
  const { preferences } = useProfile();
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [query, setQuery] = useState("");
  const [exerciseFilter, setExerciseFilter] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferText, setTransferText] = useState("");
  const [transferMessage, setTransferMessage] = useState("");
  const [activeBlocked, setActiveBlocked] = useState(false);
  const [importing, setImporting] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const recordCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of detectRecords(workouts)) counts.set(record.workoutId, (counts.get(record.workoutId) ?? 0) + 1);
    return counts;
  }, [workouts]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setReady(false);
      setLoadError(false);
      try {
        const rows = await getCompletedWorkouts();
        if (!cancelled) setWorkouts(rows);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const exerciseOptions = useMemo(() => [...new Map(workouts.flatMap((workout) => workout.exercises.map((exercise) => [exercise.exerciseId, exercise.name] as const))).entries()].sort((a, b) => a[1].localeCompare(b[1])), [workouts]);
  const muscleOptions = useMemo(() => [...new Set(workouts.flatMap((workout) => workout.exercises.map((exercise) => exercise.muscle)))].sort(), [workouts]);
  const extraFilterCount = [exerciseFilter, muscleFilter, fromDate, toDate].filter(Boolean).length;
  const hasFilters = Boolean(query.trim() || extraFilterCount);
  const invalidDateRange = Boolean(fromDate && toDate && fromDate > toDate);
  const filteredWorkouts = useMemo(() => filterWorkoutHistory(workouts, { query, exerciseId: exerciseFilter, muscle: muscleFilter, fromDate, toDate }), [workouts, query, exerciseFilter, muscleFilter, fromDate, toDate]);

  function resetFilters() {
    setQuery(""); setExerciseFilter(""); setMuscleFilter(""); setFromDate(""); setToDate("");
  }

  async function copyWorkout(workout: WorkoutRecord, format: "text" | "json") {
    try {
      const value = format === "json" ? workoutToTransferJson(workout) : workoutToTransferText(workout);
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${workout.name || "Workout"} copied as ${format === "json" ? "JSON" : "text"}.`);
    } catch {
      setCopyMessage("Copy was blocked by your browser. Allow clipboard access and try again.");
    }
  }

  async function importWorkout() {
    if (importing) return;
    setImporting(true); setTransferMessage(""); setActiveBlocked(false);
    try {
      if (await getActiveWorkout()) {
        setActiveBlocked(true);
        setTransferMessage("You already have a workout in progress. Finish or discard it before importing another.");
        return;
      }
      const custom = await listCustomExercises();
      const imported = parseWorkoutTransfer(transferText, [...exerciseCatalog, ...custom]);
      if (!workoutSchema.safeParse(imported).success) throw new Error("This workout contains invalid exercise or set data. Check the export and try again.");
      await saveWorkout({ ...imported, id: createWorkout().id, status: "active", completedAt: null, syncStatus: "pending" });
      window.location.href = "/workout";
    } catch (reason) {
      setTransferMessage(reason instanceof Error ? reason.message : "Could not import this workout. Your existing sessions have not changed.");
    } finally { setImporting(false); }
  }

  return (
    <main className={`workout-shell ${styles.shell}`}>
      <header className={styles.top}>
        <Link href="/dashboard"><ArrowLeft size={17} aria-hidden="true" /> Home</Link>
        <Link href="/workout">Open workout <ArrowRight size={16} aria-hidden="true" /></Link>
      </header>
      <section className={styles.heading}>
        <div><p className={styles.kicker}>YOUR TRAINING LOG</p><h1>History</h1><p>Your sessions, ready when you need them.</p></div>
        <button className={styles.secondary} aria-expanded={transferOpen} aria-controls="workout-transfer" onClick={() => { setTransferOpen((open) => !open); setTransferMessage(""); setActiveBlocked(false); }}><Upload size={17} aria-hidden="true" /> Paste workout</button>
      </section>
      {copyMessage && <p className={`${styles.notice} ${styles.copyNotice}`} role="status">{copyMessage}<button aria-label="Dismiss copy message" onClick={() => setCopyMessage("")}><X size={17} /></button></p>}
      {transferOpen && <section id="workout-transfer" className={styles.transfer}>
        <h2>Bring your workout with you</h2>
        <p>Paste workout text from HEVY or an ARCUS text or JSON export. You can review it in the workout screen before finishing.</p>
        <label htmlFor="workout-transfer-text">Workout text or JSON</label>
        <textarea id="workout-transfer-text" value={transferText} disabled={importing} onChange={(event) => setTransferText(event.target.value)} placeholder={'Bench Press\n1. 80 kg × 8\n2. 80 kg × 7'} />
        <div className={styles.transferActions}><button className={styles.primary} disabled={!transferText.trim() || importing} onClick={() => void importWorkout()}>{importing ? "Opening workout…" : "Open as new workout"}<ArrowRight size={16} aria-hidden="true" /></button><button className={styles.secondary} disabled={!transferText || importing} onClick={() => { setTransferText(""); setTransferMessage(""); setActiveBlocked(false); }}>Clear</button></div>
        <Link className={styles.csvLink} href="/profile/data">Have a CSV file? Import workout history <ChevronRight size={15} aria-hidden="true" /></Link>
        {transferMessage && <div className={styles.notice} role="status"><span>{transferMessage}{activeBlocked && <Link href="/workout">Resume current workout <ArrowRight size={15} aria-hidden="true" /></Link>}</span></div>}
      </section>}
      {!ready ? <section className={styles.empty} role="status"><HistoryIcon size={26} aria-hidden="true" /><p>Loading your sessions…</p></section> : loadError ? <section className={styles.empty} role="alert"><HistoryIcon size={26} aria-hidden="true" /><h2>Could not load your history</h2><p>Local storage could not be read. Try again to see your sessions.</p><button className={styles.secondary} onClick={() => setRefreshKey((value) => value + 1)}>Try again</button></section> : workouts.length === 0 ? <section className={styles.empty}><HistoryIcon size={28} aria-hidden="true" /><h2>Your log starts here</h2><p>Finish a workout and it will appear here. You can also import your previous sessions.</p><Link className={styles.primary} href="/workout">Start your first workout <ArrowRight size={16} aria-hidden="true" /></Link><Link className={styles.csvLink} href="/profile/data">Import workout history</Link></section> : <>
        <section className={styles.filters} aria-label="Filter workout history">
          <div className={styles.search}><Search size={18} aria-hidden="true" /><input aria-label="Search workout history" placeholder="Search sessions or exercises" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={17} /></button>}</div>
          <details className={styles.filterDetails}><summary><SlidersHorizontal size={17} aria-hidden="true" /> Filters {extraFilterCount > 0 && <span className={styles.badge}>{extraFilterCount} active</span>}<ChevronDown size={16} aria-hidden="true" /></summary><div className={styles.filterGrid}>
            <label>Exercise<select aria-label="Exercise" value={exerciseFilter} onChange={(event) => setExerciseFilter(event.target.value)}><option value="">All exercises</option>{exerciseOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
            <label>Muscle<select aria-label="Muscle" value={muscleFilter} onChange={(event) => setMuscleFilter(event.target.value)}><option value="">All muscles</option>{muscleOptions.map((muscle) => <option key={muscle}>{muscle}</option>)}</select></label>
            <label>From date<input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} /></label>
            <label>To date<input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></label>
          </div>{invalidDateRange && <p className={styles.rangeError} role="alert">Choose a to date on or after the from date.</p>}</details>
        </section>
        <div className={styles.resultHeading}><p role="status">{filteredWorkouts.length} {filteredWorkouts.length === 1 ? "session" : "sessions"}{hasFilters ? ` of ${workouts.length}` : ""}</p>{hasFilters && <button onClick={resetFilters}>Reset filters <X size={14} aria-hidden="true" /></button>}</div>
        {filteredWorkouts.length === 0 ? <section className={styles.empty}><Search size={26} aria-hidden="true" /><h2>No matching sessions</h2><p>Try another search or reset your filters to see all your workouts.</p><button className={styles.secondary} onClick={resetFilters}>Reset filters</button></section> : <section className={styles.list} aria-label="Completed workouts">{filteredWorkouts.map((workout) => {
          const totals = calculateWorkoutTotals(workout);
          const recordCount = recordCounts.get(workout.id) ?? 0;
          return <article className={styles.session} key={workout.id}>
            <Link className={styles.sessionLink} href={`/history/${workout.id}`} aria-label={`View ${workout.name || "Workout"}, ${prettyDate(workout.completedAt ?? workout.startedAt)}`}>
              <div className={styles.sessionTitle}><span className={styles.calendar}><CalendarDays size={19} aria-hidden="true" /></span><div><h2>{workout.name || "Workout"}</h2><time dateTime={workout.completedAt ?? workout.startedAt}>{prettyDate(workout.completedAt ?? workout.startedAt)}</time></div><ChevronRight size={19} aria-hidden="true" /></div>
              <div className={styles.stats}><div><strong>{prettyDuration(totals.durationSeconds)}</strong><span>Duration</span></div><div><strong>{formatWeight(totals.volume, preferences.units)}</strong><span>Volume</span></div><div><strong>{totals.sets}</strong><span>Sets</span></div></div>
              <p className={styles.exercisePreview}>{workout.exercises.slice(0, 2).map((exercise) => exercise.name).join(" · ")}{workout.exercises.length > 2 && ` · +${workout.exercises.length - 2} more`}{workout.exercises.length === 0 && "No exercises recorded"}</p>
            </Link>
            <div className={styles.sessionFooter}><span>{workout.exercises.length} {workout.exercises.length === 1 ? "exercise" : "exercises"}{recordCount > 0 && <span className={styles.recordBadge}> · {recordCount} {recordCount === 1 ? "record" : "records"}</span>}</span><details className={styles.options}><summary aria-label={`Actions for ${workout.name || "Workout"}`}>Options <ChevronDown size={14} aria-hidden="true" /></summary><div><Link href={`/history/${workout.id}?edit=1`}>Edit workout</Link><Link href={`/workout?repeat=${workout.id}`}>Repeat workout</Link><button onClick={() => void copyWorkout(workout, "text")}><Clipboard size={14} aria-hidden="true" /> Copy text</button><button onClick={() => void copyWorkout(workout, "json")}>Copy JSON</button></div></details></div>
          </article>;
        })}</section>}
        {workouts.length >= 2 && <div className={styles.comparison}><WorkoutComparison workouts={workouts} /></div>}
      </>}
    </main>
  );
}
