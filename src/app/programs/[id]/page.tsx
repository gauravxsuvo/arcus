"use client";

import { usePageTitle } from "@/components/shared/page-title";
import { NumericInput } from "@/components/shared/numeric-input";
import { useEffect, useState } from "react";
import { useLocalRouteId } from "@/components/shared/use-local-route-id";
import Link from "next/link";
import { listPrograms, saveProgram } from "@/features/local-data/repository";
import { useProfile } from "@/components/shared/user-profile-provider";
import type { ActiveProgram } from "@/features/profile/model";
import type { TrainingProgram } from "@/features/programs/model";
import { programSchedule } from "@/features/programs/schedule";
import { getCompletedWorkouts } from "@/features/workouts/repository";
import type { WorkoutRecord } from "@/features/workouts/model";
import { dateKey, fromDisplayWeight, toDisplayWeight, weightUnit } from "@/features/training/logic";

export default function ProgramDetail() {
  const id = useLocalRouteId();
  const { user, save, preferences } = useProfile();
  const [program, setProgram] = useState<TrainingProgram | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([]);
  const [date, setDate] = useState(dateKey(new Date()));
  const [scheduleMode, setScheduleMode] = useState<ActiveProgram["scheduleMode"]>("calendar");
  const [message, setMessage] = useState("");
  const [maxes, setMaxes] = useState<Record<string, number>>({});

  usePageTitle(program?.name ?? "Program");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listPrograms(), getCompletedWorkouts()]).then(([items, history]) => {
      if (cancelled) return;
      setProgram(items.find((item) => item.id === id) ?? null);
      setWorkouts(history);
    }).catch(() => { if (!cancelled) setMessage("Could not load this program."); });
    return () => { cancelled = true; };
  }, [id]);

  const enrolled = user?.profile.activeProgram?.programId === id ? user.profile.activeProgram : null;
  const schedule = program && enrolled ? programSchedule(program, enrolled, new Date(), workouts) : null;
  const percentageLifts = program ? [...new Map(program.days.flatMap((day) => day.exercises
    .filter((exercise) => exercise.setTargets?.some((set) => set.percentage))
    .map((exercise) => [exercise.exerciseId, exercise.name] as const))).entries()] : [];

  async function enroll() {
    if (!user) { setMessage("Sign in to keep your enrollment."); return; }
    await save({ ...user.profile, activeProgram: { programId: id, startDate: date, trainingMaxes: maxes, scheduleMode } });
    setMessage("Program started. Your dashboard now shows the schedule.");
  }

  async function updateProgram(change: Partial<TrainingProgram>) {
    if (!program) return;
    const next = { ...program, ...change, updatedAt: new Date().toISOString(), syncStatus: "pending" as const };
    await saveProgram(next);
    setProgram(next);
  }

  async function updateEnrollment(change: Partial<ActiveProgram>) {
    if (!user || !enrolled) return;
    await save({ ...user.profile, activeProgram: { ...enrolled, ...change } });
    setMessage("Your next session has been updated.");
  }

  async function endEnrollment() {
    if (!user) return;
    await save({ ...user.profile, activeProgram: null });
    setMessage("Program enrollment ended.");
  }

  async function shareProgram() {
    if (!program) return;
    const plan = `${program.name}\n${program.description ?? program.goal}\n\n${program.days
      .slice().sort((a, b) => a.weekIndex - b.weekIndex).map((day) => `${day.name}\n${day.exercises.map((exercise) => `• ${exercise.name}: ${exercise.sets} × ${exercise.repMin}${exercise.repMax !== exercise.repMin ? `–${exercise.repMax}` : ""} reps`).join("\n")}`).join("\n\n")}`;
    try {
      if (navigator.share) await navigator.share({ title: `${program.name} · ARCUS`, text: plan });
      else { await navigator.clipboard.writeText(plan); setMessage("Program copied to your clipboard."); }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") setMessage("Could not share this program from this browser.");
    }
  }

  if (!program) return <main className="workout-shell"><Link className="back-link" href="/programs">← Programs</Link><p>{message || "Loading program…"}</p></main>;

  const weeks = Array.from({ length: Math.max(1, ...program.days.map((day) => day.weekIndex + 1)) }, (_, week) => week);

  return <main className="workout-shell program-detail">
    <header className="workout-top"><Link className="back-link" href="/programs">← Programs</Link><Link className="back-link" href="/dashboard">Home</Link></header>
    <section className="history-heading"><p className="eyebrow">YOUR TRAINING PLAN</p><h1>{program.name}</h1><p>{program.description ?? program.goal}</p></section>
    <div className="program-toolbar"><button className="outline-button" type="button" onClick={() => window.print()}>Print / Save PDF</button><button className="outline-button" type="button" onClick={() => void shareProgram()}>Share plan</button></div>

    {schedule && <section className="feature-panel"><h2>{schedule.finished ? "Program complete" : `Week ${schedule.week} of ${schedule.totalWeeks} · Block ${schedule.block}`}</h2>
      <p>{schedule.deload ? "Deload week · reduced volume and load" : schedule.deloadNext ? "Deload next week" : schedule.mode === "rotation" ? `Session ${schedule.completedSessions + 1} · advance when you finish a workout` : "Build steadily this week"}</p>
      {schedule.day ? <Link className="action-button" href={`/workout?program=${encodeURIComponent(id)}&day=${encodeURIComponent(schedule.day.id)}`}>Start {schedule.day.name}</Link> : <p>{schedule.finished ? "This plan has no sessions left." : schedule.mode === "rotation" ? `Next session is available ${schedule.nextWorkoutDate ? `on ${schedule.nextWorkoutDate}` : "when you’re ready"}.` : schedule.started ? "Recovery day. Your next session is ready in Programs." : `Your program starts on ${enrolled?.startDate}.`}</p>}
      {enrolled && <button className="text-action" onClick={() => void endEnrollment()}>End enrollment</button>}
    </section>}

    <section className="feature-panel"><h2>{enrolled ? "Program schedule" : "Start program"}</h2>
      {!enrolled && <><label>Start date<input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Schedule style<select value={scheduleMode} onChange={(event) => setScheduleMode(event.target.value as ActiveProgram["scheduleMode"])}><option value="calendar">Calendar days · use the weekly schedule</option><option value="rotation">Next session · advance when completed</option></select></label>
        {percentageLifts.length > 0 && <><p>Enter a conservative training max for percentage-based sets.</p><div className="feature-grid">{percentageLifts.map(([exerciseId, name]) => <label key={exerciseId}>{name} · {weightUnit(preferences.units)}<NumericInput min="1" step="0.5" value={maxes[exerciseId] ? Number(toDisplayWeight(maxes[exerciseId], preferences.units).toFixed(1)) : ""} onChange={(event) => setMaxes({ ...maxes, [exerciseId]: fromDisplayWeight(Number(event.target.value), preferences.units) })} /></label>)}</div></>}
        <button className="action-button" disabled={!date || percentageLifts.some(([exerciseId]) => !(maxes[exerciseId] > 0))} onClick={() => void enroll()}>Start program</button>
      </>}
      {enrolled && <div className="feature-grid program-reschedule"><label>Schedule style<select value={enrolled.scheduleMode ?? "calendar"} onChange={(event) => void updateEnrollment({ scheduleMode: event.target.value as ActiveProgram["scheduleMode"] })}><option value="calendar">Calendar days · use the weekly schedule</option><option value="rotation">Next session · advance when completed</option></select></label>
        {enrolled.scheduleMode === "rotation" && <>
          <label>Next session date<input type="date" min={dateKey(new Date())} value={enrolled.nextWorkoutDate ?? ""} onChange={(event) => void updateEnrollment(event.target.value ? { nextWorkoutDate: event.target.value } : { nextWorkoutDate: undefined })} /></label>
          <label>Choose next session<select value={enrolled.nextDayId ?? schedule?.day?.id ?? ""} onChange={(event) => void updateEnrollment(event.target.value ? { nextDayId: event.target.value } : { nextDayId: undefined })}><option value="">Use the planned next day</option>{program.days.map((day) => <option key={day.id} value={day.id}>{day.name}</option>)}</select></label>
        </>}
        {enrolled.scheduleMode !== "rotation" && <p className="data-caption">Calendar mode follows the plan’s weekly training and recovery days. Choose “Next session” to reschedule individual workouts.</p>}
      </div>}
      {message && <p role="status">{message}</p>}
    </section>

    <section className="feature-panel"><h2>Blocks & deloads</h2><div className="feature-grid"><label>Duration · weeks<NumericInput min="1" max="52" value={program.durationWeeks ?? 12} onChange={(event) => void updateProgram({ durationWeeks: Math.max(1, Math.min(52, Number(event.target.value))) })} /></label><label>Block length · weeks<NumericInput min="3" max="5" value={program.blockWeeks ?? 4} onChange={(event) => void updateProgram({ blockWeeks: Math.max(3, Math.min(5, Number(event.target.value))) })} /></label><label>Deload every N weeks · 0 disables<NumericInput min="0" max="12" value={program.deloadEveryNWeeks ?? 4} onChange={(event) => void updateProgram({ deloadEveryNWeeks: Math.max(0, Math.min(12, Number(event.target.value))) })} /></label><label>Deload reduction · %<NumericInput min="0" max="60" value={program.deloadReductionPercent ?? 40} onChange={(event) => void updateProgram({ deloadReductionPercent: Math.max(0, Math.min(60, Number(event.target.value))) })} /></label><label>Training-max increase per block · %<NumericInput min="0" max="10" step="0.5" value={program.blockIncreasePercent ?? 2} onChange={(event) => void updateProgram({ blockIncreasePercent: Math.max(0, Math.min(10, Number(event.target.value))) })} /></label></div></section>

    <div className="printable-program"><section className="print-program-heading"><p>ARCUS · TRAINING PLAN</p><h1>{program.name}</h1><p>{program.description ?? program.goal}</p></section>{weeks.map((week) => <section className="feature-panel" key={week}><h2>Template week {week + 1}</h2>{program.days.filter((day) => day.weekIndex === week).map((day) => <article className="program-schedule-day" key={day.id}><h3>{day.name}</h3>{day.exercises.map((exercise) => <p key={exercise.id}><strong>{exercise.name}</strong><span>{exercise.setTargets ? exercise.setTargets.map((set) => `${set.reps} reps @ ${set.percentage}% TM`).join(" · ") : `${exercise.sets} × ${exercise.repMin}${exercise.repMax !== exercise.repMin ? `–${exercise.repMax}` : ""}`}{exercise.targetRpe ? ` · RPE ${exercise.targetRpe}` : ""}</span></p>)}<Link className="text-action" href={`/workout?program=${encodeURIComponent(id)}&day=${encodeURIComponent(day.id)}`}>Start this day →</Link></article>)}</section>)}</div>
  </main>;
}
