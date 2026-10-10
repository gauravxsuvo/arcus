import { isCardioExercise, type WorkoutRecord } from "../workouts/model.ts";

export type MuscleRecoveryStatus = "untrained" | "recovering" | "ready";
export type MuscleRecovery = {
  muscle: string;
  status: MuscleRecoveryStatus;
  lastTrainedAt: string | null;
  hoursSinceTraining: number | null;
  workingSetsLast7Days: number;
};

/**
 * A simple recency guide, not a physiological recovery measurement. ARCUS has
 * no sensor data, so the status is based only on logged working sets and time.
 */
export function muscleRecovery(
  workouts: WorkoutRecord[],
  now = new Date(),
  recoveryHours = 48,
): MuscleRecovery[] {
  const muscles = new Map<string, { lastTrainedAt: number; sets: number }>();
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;

  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const muscle = exercise.muscle.trim();
      if (!muscle || isCardioExercise(exercise)) continue;
      const completedSets = exercise.sets.filter((set) => set.completed && set.setType !== "warmup");
      if (!completedSets.length) continue;
      const times = completedSets
        .map((set) => Date.parse(set.completedAt ?? workout.completedAt ?? workout.startedAt))
        .filter((time) => Number.isFinite(time) && time <= now.getTime());
      if (!times.length) continue;

      const latest = Math.max(...times);
      const current = muscles.get(muscle) ?? { lastTrainedAt: 0, sets: 0 };
      current.lastTrainedAt = Math.max(current.lastTrainedAt, latest);
      current.sets += times.filter((time) => time >= weekAgo && time <= now.getTime()).length;
      muscles.set(muscle, current);
    }
  }

  return [...muscles.entries()]
    .map(([muscle, item]) => {
      const hours = Math.max(0, (now.getTime() - item.lastTrainedAt) / 3_600_000);
      return {
        muscle,
        lastTrainedAt: new Date(item.lastTrainedAt).toISOString(),
        hoursSinceTraining: Math.round(hours),
        workingSetsLast7Days: item.sets,
        status: hours < recoveryHours ? "recovering" as const : "ready" as const,
      };
    })
    .sort((a, b) => (a.status === b.status ? a.muscle.localeCompare(b.muscle) : a.status === "recovering" ? -1 : 1));
}
