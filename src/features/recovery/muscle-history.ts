import { exerciseCatalog } from "@/features/exercises/catalog";
import { getExerciseMuscleTargets, MUSCLE_GROUPS, type MuscleActivity, type MuscleGroup } from "@/features/recovery/muscle-groups";

type SetLike = { completed?: unknown; completedAt?: unknown; setType?: unknown };
type ExerciseLike = { exerciseId?: unknown; muscle?: unknown; name?: unknown; sets?: unknown };
type WorkoutLike = { status?: unknown; completedAt?: unknown; exercises?: unknown };

export function aggregateRecentMuscleActivity(payloads: unknown[], now = Date.now()): MuscleActivity[] {
  const totals = new Map<MuscleGroup, { sets: number; last: number }>();
  for (const value of payloads) {
    if (!value || typeof value !== "object") continue;
    const workout = value as WorkoutLike;
    if (workout.status !== "completed" || !Array.isArray(workout.exercises)) continue;
    for (const valueExercise of workout.exercises) {
      if (!valueExercise || typeof valueExercise !== "object") continue;
      const exercise = valueExercise as ExerciseLike;
      const catalog = exerciseCatalog.find((item) => item.id === exercise.exerciseId);
      const muscleLabel = typeof exercise.muscle === "string" ? exercise.muscle : catalog?.muscle ?? "";
      const targets = catalog ? getExerciseMuscleTargets(catalog) : getExerciseMuscleTargets({ id: String(exercise.exerciseId ?? ""), muscle: muscleLabel, pattern: "", primaryMuscles: [], secondaryMuscles: [] });
      if (!Array.isArray(exercise.sets)) continue;
      for (const valueSet of exercise.sets) {
        if (!valueSet || typeof valueSet !== "object") continue;
        const set = valueSet as SetLike;
        if (set.completed !== true || set.setType === "warmup") continue;
        const timestampValue = typeof set.completedAt === "string" ? set.completedAt : workout.completedAt;
        const timestamp = typeof timestampValue === "string" ? Date.parse(timestampValue) : Number.NaN;
        if (!Number.isFinite(timestamp) || timestamp > now || now - timestamp >= 72 * 60 * 60 * 1000) continue;
        const groups = [targets.primary, ...targets.secondary].filter((item): item is MuscleGroup => item !== null);
        for (const muscle of groups) {
          const current = totals.get(muscle) ?? { sets: 0, last: 0 };
          current.sets += 1;
          current.last = Math.max(timestamp, current.last);
          totals.set(muscle, current);
        }
      }
    }
  }
  return MUSCLE_GROUPS.flatMap((muscle) => {
    const entry = totals.get(muscle);
    return entry ? [{ muscle, sets: entry.sets, lastWorkedAt: new Date(entry.last).toISOString() }] : [];
  });
}
