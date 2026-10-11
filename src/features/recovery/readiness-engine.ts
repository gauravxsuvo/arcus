export type SleepQuality = 1 | 2 | 3;
export type ReadinessStatus = "optimal" | "moderate" | "low";

export type ReadinessResult = {
  score: number;
  status: ReadinessStatus;
  recommendation: string;
};

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const QUALITY_POINTS: Record<SleepQuality, number> = { 1: 10, 2: 25, 3: 40 };

export function calculateReadiness(
  durationMinutes: number,
  qualityRating: SleepQuality,
  heavyTrainingYesterday: boolean,
  targetMinutes = 480,
): ReadinessResult {
  if (!Number.isFinite(durationMinutes) || durationMinutes < 0) throw new RangeError("Sleep duration must be a non-negative number.");
  if (!Number.isFinite(targetMinutes) || targetMinutes <= 0) throw new RangeError("Target sleep duration must be positive.");

  const durationPoints = Math.min(1, durationMinutes / targetMinutes) * 60;
  const fatigueAdjustment = heavyTrainingYesterday && durationMinutes < 420 ? 10 : 0;
  const score = Math.max(0, Math.min(100, Math.round(durationPoints + QUALITY_POINTS[qualityRating] - fatigueAdjustment)));

  if (score >= 80) return { score, status: "optimal", recommendation: "Prime CNS recovery. Excellent day for heavy compound sets or setting PRs." };
  if (score >= 60) return { score, status: "moderate", recommendation: "Steady baseline. Good for standard volume and progressive overload." };
  return { score, status: "low", recommendation: "Elevated fatigue. Focus on form, auto-regulate volume, and keep RPE around 7–8." };
}
