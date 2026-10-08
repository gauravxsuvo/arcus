import type { Exercise } from "@/features/exercises/catalog";
import { createWorkout, type LoggedSet, type WorkoutExercise, type WorkoutRecord } from "./model";

export function workoutToTransferText(workout: WorkoutRecord) {
  const date = new Date(workout.completedAt ?? workout.startedAt).toLocaleDateString();
  const lines = [`ARCUS WORKOUT`, `Name: ${workout.name || "Workout"}`, `Date: ${date}`, ""];
  for (const exercise of workout.exercises) {
    lines.push(exercise.name);
    for (const set of exercise.sets.filter((item) => item.completed || item.weight !== null || item.reps !== null)) {
      const weight = set.weight === null ? "bodyweight" : `${set.weight} kg`;
      const reps = set.reps === null ? "?" : `${set.reps} reps`;
      const rpe = set.rpe === null ? "" : ` @ RPE ${set.rpe}`;
      lines.push(`Set ${set.index + 1}: ${weight} x ${reps}${rpe}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function workoutToTransferJson(workout: WorkoutRecord) {
  return JSON.stringify({ arcus: 1, workout }, null, 2);
}

function makeSet(index: number, weight: number | null, reps: number | null, rpe: number | null): LoggedSet {
  return { id: crypto.randomUUID(), index, weight, reps, rpe, completed: true, completedAt: new Date().toISOString() };
}

export function parseWorkoutTransfer(input: string, catalog: Exercise[] = []): WorkoutRecord {
  const raw = input.trim();
  try {
    const parsed = JSON.parse(raw) as { workout?: WorkoutRecord } | WorkoutRecord;
    const source = "workout" in parsed && parsed.workout ? parsed.workout : parsed;
    if (source && "exercises" in source && Array.isArray(source.exercises)) {
      const workout = createWorkout();
      return { ...workout, ...source, id: crypto.randomUUID(), status: "active", completedAt: null, restUntil: null, syncStatus: "pending", updatedAt: new Date().toISOString() };
    }
  } catch { /* Try the readable text format below. */ }

  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const title = lines.find((line) => /^name\s*:/i.test(line))?.replace(/^name\s*:\s*/i, "").trim() || "Imported workout";
  const workout = createWorkout();
  const exercises: WorkoutExercise[] = [];
  let current: WorkoutExercise | null = null;
  for (const line of lines) {
    if (/^(arcus workout|name\s*:|date\s*:|workout\s*[-:])/i.test(line)) continue;
    const setMatch = line.match(/^(?:set\s*)?\d+\s*[:.)-]?\s*(?:(\d+(?:\.\d+)?)\s*kg|bodyweight|bw)?\s*(?:x|×|for)\s*(\d+)\s*(?:reps?)?(?:\s*@\s*(?:rpe\s*)?(\d+(?:\.\d+)?))?/i);
    if (setMatch && current) {
      const index = current.sets.length;
      current.sets.push(makeSet(index, setMatch[1] ? Number(setMatch[1]) : null, Number(setMatch[2]), setMatch[3] ? Number(setMatch[3]) : null));
      continue;
    }
    const catalogMatch = catalog.find((item) => item.name.toLowerCase() === line.toLowerCase());
    current = { id: crypto.randomUUID(), exerciseId: catalogMatch?.id ?? `imported-${crypto.randomUUID()}`, name: line.replace(/\s*\(.*\)$/, ""), muscle: catalogMatch?.muscle ?? "Imported", equipment: catalogMatch?.equipment ?? "Unknown", restSeconds: catalogMatch?.restSeconds ?? 90, sets: [] };
    exercises.push(current);
  }
  if (!exercises.length || exercises.every((exercise) => !exercise.sets.length)) throw new Error("No exercises and sets were found. Paste an ARCUS export or a HEVY-style text workout.");
  return { ...workout, name: title, exercises, notes: "Imported from workout text", updatedAt: new Date().toISOString() };
}
