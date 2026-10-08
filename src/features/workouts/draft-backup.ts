import { workoutSchema } from "../import-export/restore-schema.ts";
import { MAX_WORKOUT_RECORD_BYTES, type WorkoutRecord } from "./model.ts";

export const ACTIVE_DRAFT_KEY = "arcus-active-workout-v1";
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): DraftStorage | undefined {
  try { return typeof window === "undefined" ? undefined : window.localStorage; }
  catch { return undefined; }
}

export function readActiveDraft(storage = browserStorage()): WorkoutRecord | null {
  try {
    const text = storage?.getItem(ACTIVE_DRAFT_KEY);
    if (!text || text.length > MAX_WORKOUT_RECORD_BYTES + 100) return null;
    const snapshot = JSON.parse(text);
    if (snapshot.version !== 1) return null;
    const result = workoutSchema.safeParse(snapshot.workout);
    return result.success && result.data.status === "active" ? result.data as WorkoutRecord : null;
  } catch { return null; }
}

export function writeActiveDraft(workout: WorkoutRecord, storage = browserStorage()): boolean {
  try {
    if (!storage || workout.status !== "active") return false;
    const text = JSON.stringify({ version: 1, workout });
    if (new TextEncoder().encode(text).length > MAX_WORKOUT_RECORD_BYTES + 100) return false;
    storage.setItem(ACTIVE_DRAFT_KEY, text);
    return true;
  } catch { return false; } // IndexedDB remains available if localStorage is full.
}

export function clearActiveDraft(id: string, storage = browserStorage()): void {
  try { if (readActiveDraft(storage)?.id === id) storage?.removeItem(ACTIVE_DRAFT_KEY); }
  catch { /* Optional emergency storage must not break a committed operation. */ }
}

export function selectActiveDraft(active: WorkoutRecord | null, backup: WorkoutRecord | null, persistedBackup: WorkoutRecord | null): WorkoutRecord | null {
  if (!backup || persistedBackup?.status === "completed") return active;
  if (persistedBackup && Date.parse(persistedBackup.updatedAt) > Date.parse(backup.updatedAt)) return active;
  if (active && Date.parse(active.updatedAt) > Date.parse(backup.updatedAt)) return active;
  return backup;
}
