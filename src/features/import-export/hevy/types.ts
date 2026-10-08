import type { Exercise } from "../../exercises/catalog.ts";
import type { WorkoutRecord } from "../../workouts/model.ts";

export type HevyRow = {
  rowNumber: number;
  workoutName: string;
  startedAt: string;
  durationSeconds: number | null;
  exerciseName: string;
  setIndex: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  notes: string;
  workoutNotes: string;
  unit: "kg" | "lb" | "unknown";
};

export type ImportIssue = { rowNumber: number; issue: string; severity: "error" | "warning" };
export type ExerciseMatch = { sourceName: string; status: "matched" | "ambiguous" | "unknown"; exercise?: Exercise; candidates: Exercise[] };
export type HevyAnalysis = {
  format: "hevy" | "strong" | "generic";
  headers: string[];
  rows: HevyRow[];
  issues: ImportIssue[];
  matches: ExerciseMatch[];
  unit: "kg" | "lb" | "mixed" | "unknown";
  dateRange: { from: string | null; to: string | null };
  workoutCount: number;
  setCount: number;
  fileHash: string;
};

export type ConfirmedImport = { workouts: WorkoutRecord[]; source: "hevy" | "generic"; batchId: string; fileHash: string; skippedRows: number };
