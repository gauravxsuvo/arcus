import { Flame, Target, Trophy } from "lucide-react";
import { calculateStreaks, type DayActivity } from "@/features/training/activity";
import { formatWeight } from "@/features/training/logic";
import type { Units } from "@/features/profile/model";
import styles from "./workout-heatmap.module.css";

export function StreakBadge({ activities, year, units, now = new Date() }: { activities: DayActivity[]; year: number; units: Units; now?: Date }) {
  const summary = calculateStreaks(activities, now);
  const consistency = Math.round(summary.activeWeeks / summary.elapsedWeeks * 100);
  return <div className={styles.stats} aria-label="Workout consistency summary">
    <article><span className={styles.statIcon}><Flame size={16}/></span><strong>{summary.currentWeeklyStreak} {summary.currentWeeklyStreak === 1 ? "week" : "weeks"}</strong><small>Current streak</small><p>{summary.currentWeeklyStreak ? "Keep the momentum alive" : "Log a workout to begin"}</p></article>
    <article><span className={styles.statIcon}><Trophy size={16}/></span><strong>{summary.totalWorkouts}</strong><small>Workouts in {year}</small><p>{formatWeight(summary.totalVolume, units, 0)} total volume</p></article>
    <article><span className={styles.statIcon}><Target size={16}/></span><strong>{consistency}%</strong><small>Active weeks</small><p>{summary.activeWeeks} of {summary.elapsedWeeks} weeks this year</p></article>
  </div>;
}
