import type { Exercise } from "../exercises/catalog";
import type { WorkoutRecord } from "../workouts/model";
import { normalizeExerciseName } from "./hevy/normalizer.ts";
import type { ConfirmedImport, HevyAnalysis } from "./hevy/types.ts";

function makeBatchId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `IMP-${stamp}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

export function buildImportedWorkouts(analysis: HevyAnalysis, catalog: Exercise[], unitOverride: "kg" | "lb" = "kg", existing: WorkoutRecord[] = [], mapping: Record<string, string> = {}): ConfirmedImport {
  const batchId = makeBatchId();
  const groups = new Map<string, WorkoutRecord>();
  for (const row of analysis.rows) {
    const groupKey = `${row.workoutName}|${row.startedAt.slice(0, 16)}`;
    let workout = groups.get(groupKey);
    if (!workout) {
      const completedAt = row.durationSeconds === null ? row.startedAt : new Date(Date.parse(row.startedAt) + row.durationSeconds * 1000).toISOString();
      workout = { id: crypto.randomUUID(), name: row.workoutName, startedAt: row.startedAt, completedAt, status: "completed", exercises: [], notes: row.workoutNotes, restUntil: null, syncStatus: "pending", updatedAt: new Date().toISOString(), importSource: analysis.format === "generic" ? "generic" : "hevy", importBatchId: batchId, sourceFingerprint: `${analysis.fileHash}:${groupKey}` };
      groups.set(groupKey, workout);
    }
    const match = analysis.matches.find((item) => normalizeExerciseName(item.sourceName) === normalizeExerciseName(row.exerciseName));
    const mapped = mapping[row.exerciseName] && mapping[row.exerciseName] !== "custom" ? catalog.find((item) => item.id === mapping[row.exerciseName]) : undefined;
    const exercise = mapped ?? match?.exercise ?? catalog.find((item) => normalizeExerciseName(item.name) === normalizeExerciseName(row.exerciseName));
    let target = workout.exercises.find((item) => item.exerciseId === exercise?.id || item.name === row.exerciseName);
    if (!target) {
      target = { id: crypto.randomUUID(), exerciseId: exercise?.id ?? `imported-${normalizeExerciseName(row.exerciseName).replaceAll(" ", "-")}`, name: exercise?.name ?? row.exerciseName, muscle: exercise?.muscle ?? "Imported", equipment: exercise?.equipment ?? "Unknown", restSeconds: exercise?.restSeconds ?? 90, sets: [] };
      workout.exercises.push(target);
    }
    const weight = row.weight === null ? null : (row.unit === "lb" || (row.unit === "unknown" && unitOverride === "lb") ? Number((row.weight * 0.45359237).toFixed(3)) : row.weight);
    target.sets.push({ id: crypto.randomUUID(), index: target.sets.length, weight, reps: row.reps, rpe: row.rpe, completed: true, completedAt: row.startedAt, setType: "working" });
  }
  const fresh = [...groups.values()].filter((workout) => !existing.some((item) => item.sourceFingerprint && item.sourceFingerprint === workout.sourceFingerprint));
  const importedSets = fresh.reduce((sum, workout) => sum + workout.exercises.reduce((inner, exercise) => inner + exercise.sets.length, 0), 0);
  return { workouts: fresh, source: analysis.format === "generic" ? "generic" : "hevy", batchId, fileHash: analysis.fileHash, skippedRows: analysis.rows.length - importedSets };
}
