import type { WorkoutRecord } from "@/features/workouts/model";
import { clearActiveDraft, readActiveDraft, writeActiveDraft } from "@/features/workouts/draft-backup";

/** A readable snapshot for recovery UI. `record` retains every logger field, including RPE, notes and rest time. */
export interface WorkoutDraft {
  id?: string;
  name: string;
  startedAt: number;
  elapsedSeconds: number;
  exercises: Array<{
    id: string;
    name: string;
    sets: Array<{ weight: number | string | null; reps: number | string | null; completed: boolean }>;
  }>;
  lastSavedAt: number;
  record: WorkoutRecord;
}

export function readWorkoutDraft(): WorkoutDraft | null {
  const record = readActiveDraft();
  if (!record) return null;
  const startedAt = Date.parse(record.startedAt);
  return {
    id: record.id,
    name: record.name,
    startedAt,
    elapsedSeconds: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
    exercises: record.exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      sets: exercise.sets.map(({ weight, reps, completed }) => ({ weight, reps, completed })),
    })),
    lastSavedAt: Date.parse(record.updatedAt) || startedAt,
    record,
  };
}

export function writeWorkoutDraft(record: WorkoutRecord): boolean {
  return writeActiveDraft(record);
}

export function clearWorkoutDraft(id: string): void {
  clearActiveDraft(id);
}
