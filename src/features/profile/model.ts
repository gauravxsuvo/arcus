export type Units = "metric" | "imperial";
export type ProfilePreferences = {
  units: Units; defaultRestTimer: number; theme: "dark" | "light";
  weekStart: "monday" | "sunday"; effortSystem: "rpe" | "rir";
};
export const DEFAULT_PREFERENCES: ProfilePreferences = { units: "metric", defaultRestTimer: 90, theme: "dark", weekStart: "monday", effortSystem: "rpe" };
export type BodyMetric = { id: string; date: string; weight: number; bodyFat: number | null };
export type TrainingGoal = { id: string; type: "bodyweight" | "lift"; exerciseId?: string; targetValue: number; targetReps?: number; targetDate: string; createdAt: string; startValue?: number };
export type ActiveProgram = {
  programId: string;
  startDate: string;
  trainingMaxes?: Record<string,number>;
  scheduleMode?: "calendar" | "rotation";
  nextDayId?: string;
  nextWorkoutDate?: string;
};
export type ProfileDetails = {
  preferences?: ProfilePreferences; bodyMetrics?: { weight: number | null; bodyFat: number | null };
  bodyMetricsHistory?: BodyMetric[]; dateOfBirth?: string | null; targetGoals?: TrainingGoal[];
  activeProgram?: ActiveProgram | null;
};
export type UserProfile = ProfileDetails & {
  experience: string | null; goals: string[]; height_cm: number | null;
  bio?: string | null; avatarUrl?: string | null; age?: number | null; sex?: string | null; equipment?: string[];
};
export type ProgressionRule = { type: "none" | "linear" | "double"; increment: number; repMin: number; repMax: number; deloadPercent: number; deloadAfterFails: number };
export type ExerciseSettings = { id: string; restSeconds?: number; progression?: ProgressionRule; updatedAt: string; syncStatus?: "pending" | "synced" | "error" };
export type WeeklyRecap = { id: string; start: string; end: string; sessions: number; volume: number; records: number; streak: number; updatedAt: string; syncStatus?: "pending" | "synced" | "error" };
