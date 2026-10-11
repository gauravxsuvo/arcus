/** Brzycki estimate, shown only for sets in the usual 1–12 rep range. */
export function calculateOneRepMax(weight: number, reps: number): number | null {
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isInteger(reps) || reps < 1 || reps > 12) return null;
  return reps === 1 ? weight : weight * (36 / (37 - reps));
}
