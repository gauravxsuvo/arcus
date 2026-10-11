import { calculateWorkoutTotals, isCardioExercise, type WorkoutRecord } from "../workouts/model.ts";
import { calculateOneRepMax } from "../../lib/fitness-calc.ts";

export type DayActivity = {
  date: string;
  count: number;
  totalVolume: number;
  titles: string[];
  isPersonalRecord?: boolean;
  workoutIds?: string[];
};

export type ActivitySummary = {
  currentWeeklyStreak: number;
  totalWorkouts: number;
  totalVolume: number;
  activeWeeks: number;
  elapsedWeeks: number;
};

export function activityDateKey(isoDate: string): string {
  return isoDate.slice(0, 10);
}

function utcWeekStart(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

/** Fallback and offline aggregation from this user's actual locally saved sessions. */
export function buildWorkoutActivity(workouts: WorkoutRecord[], year: number): DayActivity[] {
  const days = new Map<string, DayActivity>();
  const records = new Map<string, number>();
  const recordDays = new Set<string>();
  const sorted = [...workouts]
    .filter((workout) => workout.status === "completed" && workout.completedAt && new Date(workout.completedAt).getUTCFullYear() <= year && Date.parse(workout.completedAt) <= Date.now())
    .sort((a, b) => a.completedAt!.localeCompare(b.completedAt!));

  for (const workout of sorted) {
    const date = activityDateKey(workout.completedAt!);
    const belongsToYear = new Date(workout.completedAt!).getUTCFullYear() === year;
    if (belongsToYear) {
      const day = days.get(date) ?? { date, count: 0, totalVolume: 0, titles: [], workoutIds: [] };
      day.count += 1;
      day.totalVolume += calculateWorkoutTotals(workout).volume;
      day.workoutIds?.push(workout.id);
      if (!day.titles.includes(workout.name || "Workout")) day.titles.push(workout.name || "Workout");
      days.set(date, day);
    }

    for (const exercise of workout.exercises) {
      if (isCardioExercise(exercise)) continue;
      const key = exercise.exerciseId || exercise.name;
      for (const set of exercise.sets) {
        if (!set.completed || set.setType === "warmup" || set.weight == null || set.reps == null) continue;
        const score = calculateOneRepMax(set.weight, set.reps);
        if (score !== null && score > (records.get(key) ?? 0)) {
          records.set(key, score);
          if (belongsToYear) recordDays.add(date);
        }
      }
    }
  }
  for (const date of recordDays) {
    const day = days.get(date);
    if (day) day.isPersonalRecord = true;
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Merge this device's completed sessions that have not arrived in the account database yet. */
export function mergeLocalWorkoutActivity(remote: DayActivity[], workouts: WorkoutRecord[], year: number): DayActivity[] {
  const knownIds = new Set(remote.flatMap((day) => day.workoutIds ?? []));
  const pending = workouts.filter((workout) => !knownIds.has(workout.id));
  const local = buildWorkoutActivity(pending, year);
  const merged = new Map(remote.map((day) => [day.date, { ...day, titles: [...day.titles], workoutIds: [...(day.workoutIds ?? [])] }]));
  for (const day of local) {
    const target = merged.get(day.date) ?? { date: day.date, count: 0, totalVolume: 0, titles: [], workoutIds: [] };
    target.count += day.count;
    target.totalVolume += day.totalVolume;
    target.workoutIds?.push(...(day.workoutIds ?? []));
    for (const title of day.titles) if (!target.titles.includes(title)) target.titles.push(title);
    merged.set(day.date, target);
  }
  return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function calculateStreaks(days: DayActivity[], now = new Date()): ActivitySummary {
  const workoutsByWeek = new Map<string, number>();
  const currentYear = now.getUTCFullYear();
  const today = now.toISOString().slice(0, 10);
  const annualDays = days.filter((day) => Number(day.date.slice(0, 4)) === currentYear && day.date <= today);
  for (const day of annualDays) {
    if (day.count > 0) workoutsByWeek.set(utcWeekStart(day.date), (workoutsByWeek.get(utcWeekStart(day.date)) ?? 0) + day.count);
  }

  const currentWeek = utcWeekStart(now.toISOString().slice(0, 10));
  let weekCursor = currentWeek;
  let currentWeeklyStreak = 0;
  if (!workoutsByWeek.has(weekCursor)) {
    const previous = new Date(`${weekCursor}T00:00:00.000Z`);
    previous.setUTCDate(previous.getUTCDate() - 7);
    weekCursor = previous.toISOString().slice(0, 10);
  }
  while (workoutsByWeek.has(weekCursor)) {
    currentWeeklyStreak += 1;
    const previous = new Date(`${weekCursor}T00:00:00.000Z`);
    previous.setUTCDate(previous.getUTCDate() - 7);
    weekCursor = previous.toISOString().slice(0, 10);
  }

  const firstWeek = utcWeekStart(`${currentYear}-01-01`);
  const elapsedWeeks = Math.floor((Date.parse(`${currentWeek}T00:00:00Z`) - Date.parse(`${firstWeek}T00:00:00Z`)) / (7 * 86400000)) + 1;
  return {
    currentWeeklyStreak,
    totalWorkouts: annualDays.reduce((sum, day) => sum + day.count, 0),
    totalVolume: annualDays.reduce((sum, day) => sum + day.totalVolume, 0),
    activeWeeks: workoutsByWeek.size,
    elapsedWeeks: Math.max(1, elapsedWeeks),
  };
}
