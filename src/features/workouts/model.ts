export type LoggedSet = {
  id: string;
  index: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  completed: boolean;
  completedAt: string | null;
};

export type WorkoutExercise = {
  id: string;
  exerciseId: string;
  name: string;
  muscle: string;
  equipment: string;
  restSeconds: number;
  targetRepMin?: number;
  targetRepMax?: number;
  targetProgressionMethod?: "manual" | "double_progression" | "rpe" | "percentage";
  targetProgressionValue?: number | null;
  sets: LoggedSet[];
};

export type WorkoutRecord = {
  id: string;
  name: string;
  startedAt: string;
  completedAt: string | null;
  status: "active" | "completed";
  exercises: WorkoutExercise[];
  notes: string;
  restUntil: string | null;
  syncStatus?: "pending" | "synced" | "error";
  updatedAt: string;
};

export function createWorkout(): WorkoutRecord {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), name: "Workout", startedAt: now, completedAt: null, status: "active", exercises: [], notes: "", restUntil: null, syncStatus: "pending", updatedAt: now };
}

export function calculateWorkoutTotals(workout: WorkoutRecord) {
  const sets = workout.exercises.flatMap((exercise) => exercise.sets).filter((set) => set.completed);
  return {
    sets: sets.length,
    reps: sets.reduce((sum, set) => sum + (set.reps ?? 0), 0),
    volume: sets.reduce((sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0), 0),
    durationSeconds: workout.completedAt
      ? Math.max(0, Math.round((Date.parse(workout.completedAt) - Date.parse(workout.startedAt)) / 1000))
      : 0,
  };
}
