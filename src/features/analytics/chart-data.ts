import { estimateOneRepMax, getCompletedSets, type OneRepMaxMethod } from "./engine.ts";
import type { WorkoutRecord } from "../workouts/model.ts";

export type StrengthMetric = "estimated_1rm" | "top_weight";
export type ExerciseTrendPoint = { id: string; date: string; name: string; value: number };

export function strengthExerciseOptions(workouts: WorkoutRecord[]) {
  const options = new Map<string, string>();
  for (const workout of workouts) {
    if (workout.status !== "completed" || !workout.completedAt || !Number.isFinite(Date.parse(workout.completedAt))) continue;
    for (const exercise of workout.exercises) {
      if (getCompletedSets(exercise).some(set => Number.isFinite(set.weight) && Number.isInteger(set.reps))) {
        if (!options.has(exercise.exerciseId)) options.set(exercise.exerciseId, exercise.name);
      }
    }
  }
  return [...options].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

/** One best working set per completed session, in time order; storage stays in kg. */
export function buildExerciseTrend(workouts: WorkoutRecord[], exerciseId: string, metric: StrengthMetric = "estimated_1rm", method: OneRepMaxMethod = "epley", limit = 30): ExerciseTrendPoint[] {
  const points: ExerciseTrendPoint[] = [];
  for (const workout of workouts) {
    if (workout.status !== "completed" || !workout.completedAt || !Number.isFinite(Date.parse(workout.completedAt))) continue;
    let best = 0;
    for (const exercise of workout.exercises.filter(item => item.exerciseId === exerciseId)) {
      for (const set of getCompletedSets(exercise)) {
        if (!Number.isFinite(set.weight) || !Number.isInteger(set.reps)) continue;
        const value = metric === "top_weight" ? set.weight! : estimateOneRepMax(set.weight!, set.reps!, method);
        best = Math.max(best, value);
      }
    }
    if (best > 0) points.push({ id: workout.id, date: workout.completedAt, name: workout.name, value: best });
  }
  return points.sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || a.id.localeCompare(b.id)).slice(-Math.max(1, Math.min(100, Math.trunc(limit) || 30)));
}
