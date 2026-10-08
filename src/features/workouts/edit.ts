import { workoutSchema } from "../import-export/restore-schema.ts";
import { isCardioExercise, MAX_WORKOUT_RECORD_BYTES, type WorkoutRecord } from "./model.ts";

/** Accept seconds, mm:ss, or hh:mm:ss without silently correcting invalid fields. */
export function parseWorkoutDuration(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || !/^\d+(?::\d{1,2}){0,2}$/.test(trimmed)) return null;
  const parts = trimmed.split(":").map(Number);
  if (parts.length > 1 && parts[parts.length - 1] >= 60) return null;
  if (parts.length === 3 && parts[1] >= 60) return null;
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return Number.isSafeInteger(seconds) ? seconds : null;
}

export function formatWorkoutDuration(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = String(total % 60).padStart(2, "0");
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${remaining}`
    : `${String(minutes).padStart(2, "0")}:${remaining}`;
}

/** datetime-local values are interpreted in the user's timezone, never as UTC. */
export function toLocalDateTimeInput(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalDateTimeInput(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const [year, month, day, hour, minute, second] = [yearText, monthText, dayText, hourText, minuteText, secondText ?? "0"].map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(hour, minute, second, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute || date.getSeconds() !== second) return null;
  return date.toISOString();
}

/** Prepare a historical edit without mutating the draft or resetting import/program metadata. */
export function prepareCompletedWorkoutEdit(
  draft: WorkoutRecord,
  timing: { startedAt: string; durationSeconds: number },
  now = new Date().toISOString(),
): WorkoutRecord {
  const start = Date.parse(timing.startedAt);
  if (!Number.isFinite(start) || !workoutSchema.shape.startedAt.safeParse(timing.startedAt).success) throw new Error("Choose a valid workout date and time.");
  if (!Number.isInteger(timing.durationSeconds) || timing.durationSeconds < 1 || timing.durationSeconds > 86400) {
    throw new Error("Workout duration must be between 1 second and 24 hours.");
  }
  if (!Number.isFinite(Date.parse(now)) || !workoutSchema.shape.updatedAt.safeParse(now).success) throw new Error("The save timestamp is invalid.");
  if (!draft.name.trim()) throw new Error("Give your workout a name.");
  if (!draft.exercises.length) throw new Error("Add at least one exercise before saving.");
  if (!draft.exercises.some((exercise) => exercise.sets.some((set) => set.completed))) {
    throw new Error("Complete at least one set before saving.");
  }

  const completedAt = new Date(start + timing.durationSeconds * 1000).toISOString();
  const edited = structuredClone(draft);
  edited.name = edited.name.trim();
  edited.location = edited.location?.trim();
  edited.startedAt = new Date(start).toISOString();
  edited.completedAt = completedAt;
  edited.status = "completed";
  edited.restUntil = null;
  edited.syncStatus = "pending";
  edited.updatedAt = new Date(now).toISOString();

  const exerciseIds = new Set<string>();
  const setIds = new Set<string>();
  for (const exercise of edited.exercises) {
    exercise.name = exercise.name.trim();
    if (!exercise.name) throw new Error("Each exercise needs a name.");
    if (exerciseIds.has(exercise.id)) throw new Error("Exercise entries must have unique IDs.");
    exerciseIds.add(exercise.id);
    for (const [index, set] of exercise.sets.entries()) {
      if (setIds.has(set.id)) throw new Error("Set entries must have unique IDs.");
      setIds.add(set.id);
      set.index = index;
      if (!set.completed) set.completedAt = null;
      else if (!set.completedAt) set.completedAt = completedAt;

      // A timed/distance set can also carry strength values, which remain intact.
      if (set.completed && isCardioExercise(exercise) && !(typeof set.distanceKm === "number" && set.distanceKm > 0) && !(typeof set.durationSeconds === "number" && set.durationSeconds > 0)) {
        throw new Error(`Enter a distance or time for completed sets in ${exercise.name}.`);
      }
      if (set.completed && !isCardioExercise(exercise) && !(typeof set.reps === "number" && set.reps > 0) && !(typeof set.distanceKm === "number" && set.distanceKm > 0) && !(typeof set.durationSeconds === "number" && set.durationSeconds > 0)) {
        throw new Error(`Enter reps, distance, or time for completed sets in ${exercise.name}.`);
      }
    }
  }

  const result = workoutSchema.safeParse(edited);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`${issue.path.join(".") || "Workout"}: ${issue.message}`);
  }
  if (new TextEncoder().encode(JSON.stringify(result.data)).byteLength > MAX_WORKOUT_RECORD_BYTES) {
    throw new Error("This workout is too large to save. Remove an attachment or shorten exercise notes.");
  }
  return result.data as WorkoutRecord;
}
