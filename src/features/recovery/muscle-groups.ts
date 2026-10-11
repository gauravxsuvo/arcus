import { exerciseCatalog, type Exercise } from "../exercises/catalog.ts";

export const MUSCLE_GROUPS = ["chest", "lats", "upper_back", "traps", "shoulders", "biceps", "triceps", "forearms", "abs", "quads", "hamstrings", "glutes", "calves"] as const;
export type MuscleGroup = typeof MUSCLE_GROUPS[number];
export type MuscleActivity = { muscle: MuscleGroup; sets: number; lastWorkedAt: string };

const aliases: Record<string, MuscleGroup> = {
  chest: "chest", "upper chest": "chest", "lower chest": "chest", lats: "lats", "upper back": "upper_back", back: "upper_back", traps: "traps", trapezius: "traps",
  "front delts": "shoulders", "side delts": "shoulders", "rear delts": "shoulders", shoulders: "shoulders", delts: "shoulders", biceps: "biceps", triceps: "triceps", forearms: "forearms", abs: "abs", core: "abs", obliques: "abs", quads: "quads", quadriceps: "quads", adductors: "quads", hamstrings: "hamstrings", glutes: "glutes", calves: "calves", "lower back": "upper_back", erectors: "upper_back",
};

function normalize(value: string): MuscleGroup | undefined { return aliases[value.trim().toLowerCase().replaceAll("_", " ")]; }

export function getExerciseMuscleTargets(exercise: Pick<Exercise, "id" | "muscle" | "pattern" | "primaryMuscles" | "secondaryMuscles">): { primary: MuscleGroup | null; secondary: MuscleGroup[] } {
  const explicitPrimary = exercise.primaryMuscles?.map(normalize).find(Boolean);
  let primary = explicitPrimary ?? normalize(exercise.muscle);
  if (!primary && exercise.muscle.toLowerCase() === "compound") {
    const compoundPrimary: Record<string, MuscleGroup> = { "power-clean": "quads", "power-snatch": "shoulders" };
    primary = compoundPrimary[exercise.id] ?? null;
  }
  const secondary = [...new Set((exercise.secondaryMuscles ?? []).map(normalize).filter((item): item is MuscleGroup => Boolean(item) && item !== primary))];
  return { primary: primary ?? null, secondary };
}

export function findUnmappedCatalogExercises(): Exercise[] {
  return exerciseCatalog.filter((exercise) => !getExerciseMuscleTargets(exercise).primary && exercise.muscle.toLowerCase() !== "cardio");
}

export function getMuscleFatigue(hoursSinceWorked: number | null): "high" | "medium" | "nearly-recovered" | "fresh" {
  if (hoursSinceWorked === null || hoursSinceWorked >= 72) return "fresh";
  if (hoursSinceWorked < 24) return "high";
  if (hoursSinceWorked < 48) return "medium";
  return "nearly-recovered";
}
