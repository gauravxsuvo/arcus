export type Exercise = {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  pattern: string;
  aliases: string[];
  restSeconds: number;
  isCustom?: boolean;
  syncStatus?: "pending" | "synced" | "error";
  deleted?: boolean;
};

// Built-in catalog seed; exercise history and workout state are stored separately.
export const exerciseCatalog: Exercise[] = [
  { id: "barbell-bench-press", name: "Barbell Bench Press", muscle: "Chest", equipment: "Barbell", pattern: "Horizontal push", aliases: ["bench", "flat bench"], restSeconds: 150 },
  { id: "incline-barbell-bench", name: "Incline Barbell Bench Press", muscle: "Upper chest", equipment: "Barbell", pattern: "Incline push", aliases: ["incline bench"], restSeconds: 150 },
  { id: "dumbbell-bench", name: "Dumbbell Bench Press", muscle: "Chest", equipment: "Dumbbell", pattern: "Horizontal push", aliases: ["db bench"], restSeconds: 120 },
  { id: "incline-dumbbell-bench", name: "Incline Dumbbell Press", muscle: "Upper chest", equipment: "Dumbbell", pattern: "Incline push", aliases: ["incline db press"], restSeconds: 120 },
  { id: "machine-chest-press", name: "Machine Chest Press", muscle: "Chest", equipment: "Machine", pattern: "Horizontal push", aliases: [], restSeconds: 120 },
  { id: "pec-deck", name: "Pec Deck", muscle: "Chest", equipment: "Machine", pattern: "Fly", aliases: ["machine fly"], restSeconds: 90 },
  { id: "cable-fly", name: "Cable Fly", muscle: "Chest", equipment: "Cable", pattern: "Fly", aliases: [], restSeconds: 90 },
  { id: "push-up", name: "Push-up", muscle: "Chest", equipment: "Bodyweight", pattern: "Horizontal push", aliases: ["press-up"], restSeconds: 90 },
  { id: "pull-up", name: "Pull-up", muscle: "Lats", equipment: "Bodyweight", pattern: "Vertical pull", aliases: ["chin over bar"], restSeconds: 150 },
  { id: "chin-up", name: "Chin-up", muscle: "Lats", equipment: "Bodyweight", pattern: "Vertical pull", aliases: [], restSeconds: 150 },
  { id: "lat-pulldown", name: "Lat Pulldown", muscle: "Lats", equipment: "Cable", pattern: "Vertical pull", aliases: ["pulldown"], restSeconds: 120 },
  { id: "barbell-row", name: "Barbell Row", muscle: "Upper back", equipment: "Barbell", pattern: "Horizontal pull", aliases: ["bent over row"], restSeconds: 150 },
  { id: "chest-supported-row", name: "Chest-Supported Row", muscle: "Upper back", equipment: "Machine", pattern: "Horizontal pull", aliases: [], restSeconds: 120 },
  { id: "seated-cable-row", name: "Seated Cable Row", muscle: "Upper back", equipment: "Cable", pattern: "Horizontal pull", aliases: ["cable row"], restSeconds: 120 },
  { id: "one-arm-dumbbell-row", name: "One-Arm Dumbbell Row", muscle: "Lats", equipment: "Dumbbell", pattern: "Horizontal pull", aliases: ["single arm row"], restSeconds: 120 },
  { id: "overhead-press", name: "Overhead Press", muscle: "Front delts", equipment: "Barbell", pattern: "Vertical push", aliases: ["ohp", "military press"], restSeconds: 150 },
  { id: "dumbbell-shoulder-press", name: "Dumbbell Shoulder Press", muscle: "Front delts", equipment: "Dumbbell", pattern: "Vertical push", aliases: [], restSeconds: 120 },
  { id: "lateral-raise", name: "Dumbbell Lateral Raise", muscle: "Side delts", equipment: "Dumbbell", pattern: "Shoulder isolation", aliases: ["side raise"], restSeconds: 75 },
  { id: "cable-lateral-raise", name: "Cable Lateral Raise", muscle: "Side delts", equipment: "Cable", pattern: "Shoulder isolation", aliases: [], restSeconds: 75 },
  { id: "reverse-fly", name: "Reverse Fly", muscle: "Rear delts", equipment: "Machine", pattern: "Shoulder isolation", aliases: ["rear delt fly"], restSeconds: 75 },
  { id: "barbell-curl", name: "Barbell Curl", muscle: "Biceps", equipment: "Barbell", pattern: "Elbow flexion", aliases: [], restSeconds: 90 },
  { id: "dumbbell-curl", name: "Dumbbell Curl", muscle: "Biceps", equipment: "Dumbbell", pattern: "Elbow flexion", aliases: [], restSeconds: 75 },
  { id: "hammer-curl", name: "Hammer Curl", muscle: "Biceps", equipment: "Dumbbell", pattern: "Elbow flexion", aliases: [], restSeconds: 75 },
  { id: "triceps-pushdown", name: "Triceps Pushdown", muscle: "Triceps", equipment: "Cable", pattern: "Elbow extension", aliases: ["pushdown"], restSeconds: 75 },
  { id: "skull-crusher", name: "Skull Crusher", muscle: "Triceps", equipment: "EZ bar", pattern: "Elbow extension", aliases: [], restSeconds: 90 },
  { id: "back-squat", name: "Back Squat", muscle: "Quads", equipment: "Barbell", pattern: "Squat", aliases: ["squat"], restSeconds: 180 },
  { id: "front-squat", name: "Front Squat", muscle: "Quads", equipment: "Barbell", pattern: "Squat", aliases: [], restSeconds: 180 },
  { id: "hack-squat", name: "Hack Squat", muscle: "Quads", equipment: "Machine", pattern: "Squat", aliases: [], restSeconds: 150 },
  { id: "leg-press", name: "Leg Press", muscle: "Quads", equipment: "Machine", pattern: "Squat", aliases: [], restSeconds: 150 },
  { id: "leg-extension", name: "Leg Extension", muscle: "Quads", equipment: "Machine", pattern: "Knee extension", aliases: [], restSeconds: 90 },
  { id: "romanian-deadlift", name: "Romanian Deadlift", muscle: "Hamstrings", equipment: "Barbell", pattern: "Hip hinge", aliases: ["rdl", "stiff leg deadlift"], restSeconds: 150 },
  { id: "leg-curl", name: "Seated Leg Curl", muscle: "Hamstrings", equipment: "Machine", pattern: "Knee flexion", aliases: ["hamstring curl"], restSeconds: 90 },
  { id: "hip-thrust", name: "Barbell Hip Thrust", muscle: "Glutes", equipment: "Barbell", pattern: "Hip extension", aliases: [], restSeconds: 120 },
  { id: "standing-calf-raise", name: "Standing Calf Raise", muscle: "Calves", equipment: "Machine", pattern: "Ankle extension", aliases: [], restSeconds: 75 },
];

export function searchExercises(query: string, catalog: Exercise[] = exerciseCatalog): Exercise[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return catalog;
  return catalog.filter((exercise) =>
    [exercise.name, exercise.muscle, exercise.equipment, ...exercise.aliases]
      .some((value) => value.toLocaleLowerCase().includes(normalized)),
  );
}
