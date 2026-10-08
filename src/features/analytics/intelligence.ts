import { calculateWorkoutTotals, type WorkoutRecord } from "@/features/workouts/model";
import { estimateOneRepMax, getCompletedSets } from "./engine";

export type Readiness = "low" | "steady" | "ready";

export function getReadinessScore(workouts: WorkoutRecord[], energy: number | null = null) {
  const recent = workouts.filter((workout) => Date.parse(workout.completedAt ?? "") >= Date.now() - 14 * 86400000);
  const frequency = Math.min(40, recent.length * 10);
  const consistency = recent.length >= 2 ? 30 : recent.length === 1 ? 18 : 0;
  const latest = recent[0];
  const effort = latest ? Math.min(20, Math.round(calculateWorkoutTotals(latest).sets / 2)) : 0;
  const checkIn = energy === null ? 0 : Math.min(10, Math.max(0, energy));
  return Math.min(100, frequency + consistency + effort + checkIn);
}

export function getReadinessLabel(score: number): Readiness {
  return score >= 70 ? "ready" : score >= 40 ? "steady" : "low";
}

export function findPlateauSignals(workouts: WorkoutRecord[]) {
  const byExercise = new Map<string, { name: string; estimates: number[] }>();
  for (const workout of workouts.slice(0, 8)) {
    for (const exercise of workout.exercises) {
      const estimates = getCompletedSets(exercise).map((set) => estimateOneRepMax(set.weight ?? 0, set.reps ?? 0)).filter(Boolean);
      if (!estimates.length) continue;
      const current = byExercise.get(exercise.exerciseId) ?? { name: exercise.name, estimates: [] };
      current.estimates.push(Math.max(...estimates));
      byExercise.set(exercise.exerciseId, current);
    }
  }
  return [...byExercise.values()].map((item) => {
    const first = item.estimates[item.estimates.length - 1] ?? 0;
    const latest = item.estimates[0] ?? 0;
    const change = first ? Math.round((latest - first) / first * 100) : 0;
    return { ...item, change, plateau: item.estimates.length >= 3 && Math.abs(change) < 2 };
  }).filter((item) => item.plateau).slice(0, 3);
}
