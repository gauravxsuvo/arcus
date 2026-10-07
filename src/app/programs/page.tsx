"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown, ChevronUp, Dumbbell, Plus, Search, Trash2 } from "lucide-react";
import { exerciseCatalog, searchExercises } from "@/features/exercises/catalog";
import type { ProgramDay, ProgramExercise, TrainingProgram } from "@/features/programs/model";
import { listCustomExercises, listPrograms, markExerciseUsed, removeProgram, saveProgram } from "@/features/local-data/repository";
import { syncProgram } from "@/features/workouts/sync";

function createDay(name: string, weekIndex: number): ProgramDay { return { id: crypto.randomUUID(), name, weekIndex, exercises: [] }; }

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [catalog, setCatalog] = useState(exerciseCatalog);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("Strength");
  const [days, setDays] = useState<ProgramDay[]>([createDay("Day A", 0)]);
  const [weekCount, setWeekCount] = useState(1);
  const [activeWeekIndex, setActiveWeekIndex] = useState(0);
  const [dayQuery, setDayQuery] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const refresh = async () => setPrograms(await listPrograms());
  useEffect(() => { let cancelled = false; void Promise.all([listPrograms(), listCustomExercises()]).then(([items, custom]) => { if (!cancelled) { setPrograms(items); setCatalog([...exerciseCatalog, ...custom]); setReady(true); } }).catch(() => { if (!cancelled) { setMessage("Could not open local program storage."); setReady(true); } }); return () => { cancelled = true; }; }, []);

  const saveCurrent = async () => {
    if (!name.trim()) { setMessage("Give this program a name first."); return; }
    if (!days.length || days.every((day) => day.exercises.length === 0)) { setMessage("Add at least one exercise to your program."); return; }
    const now = new Date().toISOString();
    const program: TrainingProgram = { id: crypto.randomUUID(), name: name.trim(), goal, days, createdAt: now, updatedAt: now, syncStatus: "pending" };
    await saveProgram(program); await refresh();
    void syncProgram(program).catch(() => saveProgram({ ...program, syncStatus: "error" }));
    setName(""); setGoal("Strength"); setDays([createDay("Day A", 0)]); setWeekCount(1); setActiveWeekIndex(0); setMessage("Program saved on this device.");
  };

  const addDay = () => setDays((current) => [...current, createDay(`Day ${String.fromCharCode(65 + current.filter((day) => day.weekIndex === activeWeekIndex).length)}`, activeWeekIndex)]);
  const addWeek = () => setWeekCount((count) => { setActiveWeekIndex(count); return count + 1; });
  const updateDay = (dayId: string, update: Partial<ProgramDay>) => setDays((current) => current.map((day) => day.id === dayId ? { ...day, ...update } : day));
  const addExercise = (dayId: string, exerciseId: string) => {
    const selectedExercise = catalog.find((item) => item.id === exerciseId);
    if (!selectedExercise) return;
    const entry: ProgramExercise = { id: crypto.randomUUID(), exerciseId: selectedExercise.id, name: selectedExercise.name, muscle: selectedExercise.muscle, equipment: selectedExercise.equipment, sets: 3, repMin: 6, repMax: 12, restSeconds: selectedExercise.restSeconds, progressionMethod: "double_progression", progressionValue: null };
    void markExerciseUsed(selectedExercise.id);
    updateDay(dayId, { exercises: [...(days.find((day) => day.id === dayId)?.exercises ?? []), entry] });
    setPicker(null); setDayQuery((current) => ({ ...current, [dayId]: "" }));
  };
  const updateProgramExercise = (dayId: string, index: number, update: Partial<ProgramExercise>) => updateDay(dayId, { exercises: days.find((day) => day.id === dayId)?.exercises.map((exercise, i) => i === index ? { ...exercise, ...update } : exercise) });
  const moveProgramExercise = (dayId: string, index: number, direction: -1 | 1) => {
    const list = days.find((day) => day.id === dayId)?.exercises;
    if (!list || index + direction < 0 || index + direction >= list.length) return;
    const reordered = [...list]; [reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]];
    updateDay(dayId, { exercises: reordered });
  };
  const filteredExercises = (dayId: string) => searchExercises(dayQuery[dayId] ?? "", catalog).slice(0, 12);
  const savedExerciseCount = useMemo(() => programs.reduce((sum, program) => sum + program.days.reduce((daySum, day) => daySum + day.exercises.length, 0), 0), [programs]);
  const deleteSavedProgram = async (program: TrainingProgram) => {
    if (!window.confirm(`Delete “${program.name}”?`)) return;
    await removeProgram(program.id); await refresh();
    void syncProgram({ ...program, deleted: true, syncStatus: "pending" }).catch(() => saveProgram({ ...program, deleted: true, syncStatus: "error" }));
  };

  return <main className="workout-shell programs-shell"><header className="workout-top"><Link className="back-link" href="/dashboard"><ArrowLeft size={17}/> Dashboard</Link><Link className="offline-badge" href="/workout"><span/> START WORKOUT</Link></header><section className="history-heading"><p className="eyebrow"><span className="live-dot"/> PROGRAMMING</p><h1>Make a plan<span>.</span></h1><p>Build a repeatable week. Your plan is saved on this device.</p></section>
    <section className="program-builder"><div className="program-builder-head"><div><p className="eyebrow">PROGRAM BUILDER</p><h2>New training plan</h2></div><CalendarDays size={19}/></div><div className="program-base"><label>Program name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Upper / Lower strength" maxLength={70}/></label><label>Primary goal<select value={goal} onChange={(event) => setGoal(event.target.value)}><option>Strength</option><option>Muscle gain</option><option>General fitness</option><option>Fat loss</option><option>Athletic performance</option></select></label></div>
      <div className="week-picker" role="tablist" aria-label="Program weeks">{Array.from({ length: weekCount }, (_, index) => <button role="tab" aria-selected={activeWeekIndex === index} className={activeWeekIndex === index ? "week-tab week-tab-active" : "week-tab"} key={index} onClick={() => setActiveWeekIndex(index)}>Week {index + 1}</button>)}<button className="week-add" onClick={addWeek}><Plus size={13}/> Add week</button></div>
      <div className="program-days">{days.filter((day) => day.weekIndex === activeWeekIndex).map((day, dayIndex) => <article className="program-day" key={day.id}><header><span className="exercise-order">{String(dayIndex + 1).padStart(2, "0")}</span><input aria-label="Training day name" value={day.name} onChange={(event) => updateDay(day.id, { name: event.target.value })}/><button className="icon-button remove-button" aria-label={`Remove ${day.name}`} disabled={days.filter((item) => item.weekIndex === day.weekIndex).length < 2} onClick={() => setDays((current) => current.filter((item) => item.id !== day.id))}><Trash2 size={15}/></button></header>
        {day.exercises.map((exercise, exerciseIndex) => <div className="program-exercise" key={`${exercise.exerciseId}-${exerciseIndex}`}><div className="program-exercise-name"><Dumbbell size={15}/><div><strong>{exercise.name}</strong><small>{exercise.muscle} · {exercise.equipment}</small></div></div><label>SETS<input aria-label={`${exercise.name} set target`} type="number" min="1" max="20" value={exercise.sets} onChange={(event) => updateProgramExercise(day.id, exerciseIndex, { sets: Math.min(20, Math.max(1, Number(event.target.value)))})}/></label><label>MIN REPS<input aria-label={`${exercise.name} minimum reps`} type="number" min="1" max="99" value={exercise.repMin} onChange={(event) => { const value = Number(event.target.value); if (value > 0 && value <= exercise.repMax) updateProgramExercise(day.id, exerciseIndex, { repMin: value }); }}/></label><label>MAX REPS<input aria-label={`${exercise.name} maximum reps`} type="number" min={exercise.repMin} max="100" value={exercise.repMax} onChange={(event) => { const value = Number(event.target.value); if (value >= exercise.repMin && value <= 100) updateProgramExercise(day.id, exerciseIndex, { repMax: value }); }}/></label><label>PROGRESSION<select aria-label={`${exercise.name} progression method`} value={exercise.progressionMethod} onChange={(event) => updateProgramExercise(day.id, exerciseIndex, { progressionMethod: event.target.value as ProgramExercise["progressionMethod"] })}><option value="double_progression">Double progression</option><option value="rpe">RPE-guided</option><option value="percentage">Percentage based</option><option value="manual">Manual</option></select></label>{exercise.progressionMethod === "percentage" && <label>TRAINING MAX %<input aria-label={`${exercise.name} training max percentage`} type="number" min="40" max="100" value={exercise.progressionValue ?? 80} onChange={(event) => { const value = Number(event.target.value); if (value >= 40 && value <= 100) updateProgramExercise(day.id, exerciseIndex, { progressionValue: value }); }}/></label>}{exercise.progressionMethod === "rpe" && <label>TARGET RPE<input aria-label={`${exercise.name} target RPE`} type="number" min="5" max="10" step="0.5" value={exercise.progressionValue ?? 8} onChange={(event) => { const value = Number(event.target.value); if (value >= 5 && value <= 10) updateProgramExercise(day.id, exerciseIndex, { progressionValue: value }); }}/></label>}<div className="program-order"><button className="icon-button" aria-label="Move exercise up" disabled={exerciseIndex === 0} onClick={() => moveProgramExercise(day.id, exerciseIndex, -1)}><ChevronUp size={15}/></button><button className="icon-button" aria-label="Move exercise down" disabled={exerciseIndex === day.exercises.length - 1} onClick={() => moveProgramExercise(day.id, exerciseIndex, 1)}><ChevronDown size={15}/></button></div><button className="icon-button remove-button" aria-label={`Remove ${exercise.name}`} onClick={() => updateDay(day.id, { exercises: day.exercises.filter((_, index) => index !== exerciseIndex) })}><Trash2 size={14}/></button></div>)}
        {picker === day.id ? <div className="program-picker"><label className="search-box"><Search size={15}/><input autoFocus placeholder="Search exercise catalog" value={dayQuery[day.id] ?? ""} onChange={(event) => setDayQuery((current) => ({ ...current, [day.id]: event.target.value }))}/></label><div className="picker-results">{filteredExercises(day.id).map((exercise) => <button className="picker-result" key={exercise.id} onClick={() => addExercise(day.id, exercise.id)}><span className="picker-name"><strong>{exercise.name}</strong><small>{exercise.muscle} · {exercise.equipment}</small></span><Plus size={15}/></button>)}</div></div> : <button className="add-set-button" onClick={() => setPicker(day.id)}><Plus size={15}/> Add exercise</button>}
      </article>)}</div><div className="program-builder-actions"><button className="outline-button" onClick={addDay}><Plus size={15}/> Add training day</button><button className="action-button" onClick={() => void saveCurrent()}>Save program <ArrowRight size={16}/></button></div>{message && <p role="status" className="inline-message">{message}</p>}</section>

    <section className="saved-programs"><div className="panel-heading"><div><p className="eyebrow">YOUR TRAINING PLANS</p><h2>Saved programs</h2></div><span className="program-count">{programs.length} PLANS · {savedExerciseCount} EXERCISES</span></div>{!ready ? <div className="loading-block">Loading programs…</div> : programs.length === 0 ? <div className="analytics-empty">Your first plan will appear here after you save it.</div> : programs.map((program) => <article className="saved-program" key={program.id}><header><div><span className="program-goal">{program.goal.toUpperCase()}</span><h3>{program.name}</h3><small>{program.days.length} training days · {Math.max(1, ...program.days.map((day) => day.weekIndex + 1))} weeks</small></div><button className="icon-button remove-button" onClick={() => void deleteSavedProgram(program)} aria-label={`Delete ${program.name}`}><Trash2 size={16}/></button></header><div className="saved-days">{Array.from({ length: Math.max(1, ...program.days.map((day) => day.weekIndex + 1)) }, (_, week) => <div className="saved-week" key={week}><span className="saved-week-label">WEEK {week + 1}</span>{program.days.filter((day) => day.weekIndex === week).map((day) => <div className="saved-day" key={day.id}><div><strong>{day.name}</strong><small>{day.exercises.length} exercises · {day.exercises.slice(0, 3).map((exercise) => exercise.name).join(", ")}</small></div><Link className="start-day-link" href={`/workout?program=${encodeURIComponent(program.id)}&day=${encodeURIComponent(day.id)}`}>Start day <ArrowRight size={14}/></Link></div>)}</div>)}</div></article>)}</section>
  </main>;
}
