import { isCardioExercise, type WorkoutExercise, type WorkoutRecord } from "../workouts/model.ts";
import type { ProgressionRule, TrainingGoal, UserProfile, Units } from "../profile/model.ts";
import { calculatePlates as calculatePlateBreakdown } from "../../lib/plate-calculator.ts";

export const KG_PER_LB = 0.45359237;
export const weightUnit = (units: Units) => units === "imperial" ? "lb" : "kg";
export const toDisplayWeight = (kg: number, units: Units) => units === "imperial" ? kg / KG_PER_LB : kg;
export const fromDisplayWeight = (value: number, units: Units) => units === "imperial" ? value * KG_PER_LB : value;
export const formatWeight = (kg: number, units: Units, digits = 1) => `${Number(toDisplayWeight(kg, units).toFixed(digits)).toLocaleString()} ${weightUnit(units)}`;
export const formatLoadReason=(text:string,units:Units)=>text.replace(/(-?\d+(?:\.\d+)?) kg\b/g,(_match,value:string)=>formatWeight(Number(value),units));
export function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
export function weekStartDate(date: Date, weekStart: "monday" | "sunday" = "monday") {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (weekStart === "sunday" ? start.getDay() : (start.getDay() + 6) % 7));
  return start;
}
export function consistency(workouts: WorkoutRecord[], now = new Date(), weekStart: "monday" | "sunday" = "monday") {
  const days = new Set(workouts.filter((w) => w.status === "completed" && w.completedAt && Date.parse(w.completedAt) <= now.getTime()).map((w) => dateKey(new Date(w.completedAt!))));
  const cursor = new Date(now); cursor.setHours(0, 0, 0, 0);
  if (!days.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dateKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  const start = weekStartDate(now, weekStart);
  let lastSeven = 0, thisWeek = 0;
  for (let offset = 0; offset < 7; offset++) {
    const day = new Date(now); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - offset);
    if (days.has(dateKey(day))) { lastSeven++; if (day >= start) thisWeek++; }
  }
  let weeklyStreak = 0;
  for (let offset = 0; offset < 52; offset++) {
    const week = new Date(start); week.setDate(week.getDate() - offset * 7);
    const hasWorkout = Array.from({ length: 7 }, (_, i) => { const day = new Date(week); day.setDate(day.getDate() + i); return days.has(dateKey(day)); }).some(Boolean);
    if (!hasWorkout) { if (offset === 0) continue; break; }
    weeklyStreak++;
  }
  return { streak, weeklyStreak, lastSeven, thisWeek };
}
export function nextLoad(history: WorkoutExercise[], rule: ProgressionRule) {
  const working = (e: WorkoutExercise) => e.sets.filter((s) => s.setType !== "warmup");
  const previous = history[0];
  const sets = previous ? working(previous) : [];
  const complete = sets.filter((s) => s.completed && s.weight !== null);
  const load = complete.length ? Math.max(...complete.map((s) => s.weight ?? 0)) : null;
  if (load === null || rule.type === "none") return { load, reps: rule.repMin, change: 0 };
  const failure = (exercise: WorkoutExercise) => { const sets = working(exercise); return sets.length > 0 && sets.some((s) => !s.completed || (s.reps ?? 0) < rule.repMin); };
  if (rule.deloadAfterFails > 0 && history.length >= rule.deloadAfterFails && history.slice(0, rule.deloadAfterFails).every(failure)) {
    const deload = Math.round(load * (1 - rule.deloadPercent / 100) * 100) / 100;
    return { load: deload, reps: rule.repMin, change: deload - load };
  }
  const target = rule.type === "linear" ? rule.repMin : rule.repMax;
  if (sets.length > 0 && sets.every((s) => s.completed && (s.reps ?? 0) >= target)) return { load: load + rule.increment, reps: rule.repMin, change: rule.increment };
  return { load, reps: complete[0]?.reps ?? rule.repMin, change: 0 };
}
export function groupRoundComplete(exercises: WorkoutExercise[], exerciseId: string, setId: string) {
  const exercise = exercises.find((e) => e.id === exerciseId);
  const set = exercise?.sets.find((s) => s.id === setId);
  if (!exercise || !set) return false;
  if (!exercise.groupId || set.setType === "warmup") return true;
  const round = exercise.sets.filter((s) => s.setType !== "warmup").findIndex((s) => s.id === setId);
  const group = exercises.filter((e) => e.groupId === exercise.groupId);
  // Different set counts still permit a rest after every remaining exercise's round.
  return group.every((e) => { const sets = e.sets.filter((s) => s.setType !== "warmup"); return !sets[round] || sets[round].completed; });
}
export type TypedRecord = { id: string; exerciseId: string; exerciseName: string; type: "1rm" | "estimated_1rm" | "volume"; value: number; date: string; workoutId: string };
export function detectRecords(workouts: WorkoutRecord[]): TypedRecord[] {
  const best = new Map<string, number>(); const result: TypedRecord[] = [];
  for (const workout of [...workouts].filter((w) => w.status === "completed").sort((a,b) => (a.completedAt ?? a.startedAt).localeCompare(b.completedAt ?? b.startedAt))) {
    const byExercise = new Map<string, { name: string; single: number; estimated: number; volume: number }>();
    for (const exercise of workout.exercises) {
      if (isCardioExercise(exercise)) continue;
      const values = byExercise.get(exercise.exerciseId) ?? { name: exercise.name, single: 0, estimated: 0, volume: 0 };
      for (const set of exercise.sets.filter((s) => s.completed && s.setType !== "warmup" && (s.weight ?? 0) > 0 && (s.reps ?? 0) > 0)) {
        const weight = set.weight!, reps = set.reps!;
        if (reps === 1) values.single = Math.max(values.single, weight);
        if (reps > 1 && reps <= 12) values.estimated = Math.max(values.estimated, weight * (1 + reps / 30));
        values.volume += weight * reps;
      }
      byExercise.set(exercise.exerciseId, values);
    }
    for (const [exerciseId, value] of byExercise) for (const [type, score] of [["1rm", value.single], ["estimated_1rm", value.estimated], ["volume", value.volume]] as const) {
      const key = `${exerciseId}:${type}`;
      if (score > (best.get(key) ?? 0)) { best.set(key, score); result.push({ id: `${workout.id}:${key}`, exerciseId, exerciseName: value.name, type, value: score, date: workout.completedAt ?? workout.startedAt, workoutId: workout.id }); }
    }
  }
  return result.reverse();
}
export function goalProgress(goal: TrainingGoal, profile: UserProfile | null, workouts: WorkoutRecord[]) {
  const value = goal.type === "bodyweight" ? profile?.bodyMetrics?.weight ?? 0 : Math.max(0, ...workouts.flatMap((w) => w.exercises.filter((e) => e.exerciseId === goal.exerciseId).flatMap((e) => e.sets.filter((s) => s.completed && s.setType !== "warmup" && (s.reps ?? 0) >= (goal.targetReps ?? 1)).map((s) => s.weight ?? 0))));
  const start = goal.startValue ?? value;
  const percent = goal.type === "bodyweight" ? start === goal.targetValue ? 100 : (value - start) / (goal.targetValue - start) * 100 : value / goal.targetValue * 100;
  return { value, percent: Math.max(0, Math.min(100, percent)) };
}
export function oneRepMaxes(weight: number, reps: number) {
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isInteger(reps) || reps < 1 || reps > 12) return null;
  const epley = reps === 1 ? weight : weight * (1 + reps / 30);
  const brzycki = reps === 1 ? weight : weight * 36 / (37 - reps);
  const lombardi = weight * Math.pow(reps, .1);
  return { epley, brzycki, lombardi, average: (epley + brzycki + lombardi) / 3 };
}
/** Compatibility adapter for existing training tools; the canonical algorithm lives in lib/plate-calculator. */
export function calculatePlates(target: number, bar: number, units: Units) {
  const result = calculatePlateBreakdown(target, bar, units === "metric" ? "kg" : "lbs");
  const plates = result.platesPerSide.flatMap(({ weight, count }) => Array.from({ length: count }, () => weight));
  return { plates, achieved: result.achievableWeight, remainder: Math.max(0, target - result.achievableWeight) };
}
