export type ProgressionMethod = "manual" | "double_progression" | "rpe" | "percentage";
export type ProgramExercise = { id: string; exerciseId: string; name: string; muscle: string; equipment: string; sets: number; repMin: number; repMax: number; restSeconds: number; progressionMethod: ProgressionMethod; progressionValue: number | null };
export type ProgramDay = { id: string; name: string; weekIndex: number; exercises: ProgramExercise[] };
export type TrainingProgram = { id: string; name: string; goal: string; days: ProgramDay[]; createdAt: string; updatedAt: string; syncStatus?: "pending" | "synced" | "error"; deleted?: boolean };
