import { exerciseCatalog } from "../exercises/catalog.ts";
import { getExerciseMuscleTargets } from "../recovery/muscle-groups.ts";

export type WorkingMeasurement = { weight: number; reps: number };
export type ProgressionTarget = {
  previous: WorkingMeasurement;
  repProgression: WorkingMeasurement;
  weightProgression: { weight: number; minReps: number; maxReps: number };
  projectedTopSetVolumeDeltaPercent: number;
};

export function calculateProgressionTarget(exerciseId: string, previousSets: WorkingMeasurement[], muscle?: string): ProgressionTarget | null {
  const best = previousSets.filter((set) => Number.isFinite(set.weight) && set.weight > 0 && Number.isInteger(set.reps) && set.reps >= 5)
    .sort((a, b) => b.weight - a.weight || b.reps - a.reps)[0];
  if (!best) return null;
  const exercise = exerciseCatalog.find((item) => item.id === exerciseId);
  const primary = exercise ? getExerciseMuscleTargets(exercise).primary : muscle ? getExerciseMuscleTargets({ id: exerciseId, muscle, pattern: "", primaryMuscles: [], secondaryMuscles: [] }).primary : null;
  const lowerBody = primary === "quads" || primary === "hamstrings" || primary === "glutes" || primary === "calves";
  const increment = lowerBody ? 5 : 2.5;
  const minReps = Math.max(5, best.reps - 2);
  const maxReps = Math.max(minReps, best.reps - 1);
  const previousVolume = best.weight * best.reps;
  const nextVolume = best.weight * (best.reps + 1);
  return {
    previous: best,
    repProgression: { weight: best.weight, reps: best.reps + 1 },
    weightProgression: { weight: best.weight + increment, minReps, maxReps },
    projectedTopSetVolumeDeltaPercent: previousVolume ? Math.round(((nextVolume - previousVolume) / previousVolume) * 1000) / 10 : 0,
  };
}
