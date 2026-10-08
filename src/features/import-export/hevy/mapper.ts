import type { Exercise } from "../../exercises/catalog.ts";
import { normalizeExerciseName, normalizeLabel } from "./normalizer.ts";
import type { ExerciseMatch } from "./types.ts";

const aliases: Record<string, string[]> = {
  date: ["date", "workout_date", "start_time", "start date", "workout date"],
  workoutName: ["workout_name", "workout", "workout title", "routine name"],
  duration: ["duration", "workout_duration", "duration_sec", "workout duration"],
  exerciseName: ["exercise_name", "exercise", "exercise title"],
  setIndex: ["set_order", "set_index", "set", "set number"],
  weight: ["weight", "weight_kg", "weight_lb", "weight_lbs", "load"],
  reps: ["reps", "repetitions", "rep_count"],
  distance: ["distance", "distance_km", "distance_miles"],
  seconds: ["seconds", "duration_sec", "time_seconds"],
  notes: ["notes", "set_notes", "exercise_notes"],
  workoutNotes: ["workout_notes", "session_notes"],
  rpe: ["rpe", "rir"],
};

export function findColumn(headers: string[], field: keyof typeof aliases) {
  const normalized = new Map(headers.map((header) => [normalizeLabel(header), header]));
  return aliases[field].map(normalizeLabel).map((key) => normalized.get(key)).find(Boolean);
}

export function detectFormat(headers: string[]): "hevy" | "strong" | "generic" {
  const keys = new Set(headers.map(normalizeLabel));
  if (keys.has("workout_name") && keys.has("exercise_name") && keys.has("set_order")) return "strong";
  if (keys.has("exercise_name") && (keys.has("start_time") || keys.has("workout_date"))) return "hevy";
  return "generic";
}

export function matchExercise(sourceName: string, catalog: Exercise[]): ExerciseMatch {
  const normalized = normalizeExerciseName(sourceName);
  const exact = catalog.filter((item) => normalizeExerciseName(item.name) === normalized);
  if (exact.length === 1) return { sourceName, status: "matched", exercise: exact[0], candidates: exact };
  const alias = catalog.filter((item) => item.aliases.some((value) => normalizeExerciseName(value) === normalized));
  if (alias.length === 1) return { sourceName, status: "matched", exercise: alias[0], candidates: alias };
  const candidates = catalog.filter((item) => normalizeExerciseName(item.name).includes(normalized) || normalized.includes(normalizeExerciseName(item.name))).slice(0, 5);
  return { sourceName, status: candidates.length ? "ambiguous" : "unknown", candidates };
}
