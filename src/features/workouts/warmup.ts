import type { LoggedSet } from "./model";

const DEFAULT_STEPS = [
  { percentage: 0.4, reps: 10 },
  { percentage: 0.6, reps: 8 },
  { percentage: 0.75, reps: 5 },
  { percentage: 0.85, reps: 3 },
];

export function generateWarmupSets(workingWeight: number, increment = 2.5): LoggedSet[] {
  if (!Number.isFinite(workingWeight) || workingWeight <= 0) return [];
  return DEFAULT_STEPS.map((step, index) => ({
    id: crypto.randomUUID(), index, weight: Math.max(increment, Math.round((workingWeight * step.percentage) / increment) * increment), reps: step.reps,
    rpe: null, completed: false, completedAt: null, setType: "warmup" as const,
  })).filter((set, index, sets) => index === 0 || set.weight > (sets[index - 1]?.weight ?? 0));
}
