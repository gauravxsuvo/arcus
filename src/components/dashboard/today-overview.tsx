"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, ChevronDown, Flame, Target, Trophy } from "lucide-react";
import { useProfile } from "@/components/shared/user-profile-provider";
import { exerciseCatalog } from "@/features/exercises/catalog";
import { listPrograms } from "@/features/local-data/repository";
import type { TrainingProgram } from "@/features/programs/model";
import { programSchedule } from "@/features/programs/schedule";
import { consistency, dateKey, detectRecords, formatWeight, goalProgress, weekStartDate } from "@/features/training/logic";
import type { WorkoutRecord } from "@/features/workouts/model";
import styles from "./overview.module.css";

type TodayOverviewProps = { workouts: WorkoutRecord[]; active: boolean; ready?: boolean };

export function TodayOverview({ workouts, active, ready = true }: TodayOverviewProps) {
  const { user, preferences, ready: profileReady } = useProfile();
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [programsReady, setProgramsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void listPrograms()
      .then((saved) => { if (mounted) setPrograms(saved); })
      .catch(() => undefined)
      .finally(() => { if (mounted) setProgramsReady(true); });
    return () => { mounted = false; };
  }, []);

  const enrolled = user?.profile.activeProgram;
  const program = programs.find((saved) => saved.id === enrolled?.programId);
  const schedule = program && enrolled ? programSchedule(program, enrolled) : null;
  const loaded = ready && profileReady && (!enrolled || programsReady);
  const now = new Date();
  const stats = consistency(workouts, now, preferences.weekStart);
  const target = Math.max(1, Math.min(7, program?.daysPerWeek ?? 3));
  const start = weekStartDate(now, preferences.weekStart);
  const completedDays = new Set(workouts
    .filter((workout) => workout.status === "completed" && workout.completedAt && Date.parse(workout.completedAt) <= now.getTime())
    .map((workout) => dateKey(new Date(workout.completedAt!))));
  const weekDays = Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(start);
    day.setDate(day.getDate() + offset);
    return { day, completed: completedDays.has(dateKey(day)), today: dateKey(day) === dateKey(now) };
  });
  const goals = user?.profile.targetGoals ?? [];
  const records = detectRecords(workouts).sort((first, second) => Date.parse(second.date) - Date.parse(first.date)).slice(0, 3);

  return <div className={styles.overview}>
    <section className={styles.week} aria-labelledby="home-week-heading" aria-busy={!loaded}>
      <div className={styles.sectionHeading}>
        <div><h2 id="home-week-heading">Your week</h2><p>{loaded ? `${stats.thisWeek} of ${target} training days` : "Loading your activity…"}</p></div>
        <Link className={styles.textLink} href="/recaps">Recap <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
      <ol className={styles.weekDays} aria-label="This week’s training activity">
        {weekDays.map(({ day, completed, today }) => <li key={dateKey(day)}
          className={`${styles.weekDay} ${loaded && completed ? styles.trainedDay : ""} ${today ? styles.today : ""}`}
          aria-label={`${day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}: ${!loaded ? "loading" : completed ? "workout completed" : day > now ? "upcoming" : "no completed workout"}${today ? ", today" : ""}`}>
          <span aria-hidden="true">{day.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}</span>
          <span className={`${styles.dayMark} ${!loaded ? styles.loadingMark : ""}`} aria-hidden="true">{loaded && completed ? <Check size={18} strokeWidth={2.5} /> : day.getDate()}</span>
        </li>)}
      </ol>
      <div className={styles.weekFooter}>
        <span className={styles.streak}><Flame size={18} aria-hidden="true" /><strong>{loaded ? stats.streak : "—"}</strong> day streak</span>
        <div className={styles.weekProgress}>
          <progress value={loaded ? Math.min(stats.thisWeek, target) : 0} max={target} aria-label="Weekly training goal" />
          <span>{loaded && stats.thisWeek >= target ? "Goal reached" : `${target} days / week`}</span>
        </div>
      </div>
    </section>

    {loaded && schedule && program && <section className={styles.program} aria-labelledby="home-program-heading">
      <div className={styles.sectionHeading}><div className={styles.programLabel}><CalendarDays size={18} aria-hidden="true" /><span>Your program</span></div><span className={styles.weekBadge}>Week {schedule.week} / {schedule.totalWeeks}</span></div>
      <h2 id="home-program-heading">{program.name}</h2>
      {schedule.day ? <>
        <p className={styles.programDay}>{schedule.day.name}<span>{schedule.day.exercises.length} exercises{schedule.deload ? " · Deload week" : ""}</span></p>
        <Link className={styles.programAction} href={active ? "/workout" : `/workout?program=${encodeURIComponent(program.id)}&day=${encodeURIComponent(schedule.day.id)}`}>{active ? "Resume workout" : "Start today’s workout"}<ArrowRight size={18} aria-hidden="true" /></Link>
      </> : <p className={styles.programMessage}>{schedule.finished ? "Program complete. Choose your next plan." : schedule.started ? "Recovery day. Your next session is ready in Programs." : `Your program starts on ${enrolled?.startDate}.`}</p>}
      <Link className={styles.textLink} href={`/programs/${encodeURIComponent(program.id)}`}>View schedule <ArrowRight size={16} aria-hidden="true" /></Link>
    </section>}

    {loaded && goals.length > 0 && <details className={styles.details}>
      <summary><Target size={18} aria-hidden="true" /><span>Active targets</span><small>{goals.length}</small><ChevronDown className={styles.chevron} size={18} aria-hidden="true" /></summary>
      <div className={styles.detailsContent}>
        {goals.slice(0, 3).map((goal) => {
          const progress = goalProgress(goal, user?.profile ?? null, workouts);
          const name = goal.type === "bodyweight" ? "Bodyweight" : exerciseCatalog.find((exercise) => exercise.id === goal.exerciseId)?.name ?? "Lift target";
          return <article className={styles.goal} key={goal.id}>
            <strong>{name}</strong><span>{formatWeight(progress.value, preferences.units)} / {formatWeight(goal.targetValue, preferences.units)}{goal.targetReps ? ` × ${goal.targetReps} reps` : ""}</span>
            <progress value={progress.percent} max={100} aria-label={`${name} target progress`} /><small>Target date: {new Date(`${goal.targetDate}T12:00:00`).toLocaleDateString()}</small>
          </article>;
        })}
        <Link className={styles.textLink} href="/profile/edit#goals">Manage targets <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </details>}

    {loaded && records.length > 0 && <details className={styles.details}>
      <summary><Trophy size={18} aria-hidden="true" /><span>Recent personal records</span><small>{records.length}</small><ChevronDown className={styles.chevron} size={18} aria-hidden="true" /></summary>
      <div className={styles.detailsContent}>
        {records.map((record) => <article className={styles.record} key={record.id}>
          <div><strong>{record.exerciseName}</strong><small>{record.type === "volume" ? "Session volume" : record.type === "1rm" ? "Single rep" : "Estimated 1RM"} · {new Date(record.date).toLocaleDateString()}</small></div>
          <strong>{formatWeight(record.value, preferences.units)}</strong>
        </article>)}
        <Link className={styles.textLink} href="/progress">All records <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </details>}
  </div>;
}
