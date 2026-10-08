import type { WorkoutRecord } from "@/features/workouts/model";
import { serializeCsv } from "../csv.ts";

export const HEVY_STRONG_HEADERS = ["Date", "Workout Name", "Duration", "Exercise Name", "Set Order", "Weight", "Reps", "Distance", "Seconds", "Notes", "Workout Notes", "RPE"];

export function exportHevyCsv(workouts: WorkoutRecord[]) {
  const rows = workouts.flatMap((workout) => workout.exercises.flatMap((exercise) => exercise.sets.filter((set) => set.completed).map((set, index) => ({ Date: workout.startedAt, "Workout Name": workout.name || "Workout", Duration: Math.max(0, Math.round((Date.parse(workout.completedAt ?? workout.startedAt) - Date.parse(workout.startedAt)) / 1000)), "Exercise Name": exercise.name, "Set Order": index + 1, Weight: set.weight ?? "", Reps: set.reps ?? "", Distance: "", Seconds: "", Notes: "", "Workout Notes": workout.notes || "", RPE: set.rpe ?? "" }))));
  return serializeCsv(HEVY_STRONG_HEADERS, rows);
}
