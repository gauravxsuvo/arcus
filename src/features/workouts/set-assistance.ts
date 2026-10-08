import { isCardioExercise, type LoggedSet, type WorkoutExercise, type WorkoutRecord } from "./model.ts";
import { setEntryError } from "./set-validation.ts";

const working = (set: LoggedSet) => !set.setType || set.setType === "working";

/** Copy measurements only; effort and completion always belong to the new set. */
export function measurementCopy(source: LoggedSet, exercise: WorkoutExercise): Partial<LoggedSet> {
  return isCardioExercise(exercise)
    ? { distanceKm: source.distanceKm ?? null, durationSeconds: source.durationSeconds ?? null }
    : { weight: source.weight, reps: source.reps };
}

export function fillNextBlankSet(exercise: WorkoutExercise, completedSetId: string): { exercise: WorkoutExercise; filledId: string | null } {
  const index = exercise.sets.findIndex(set => set.id === completedSetId);
  const source = exercise.sets[index];
  const next = exercise.sets[index + 1];
  if (!source?.completed || !next || !working(source) || !working(next) || next.completed || setEntryError(source, exercise)) return { exercise, filledId: null };
  const blank = isCardioExercise(exercise)
    ? next.distanceKm == null && next.durationSeconds == null
    : next.weight == null && next.reps == null;
  if (!blank) return { exercise, filledId: null };
  return { exercise: { ...exercise, sets: exercise.sets.map(set => set.id === next.id ? { ...set, ...measurementCopy(source, exercise) } : set) }, filledId: next.id };
}

export function lastWorkingMeasurements(exercise: WorkoutExercise): Partial<LoggedSet> {
  const source = [...exercise.sets].reverse().find(set => set.completed && working(set) && !setEntryError(set, exercise));
  return source ? measurementCopy(source, exercise) : {};
}

/** Latest valid session by date, independent of import order; warm-ups match warm-ups. */
export function previousExercises(history: WorkoutRecord[]) {
  const result = new Map<string, WorkoutExercise>();
  const sessions = history.filter(workout => workout.status === "completed" && workout.completedAt && Number.isFinite(Date.parse(workout.completedAt)))
    .sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!));
  for (const workout of sessions) for (const exercise of workout.exercises) {
    if (!result.has(exercise.exerciseId) && exercise.sets.some(set => set.completed && !setEntryError(set, exercise))) result.set(exercise.exerciseId, exercise);
  }
  return result;
}

export function previousMatchingSet(current: WorkoutExercise, setId: string, previous?: WorkoutExercise): LoggedSet | null {
  if (!previous || isCardioExercise(current) !== isCardioExercise(previous)) return null;
  const target = current.sets.find(set => set.id === setId);
  if (!target) return null;
  const type = target.setType ?? "working";
  const ordinal = current.sets.filter(set => (set.setType ?? "working") === type).findIndex(set => set.id === setId);
  return previous.sets.filter(set => set.completed && (set.setType ?? "working") === type && !setEntryError(set, previous))[ordinal] ?? null;
}
