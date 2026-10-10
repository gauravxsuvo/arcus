import type { LoggedSet, WorkoutExercise } from "./model.ts";

export const SWIPE_DELETE_DISTANCE = 75;
export const SWIPE_DELETE_LIMIT = 100;
export const SWIPE_DUPLICATE_DISTANCE = 75;
export const SWIPE_DUPLICATE_LIMIT = 100;

export function shouldDeleteSwipedSet(x: number) {
  return Number.isFinite(x) && x <= -SWIPE_DELETE_DISTANCE;
}

export function shouldDuplicateSwipedSet(x: number) {
  return Number.isFinite(x) && x >= SWIPE_DUPLICATE_DISTANCE;
}

export type RemovedSet = { set: LoggedSet; index: number; beforeId?: string; afterId?: string };

export function removeSetFromExercise(exercise: WorkoutExercise, setId: string): { exercise: WorkoutExercise; removed: RemovedSet | null } {
  const index = exercise.sets.findIndex(set => set.id === setId);
  if (index < 0 || exercise.sets.length < 2) return { exercise, removed: null };
  return {
    exercise: { ...exercise, sets: exercise.sets.filter(set => set.id !== setId).map((set, index) => ({ ...set, index })) },
    removed: { set: { ...exercise.sets[index] }, index, beforeId: exercise.sets[index - 1]?.id, afterId: exercise.sets[index + 1]?.id },
  };
}

/** Restore one set into the current draft, preserving subsequent edits and additions. */
export function restoreRemovedSet(exercise: WorkoutExercise, removed: RemovedSet): WorkoutExercise {
  if (exercise.sets.some(set => set.id === removed.set.id)) return exercise;
  const after = exercise.sets.findIndex(set => set.id === removed.afterId);
  const before = exercise.sets.findIndex(set => set.id === removed.beforeId);
  const index = after >= 0 ? after : before >= 0 ? before + 1 : Math.min(removed.index, exercise.sets.length);
  const sets = [...exercise.sets];
  sets.splice(index, 0, { ...removed.set });
  return { ...exercise, sets: sets.map((set, index) => ({ ...set, index })) };
}
