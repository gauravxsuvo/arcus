import { forwardRef } from "react";
import Image from "next/image";
import { Award, Dumbbell } from "lucide-react";
import { calculateWorkoutTotals, type WorkoutRecord } from "@/features/workouts/model";
import { formatWeight } from "@/features/training/logic";
import type { Units } from "@/features/profile/model";
import { ArcusMark } from "@/components/shared/arcus-mark";
import styles from "./workout-share.module.css";

type StoryIdentity = { name: string; handle: string; avatarUrl: string | null };

function storyDate(value: string) {
  const parts = new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "short" }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("weekday")} · ${part("day")} ${part("month")}`.toUpperCase();
}

function durationLabel(seconds: number) {
  const mins = Math.max(1, Math.round(seconds / 60));
  return `${mins} ${mins === 1 ? "min" : "mins"} of work`;
}

function strongestExercises(workout: WorkoutRecord, units: Units) {
  return workout.exercises
    .map((exercise) => {
      const sets = exercise.sets.filter((set) => set.completed && set.setType !== "warmup");
      const heaviest = sets.reduce<(typeof sets)[number] | null>((best, set) => !best || (set.weight ?? 0) > (best.weight ?? 0) ? set : best, null);
      return { exercise, sets, heaviest, score: heaviest?.weight ?? 0 };
    })
    .filter(({ sets }) => sets.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ exercise, sets, heaviest }) => ({
      name: exercise.name,
      setCount: sets.length,
      display: heaviest ? `${heaviest.weight === null ? "Bodyweight" : formatWeight(heaviest.weight, units)}${heaviest.reps ? ` × ${heaviest.reps}` : ""}` : "Completed",
    }));
}

type WorkoutStoryCardProps = {
  workout: WorkoutRecord;
  units: Units;
  identity: StoryIdentity;
  records: number;
  className?: string;
};

export const WorkoutStoryCard = forwardRef<HTMLElement, WorkoutStoryCardProps>(function WorkoutStoryCard({ workout, units, identity, records, className }, ref) {
  const totals = calculateWorkoutTotals(workout);
  const lifts = strongestExercises(workout, units);
  const date = storyDate(workout.completedAt ?? workout.startedAt);
  const initials = identity.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "A";

  return <article ref={ref} className={`${styles.storyCard} ${className ?? ""}`} aria-label={`${workout.name} workout story`}>
    <header className={styles.storyHeader}>
      <div className={styles.brand}><ArcusMark size={28}/><span>ARCUS<span>.</span></span></div>
      <span className={styles.datePill}>{date}</span>
    </header>
    <section className={styles.storyHero}>
      <p className={styles.kicker}>SESSION LOGGED</p>
      <h2>{workout.name.trim() || "Workout"}</h2>
      <p className={styles.duration}>{durationLabel(totals.durationSeconds)}</p>
      <div className={styles.heroRule}><span/></div>
    </section>
    <section className={styles.metrics} aria-label="Workout highlights">
      <div className={styles.metric}><span>Total volume</span><strong>{formatWeight(totals.volume, units, 0)}</strong></div>
      <div className={styles.metric}><span>Work sets</span><strong>{totals.sets} <small>{totals.sets === 1 ? "set" : "sets"}</small></strong></div>
      <div className={`${styles.metric} ${styles.recordMetric}`}><span>Personal records</span><strong><Award size={19} aria-hidden="true"/>{records} <small>PRs</small></strong></div>
    </section>
    <section className={styles.liftSection}>
      <div className={styles.sectionTitle}><Dumbbell size={17} aria-hidden="true"/><h3>Session highlights</h3></div>
      {lifts.length ? <ul>{lifts.map((lift) => <li key={lift.name}><span><strong>{lift.name}</strong><small>{lift.setCount} {lift.setCount === 1 ? "set" : "sets"} completed</small></span><b>{lift.display}</b></li>)}</ul> : <p className={styles.noLifts}>A session is still a session. Keep showing up.</p>}
    </section>
    <footer className={styles.storyFooter}>
      <div className={styles.identity}>
        <span className={styles.avatar} aria-hidden="true">{identity.avatarUrl && <Image src={identity.avatarUrl} crossOrigin="anonymous" alt="" width={43} height={43} unoptimized onError={(event) => { event.currentTarget.style.display = "none"; }} />}{initials}</span>
        <span><strong>{identity.name}</strong><small>@{identity.handle}</small></span>
      </div>
      <div className={styles.watermark}><span>LOGGED ON ARCUS</span><strong>thearcus.vercel.app</strong></div>
    </footer>
  </article>;
});
