import { isCardioExercise, type LoggedSet, type WorkoutExercise } from "./model.ts";

export function setEntryError(set: LoggedSet, exercise: Pick<WorkoutExercise, "trackingType" | "muscle">): string | null {
  if (isCardioExercise(exercise)) {
    if (set.distanceKm != null && (!Number.isFinite(set.distanceKm) || set.distanceKm < 0 || set.distanceKm > 10000)) return "Use a distance from 0 to 10,000 km.";
    if (set.durationSeconds != null && (!Number.isInteger(set.durationSeconds) || set.durationSeconds < 0 || set.durationSeconds > 86400)) return "Use a time from 0 to 24 hours.";
    if (!(set.distanceKm != null && set.distanceKm > 0 || set.durationSeconds != null && set.durationSeconds > 0)) return "Enter distance or time before logging this set.";
  } else {
    if (set.reps == null || set.reps === 0) return "Add reps before logging this set.";
    if (!Number.isInteger(set.reps) || set.reps < 1 || set.reps > 10000) return "Use a whole rep count from 1 to 10,000.";
    if (set.weight != null && (!Number.isFinite(set.weight) || set.weight < 0 || set.weight > 2000)) return "Use a valid load from 0 to 2,000 kg.";
  }
  if (set.rpe != null && (!Number.isFinite(set.rpe) || set.rpe < 0 || set.rpe > 10)) return "Use an RPE from 0 to 10.";
  if (set.rir != null && (!Number.isFinite(set.rir) || set.rir < 0 || set.rir > 5)) return "Use an RIR from 0 to 5.";
  return null;
}
