import { calculateWorkoutTotals, isCardioExercise, type WorkoutExercise, type WorkoutRecord } from "../workouts/model.ts";

export type OneRepMaxMethod = "epley" | "brzycki";

export function estimateOneRepMax(weight: number, reps: number, method: OneRepMaxMethod = "epley"): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps < 1) return 0;
  if (reps === 1) return weight;
  if (reps > 12) return 0;
  if (method === "brzycki") return weight * (36 / (37 - reps));
  return weight * (1 + reps / 30);
}

export function getCompletedSets(exercise: WorkoutExercise) {
  if (isCardioExercise(exercise)) return [];
  return exercise.sets.filter((set) => set.completed && set.setType !== "warmup" && (set.weight ?? 0) > 0 && (set.reps ?? 0) > 0);
}

export function calculateEstimatedBest(workouts: WorkoutRecord[], exerciseId: string) {
  return workouts.flatMap((workout) => workout.exercises
    .filter((exercise) => exercise.exerciseId === exerciseId)
    .flatMap((exercise) => getCompletedSets(exercise).map((set) => estimateOneRepMax(set.weight ?? 0, set.reps ?? 0))))
    .reduce((best, estimate) => Math.max(best, estimate), 0);
}

export function buildWeeklyVolume(workouts: WorkoutRecord[], count = 12, now = new Date(), weekStart:"monday"|"sunday"="monday") {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const offset=weekStart==="monday"?6:0;
  start.setDate(start.getDate() - ((start.getDay() + offset) % 7));
  start.setDate(start.getDate() - (count - 1) * 7);
  const weeks = Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index * 7);
    return { start: date, label: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date), volume: 0, sessions: 0 };
  });
  for (const workout of workouts) {
    const completedAt = workout.completedAt;
    if (!completedAt) continue;
    const date = new Date(completedAt);
    const monday = new Date(date);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + offset) % 7));
    const week = weeks.find((item) => item.start.getTime() === monday.getTime());
    if (week) {
      const totals = calculateWorkoutTotals(workout);
      week.volume += totals.volume;
      week.sessions += 1;
    }
  }
  return weeks;
}

export function calculateMuscleVolume(workouts: WorkoutRecord[]) {
  const totals = new Map<string, number>();
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const volume = getCompletedSets(exercise).reduce((sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0), 0);
      if (volume > 0) totals.set(exercise.muscle, (totals.get(exercise.muscle) ?? 0) + volume);
    }
  }
  return [...totals.entries()].map(([muscle, volume]) => ({ muscle, volume })).sort((a, b) => b.volume - a.volume);
}

export function findPersonalRecords(workouts: WorkoutRecord[], method: OneRepMaxMethod = "epley") {
  const sorted = [...workouts].sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? ""));
  const best = new Map<string, { weight: number; reps: number; oneRepMax: number; workoutId: string; workoutDate: string }>();
  const records: { exerciseId: string; exerciseName: string; weight: number; reps: number; estimatedOneRepMax: number; workoutId: string; workoutDate: string }[] = [];
  for (const workout of sorted) {
    for (const exercise of workout.exercises) {
      const prior = best.get(exercise.exerciseId) ?? { weight: 0, reps: 0, oneRepMax: 0, workoutId: "", workoutDate: "" };
      for (const set of getCompletedSets(exercise)) {
        const weight = set.weight ?? 0;
        const reps = set.reps ?? 0;
        const estimate = estimateOneRepMax(weight, reps, method);
        if (estimate > prior.oneRepMax) {
          records.push({ exerciseId: exercise.exerciseId, exerciseName: exercise.name, weight, reps, estimatedOneRepMax: estimate, workoutId: workout.id, workoutDate: workout.completedAt ?? workout.startedAt });
          prior.oneRepMax = estimate;
        }
        if (weight > prior.weight || (weight === prior.weight && reps > prior.reps)) {
          prior.weight = weight;
          prior.reps = reps;
        }
        prior.workoutId = workout.id;
        prior.workoutDate = workout.completedAt ?? workout.startedAt;
      }
      best.set(exercise.exerciseId, prior);
    }
  }
  return records.sort((a, b) => b.workoutDate.localeCompare(a.workoutDate));
}

export function recommendNextLoad(exercise: WorkoutExercise, targetRepMax = exercise.targetRepMax ?? 12, increment = 2.5) {
  const sets = getCompletedSets(exercise);
  if (!sets.length) return { load: null, reason: "Complete a working set to get a load suggestion." };
  const topLoad = Math.max(...sets.map((set) => set.weight ?? 0));
  if (exercise.targetProgressionMethod === "manual") return { load: null, reason: "This program uses manual load changes." };
  if (exercise.targetProgressionMethod === "percentage") return { load: null, reason: `Use ${exercise.targetProgressionValue ?? 80}% of your training max, then adjust by feel.` };
  if (exercise.targetProgressionMethod === "rpe") {
    const targetRpe = exercise.targetProgressionValue ?? 8;
    const rpeSets = sets.filter((set) => set.rpe !== null);
    const averageRpe = rpeSets.reduce((sum, set) => sum + (set.rpe ?? 0), 0) / Math.max(1, rpeSets.length);
    if (sets.every((set) => (set.reps ?? 0) >= targetRepMax) && averageRpe > 0 && averageRpe <= targetRpe) {
      const next = Math.ceil((topLoad + increment) / increment) * increment;
      return { load: next, reason: `All sets reached ${targetRepMax} reps at RPE ${averageRpe.toFixed(1)} or lower. Try ${increment} kg more.` };
    }
    return { load: topLoad, reason: `Keep ${topLoad} kg and aim for the rep target near RPE ${targetRpe}.` };
  }
  if (sets.every((set) => (set.reps ?? 0) >= targetRepMax)) {
    const next = Math.ceil((topLoad + increment) / increment) * increment;
    return { load: next, reason: `All logged sets reached ${targetRepMax} reps. Try the next ${increment} kg increment.` };
  }
  return { load: topLoad, reason: `Keep ${topLoad} kg and build reps toward ${targetRepMax} before adding load.` };
}
