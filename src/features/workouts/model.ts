export type SetType = "working" | "warmup" | "drop" | "failure" | "assisted" | "paused" | "amrap";

export type LoggedSet = {
  id: string;
  index: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  rir?: number | null;
  distanceKm?: number | null;
  durationSeconds?: number | null;
  completed: boolean;
  completedAt: string | null;
  setType?: SetType;
};

export type WorkoutExercise = {
  id: string;
  exerciseId: string;
  name: string;
  muscle: string;
  equipment: string;
  restSeconds: number;
  notes?: string;
  trackingType?: "strength" | "cardio";
  groupId?: string;
  suggestedChange?: number;
  targetRepMin?: number;
  targetRepMax?: number;
  targetRpe?: number;
  targetProgressionMethod?: "manual" | "double_progression" | "rpe" | "percentage";
  targetProgressionValue?: number | null;
  sets: LoggedSet[];
};

export type WorkoutMedia = {
  id: string;
  type: "image" | "video";
  name: string;
  mimeType: string;
  dataUrl: string;
};

export const MAX_WORKOUT_MEDIA = 3;
export const MAX_WORKOUT_MEDIA_DATA_LENGTH = 600_000;
export const MAX_WORKOUT_RECORD_BYTES = 900_000;
export const WORKOUT_MEDIA_MIME_TYPES = [
  "image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime",
] as const;

export type WorkoutRecord = {
  id: string;
  name: string;
  startedAt: string;
  completedAt: string | null;
  status: "active" | "completed";
  exercises: WorkoutExercise[];
  notes: string;
  location?: string;
  media?: WorkoutMedia[];
  tags?: string[];
  programId?: string;
  programDay?: string;
  restUntil: string | null;
  syncStatus?: "pending" | "synced" | "error";
  updatedAt: string;
  importSource?: "hevy" | "generic" | "apple-health";
  importBatchId?: string;
  sourceFingerprint?: string;
};

export function createWorkout(): WorkoutRecord {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), name: "Workout", startedAt: now, completedAt: null, status: "active", exercises: [], notes: "", restUntil: null, syncStatus: "pending", updatedAt: now };
}

export function isCardioExercise(exercise: Pick<WorkoutExercise, "trackingType" | "muscle">): boolean {
  return exercise.trackingType === "cardio" || (exercise.trackingType === undefined && exercise.muscle?.trim().toLowerCase() === "cardio");
}

export function calculateWorkoutTotals(workout: WorkoutRecord) {
  const sets = workout.exercises.flatMap((exercise) => exercise.sets).filter((set) => set.completed && set.setType !== "warmup");
  const strengthSets = workout.exercises.filter((exercise) => !isCardioExercise(exercise)).flatMap((exercise) => exercise.sets).filter((set) => set.completed && set.setType !== "warmup");
  return {
    sets: sets.length,
    reps: strengthSets.reduce((sum, set) => sum + (set.reps ?? 0), 0),
    volume: strengthSets.reduce((sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0), 0),
    durationSeconds: workout.completedAt
      ? Math.max(0, Math.round((Date.parse(workout.completedAt) - Date.parse(workout.startedAt)) / 1000))
      : 0,
  };
}
