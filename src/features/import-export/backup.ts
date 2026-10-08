import { getExercisePreferences, getLocalSession, listCustomExercises, listPhysiqueEntries, listPrograms,listRecaps,listExerciseSettings,getDevicePreferences } from "@/features/local-data/repository";
import type { LocalUser } from "@/features/local-data/repository";
import { getActiveWorkout, getCompletedWorkouts } from "@/features/workouts/repository";
import { exportHevyCsv } from "./hevy/exporter";
import { serializeCsv } from "./csv.ts";
import { exerciseCatalog } from "@/features/exercises/catalog";
import { exerciseContent, exerciseCategory } from "@/features/exercises/content";

export async function buildFullBackup() {
  const [user, workouts, activeWorkout, programs, physique, customExercises, preferences] = await Promise.all([getLocalSession(), getCompletedWorkouts(), getActiveWorkout(), listPrograms(), listPhysiqueEntries(), listCustomExercises(), getExercisePreferences()]);
  const profile = user ? (() => { const safeUser: Partial<LocalUser> = { ...user }; delete safeUser.passwordHash; return safeUser; })() : null;
  const [recaps,exerciseSettings,devicePreferences]=await Promise.all([listRecaps(),listExerciseSettings(),getDevicePreferences()]);
  const exercises=[...exerciseCatalog,...customExercises].map(e=>({...e,category:exerciseCategory(e),primaryMuscles:exerciseContent(e).primary,secondaryMuscles:exerciseContent(e).secondary,instructions:exerciseContent(e).instructions}));
  return { arcus: 3, exportedAt: new Date().toISOString(), profile, workouts, activeWorkout, programs, physique, customExercises, exercises, preferences,recaps,exerciseSettings,devicePreferences };
}

export async function buildWorkoutCsv() {
  return exportHevyCsv(await getCompletedWorkouts());
}

export async function buildGenericWorkoutCsv() {
  const workouts = await getCompletedWorkouts();
  const headers = ["workout_id", "started_at", "completed_at", "workout_name", "exercise_id", "exercise_name", "set_id", "set_index", "set_type", "weight_kg", "reps", "rpe", "rir", "group_id", "tags", "notes"];
  const rows = workouts.flatMap((workout) => workout.exercises.flatMap((exercise) => exercise.sets.filter((set) => set.completed).map((set) => ({ workout_id: workout.id, started_at: workout.startedAt, completed_at: workout.completedAt ?? "", workout_name: workout.name, exercise_id: exercise.exerciseId, exercise_name: exercise.name, set_id: set.id, set_index: set.index, set_type: set.setType ?? "working", weight_kg: set.weight ?? "", reps: set.reps ?? "", rpe: set.rpe ?? "", rir:set.rir??"", group_id:exercise.groupId??"", tags:workout.tags?.join(" | ")??"", notes: workout.notes }))));
  return serializeCsv(headers, rows);
}
