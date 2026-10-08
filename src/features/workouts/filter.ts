import type { WorkoutRecord } from "./model.ts";
import { dateKey } from "../training/logic.ts";

export type WorkoutHistoryFilters = {
  query: string;
  exerciseId: string;
  muscle: string;
  fromDate: string;
  toDate: string;
};

export function filterWorkoutHistory(workouts: WorkoutRecord[], filters: WorkoutHistoryFilters): WorkoutRecord[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return workouts.filter(workout => {
    const timestamp = new Date(workout.completedAt ?? workout.startedAt);
    if ((filters.fromDate || filters.toDate) && !Number.isFinite(timestamp.getTime())) return false;
    // The date inputs represent the user's calendar day, not the UTC day in storage.
    const day = dateKey(timestamp);
    const text = `${workout.name} ${workout.notes} ${workout.exercises.map(exercise => exercise.name).join(" ")}`.toLocaleLowerCase();
    return (!query || text.includes(query))
      && (!filters.exerciseId || workout.exercises.some(exercise => exercise.exerciseId === filters.exerciseId))
      && (!filters.muscle || workout.exercises.some(exercise => exercise.muscle === filters.muscle))
      && (!filters.fromDate || day >= filters.fromDate)
      && (!filters.toDate || day <= filters.toDate);
  });
}
