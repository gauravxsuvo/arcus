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
  updatedAt?: string;
  category?: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string;
  videoUrl?: string;
};

// Built-in catalog seed; exercise history and workout state are stored separately.
export const exerciseCatalog: Exercise[] = [
  {id:"power-clean",name:"Power Clean",muscle:"Compound",equipment:"Barbell",pattern:"Olympic",category:"Olympic",aliases:["clean"],restSeconds:180},
  {id:"power-snatch",name:"Power Snatch",muscle:"Compound",equipment:"Barbell",pattern:"Olympic",category:"Olympic",aliases:["snatch"],restSeconds:180},
  {id:"rowing-machine",name:"Rowing Machine",muscle:"Cardio",equipment:"Machine",pattern:"Cardio",category:"Cardio",aliases:["erg","rower"],restSeconds:60},
  {id:"stationary-bike",name:"Stationary Bike",muscle:"Cardio",equipment:"Machine",pattern:"Cardio",category:"Cardio",aliases:["cycling"],restSeconds:60},
  {id:"treadmill-run",name:"Treadmill Run",muscle:"Cardio",equipment:"Machine",pattern:"Cardio",category:"Cardio",aliases:["running"],restSeconds:60},
  {id:"jump-rope",name:"Jump Rope",muscle:"Cardio",equipment:"Other",pattern:"Cardio",category:"Cardio",aliases:["skipping rope"],restSeconds:60},
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
  { id: "decline-barbell-bench", name: "Decline Barbell Bench Press", muscle: "Chest", equipment: "Barbell", pattern: "Decline push", aliases: ["decline bench"], restSeconds: 150 },
  { id: "decline-dumbbell-press", name: "Decline Dumbbell Press", muscle: "Chest", equipment: "Dumbbell", pattern: "Decline push", aliases: ["decline db press"], restSeconds: 120 },
  { id: "dumbbell-chest-fly", name: "Dumbbell Chest Fly", muscle: "Chest", equipment: "Dumbbell", pattern: "Fly", aliases: ["db fly"], restSeconds: 90 },
  { id: "cable-crossover", name: "Cable Crossover", muscle: "Chest", equipment: "Cable", pattern: "Fly", aliases: ["cable crossovers"], restSeconds: 90 },
  { id: "high-to-low-cable-fly", name: "High-to-Low Cable Fly", muscle: "Chest", equipment: "Cable", pattern: "Fly", aliases: ["high cable fly"], restSeconds: 90 },
  { id: "chest-dip", name: "Chest Dip", muscle: "Chest", equipment: "Bodyweight", pattern: "Dip", aliases: ["dips"], restSeconds: 120 },
  { id: "low-to-high-cable-fly", name: "Low-to-High Cable Fly", muscle: "Upper chest", equipment: "Cable", pattern: "Fly", aliases: ["low cable fly"], restSeconds: 90 },
  { id: "incline-machine-press", name: "Incline Machine Chest Press", muscle: "Upper chest", equipment: "Machine", pattern: "Incline push", aliases: [], restSeconds: 120 },
  { id: "neutral-grip-lat-pulldown", name: "Neutral-Grip Lat Pulldown", muscle: "Lats", equipment: "Cable", pattern: "Vertical pull", aliases: ["neutral pulldown"], restSeconds: 120 },
  { id: "close-grip-lat-pulldown", name: "Close-Grip Lat Pulldown", muscle: "Lats", equipment: "Cable", pattern: "Vertical pull", aliases: ["close grip pulldown"], restSeconds: 120 },
  { id: "straight-arm-pulldown", name: "Straight-Arm Pulldown", muscle: "Lats", equipment: "Cable", pattern: "Shoulder extension", aliases: ["straight arm cable pulldown"], restSeconds: 90 },
  { id: "machine-pullover", name: "Machine Pullover", muscle: "Lats", equipment: "Machine", pattern: "Shoulder extension", aliases: ["pullover machine"], restSeconds: 90 },
  { id: "t-bar-row", name: "T-Bar Row", muscle: "Upper back", equipment: "Barbell", pattern: "Horizontal pull", aliases: ["t bar"], restSeconds: 150 },
  { id: "single-arm-cable-row", name: "Single-Arm Cable Row", muscle: "Upper back", equipment: "Cable", pattern: "Horizontal pull", aliases: ["one arm cable row"], restSeconds: 105 },
  { id: "pendlay-row", name: "Pendlay Row", muscle: "Upper back", equipment: "Barbell", pattern: "Horizontal pull", aliases: ["dead-stop row"], restSeconds: 150 },
  { id: "machine-high-row", name: "Machine High Row", muscle: "Upper back", equipment: "Machine", pattern: "Horizontal pull", aliases: ["high row"], restSeconds: 120 },
  { id: "barbell-shrug", name: "Barbell Shrug", muscle: "Traps", equipment: "Barbell", pattern: "Shoulder elevation", aliases: ["shrugs"], restSeconds: 90 },
  { id: "dumbbell-shrug", name: "Dumbbell Shrug", muscle: "Traps", equipment: "Dumbbell", pattern: "Shoulder elevation", aliases: ["db shrug"], restSeconds: 75 },
  { id: "cable-upright-row", name: "Cable Upright Row", muscle: "Traps", equipment: "Cable", pattern: "Shoulder elevation", aliases: ["upright row"], restSeconds: 90 },
  { id: "arnold-press", name: "Arnold Press", muscle: "Front delts", equipment: "Dumbbell", pattern: "Vertical push", aliases: [], restSeconds: 105 },
  { id: "half-kneeling-landmine-press", name: "Half-Kneeling Landmine Press", muscle: "Front delts", equipment: "Landmine", pattern: "Vertical push", aliases: ["landmine press"], restSeconds: 105 },
  { id: "machine-lateral-raise", name: "Machine Lateral Raise", muscle: "Side delts", equipment: "Machine", pattern: "Shoulder isolation", aliases: [], restSeconds: 75 },
  { id: "leaning-cable-lateral-raise", name: "Leaning Cable Lateral Raise", muscle: "Side delts", equipment: "Cable", pattern: "Shoulder isolation", aliases: ["leaning lateral raise"], restSeconds: 75 },
  { id: "cable-rear-delt-fly", name: "Cable Rear Delt Fly", muscle: "Rear delts", equipment: "Cable", pattern: "Shoulder isolation", aliases: ["rear delt cable fly"], restSeconds: 75 },
  { id: "face-pull", name: "Face Pull", muscle: "Rear delts", equipment: "Cable", pattern: "Shoulder isolation", aliases: ["rope face pull"], restSeconds: 75 },
  { id: "reverse-pec-deck", name: "Reverse Pec Deck", muscle: "Rear delts", equipment: "Machine", pattern: "Shoulder isolation", aliases: ["rear delt machine fly"], restSeconds: 75 },
  { id: "incline-dumbbell-curl", name: "Incline Dumbbell Curl", muscle: "Biceps", equipment: "Dumbbell", pattern: "Elbow flexion", aliases: ["incline curl"], restSeconds: 75 },
  { id: "preacher-curl", name: "Preacher Curl", muscle: "Biceps", equipment: "EZ bar", pattern: "Elbow flexion", aliases: ["preacher curls"], restSeconds: 90 },
  { id: "cable-biceps-curl", name: "Cable Biceps Curl", muscle: "Biceps", equipment: "Cable", pattern: "Elbow flexion", aliases: ["cable curl"], restSeconds: 75 },
  { id: "concentration-curl", name: "Concentration Curl", muscle: "Biceps", equipment: "Dumbbell", pattern: "Elbow flexion", aliases: [], restSeconds: 75 },
  { id: "wrist-curl", name: "Wrist Curl", muscle: "Forearms", equipment: "Dumbbell", pattern: "Wrist flexion", aliases: ["wrist curls"], restSeconds: 60 },
  { id: "reverse-wrist-curl", name: "Reverse Wrist Curl", muscle: "Forearms", equipment: "Dumbbell", pattern: "Wrist extension", aliases: [], restSeconds: 60 },
  { id: "farmers-carry", name: "Farmer's Carry", muscle: "Forearms", equipment: "Dumbbell", pattern: "Loaded carry", aliases: ["farmers walk", "farmer carry"], restSeconds: 90 },
  { id: "close-grip-bench", name: "Close-Grip Bench Press", muscle: "Triceps", equipment: "Barbell", pattern: "Horizontal push", aliases: ["close grip bench"], restSeconds: 120 },
  { id: "overhead-rope-extension", name: "Overhead Rope Triceps Extension", muscle: "Triceps", equipment: "Cable", pattern: "Elbow extension", aliases: ["rope overhead extension"], restSeconds: 75 },
  { id: "dumbbell-overhead-triceps-extension", name: "Dumbbell Overhead Triceps Extension", muscle: "Triceps", equipment: "Dumbbell", pattern: "Elbow extension", aliases: ["overhead triceps extension"], restSeconds: 75 },
  { id: "bench-dip", name: "Bench Dip", muscle: "Triceps", equipment: "Bench", pattern: "Dip", aliases: ["triceps dip"], restSeconds: 75 },
  { id: "cable-crunch", name: "Cable Crunch", muscle: "Abs", equipment: "Cable", pattern: "Trunk flexion", aliases: ["kneeling cable crunch"], restSeconds: 60 },
  { id: "plank", name: "Plank", muscle: "Abs", equipment: "Bodyweight", pattern: "Anti-extension", aliases: ["front plank"], restSeconds: 60 },
  { id: "hanging-knee-raise", name: "Hanging Knee Raise", muscle: "Abs", equipment: "Pull-up bar", pattern: "Trunk flexion", aliases: ["knee raise"], restSeconds: 60 },
  { id: "ab-wheel-rollout", name: "Ab Wheel Rollout", muscle: "Abs", equipment: "Ab wheel", pattern: "Anti-extension", aliases: ["ab rollout"], restSeconds: 75 },
  { id: "decline-sit-up", name: "Decline Sit-Up", muscle: "Abs", equipment: "Decline bench", pattern: "Trunk flexion", aliases: ["decline crunch"], restSeconds: 60 },
  { id: "cable-wood-chop", name: "Cable Wood Chop", muscle: "Obliques", equipment: "Cable", pattern: "Rotation", aliases: ["woodchop"], restSeconds: 60 },
  { id: "russian-twist", name: "Russian Twist", muscle: "Obliques", equipment: "Bodyweight", pattern: "Rotation", aliases: ["russian twists"], restSeconds: 60 },
  { id: "side-plank", name: "Side Plank", muscle: "Obliques", equipment: "Bodyweight", pattern: "Anti-lateral flexion", aliases: [], restSeconds: 60 },
  { id: "conventional-deadlift", name: "Conventional Deadlift", muscle: "Erectors", equipment: "Barbell", pattern: "Hip hinge", aliases: ["deadlift"], restSeconds: 180 },
  { id: "barbell-good-morning", name: "Barbell Good Morning", muscle: "Erectors", equipment: "Barbell", pattern: "Hip hinge", aliases: ["good mornings"], restSeconds: 120 },
  { id: "back-extension", name: "Back Extension", muscle: "Erectors", equipment: "Bench", pattern: "Hip extension", aliases: ["hyperextension"], restSeconds: 90 },
  { id: "bulgarian-split-squat", name: "Bulgarian Split Squat", muscle: "Quads", equipment: "Dumbbell", pattern: "Single-leg squat", aliases: ["rear foot elevated split squat"], restSeconds: 120 },
  { id: "goblet-squat", name: "Goblet Squat", muscle: "Quads", equipment: "Dumbbell", pattern: "Squat", aliases: ["kettlebell goblet squat"], restSeconds: 105 },
  { id: "walking-lunge", name: "Walking Lunge", muscle: "Quads", equipment: "Dumbbell", pattern: "Single-leg squat", aliases: ["walking lunges"], restSeconds: 105 },
  { id: "step-up", name: "Step-Up", muscle: "Quads", equipment: "Dumbbell", pattern: "Single-leg squat", aliases: ["box step up"], restSeconds: 90 },
  { id: "sissy-squat", name: "Sissy Squat", muscle: "Quads", equipment: "Bodyweight", pattern: "Knee extension", aliases: [], restSeconds: 75 },
  { id: "lying-leg-curl", name: "Lying Leg Curl", muscle: "Hamstrings", equipment: "Machine", pattern: "Knee flexion", aliases: ["prone leg curl"], restSeconds: 90 },
  { id: "nordic-hamstring-curl", name: "Nordic Hamstring Curl", muscle: "Hamstrings", equipment: "Bodyweight", pattern: "Knee flexion", aliases: ["nordic curl"], restSeconds: 120 },
  { id: "dumbbell-romanian-deadlift", name: "Dumbbell Romanian Deadlift", muscle: "Hamstrings", equipment: "Dumbbell", pattern: "Hip hinge", aliases: ["db rdl"], restSeconds: 120 },
  { id: "single-leg-romanian-deadlift", name: "Single-Leg Romanian Deadlift", muscle: "Hamstrings", equipment: "Dumbbell", pattern: "Single-leg hip hinge", aliases: ["single leg rdl"], restSeconds: 90 },
  { id: "cable-glute-kickback", name: "Cable Glute Kickback", muscle: "Glutes", equipment: "Cable", pattern: "Hip extension", aliases: ["cable kickback"], restSeconds: 75 },
  { id: "glute-bridge", name: "Glute Bridge", muscle: "Glutes", equipment: "Bodyweight", pattern: "Hip extension", aliases: ["bodyweight glute bridge"], restSeconds: 75 },
  { id: "single-leg-hip-thrust", name: "Single-Leg Hip Thrust", muscle: "Glutes", equipment: "Bench", pattern: "Hip extension", aliases: ["single leg hip thrust"], restSeconds: 90 },
  { id: "seated-calf-raise", name: "Seated Calf Raise", muscle: "Calves", equipment: "Machine", pattern: "Ankle extension", aliases: [], restSeconds: 75 },
  { id: "donkey-calf-raise", name: "Donkey Calf Raise", muscle: "Calves", equipment: "Machine", pattern: "Ankle extension", aliases: [], restSeconds: 75 },
  { id: "single-leg-calf-raise", name: "Single-Leg Standing Calf Raise", muscle: "Calves", equipment: "Bodyweight", pattern: "Ankle extension", aliases: ["single leg calf raise"], restSeconds: 60 },
  { id: "hip-adduction-machine", name: "Hip Adduction Machine", muscle: "Adductors", equipment: "Machine", pattern: "Hip adduction", aliases: ["adductor machine"], restSeconds: 75 },
  { id: "cable-hip-adduction", name: "Cable Hip Adduction", muscle: "Adductors", equipment: "Cable", pattern: "Hip adduction", aliases: [], restSeconds: 75 },
  { id: "copenhagen-side-plank", name: "Copenhagen Side Plank", muscle: "Adductors", equipment: "Bench", pattern: "Hip adduction", aliases: ["copenhagen plank"], restSeconds: 75 },
];

export function searchExercises(query: string, catalog: Exercise[] = exerciseCatalog): Exercise[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return catalog;
  return catalog.filter((exercise) =>
    [exercise.name, exercise.muscle, exercise.equipment, ...exercise.aliases]
      .some((value) => value.toLocaleLowerCase().includes(normalized)),
  );
}
