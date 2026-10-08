import type { LoggedSet, WorkoutExercise } from "@/features/workouts/model";
import { isCardioExercise } from "@/features/workouts/model";
import { previousMatchingSet } from "@/features/workouts/set-assistance";
import { formatWeight } from "@/features/training/logic";
import type { Units } from "@/features/profile/model";

function duration(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }

export function PreviousSet({ exercise, set, previous, units, onUse }: {
  exercise: WorkoutExercise; set: LoggedSet; previous?: WorkoutExercise; units: Units; onUse: (source: LoggedSet) => void;
}) {
  const source = previousMatchingSet(exercise, set.id, previous);
  const text = source ? isCardioExercise(exercise)
    ? [source.distanceKm != null ? `${source.distanceKm} km` : null, source.durationSeconds != null ? duration(source.durationSeconds) : null].filter(Boolean).join(" · ")
    : `${source.weight == null || source.weight === 0 ? "Bodyweight" : formatWeight(source.weight, units)} × ${source.reps}` : "—";
  return <div className="previous-set"><span id={`previous-set-${set.id}`}>Previous: <strong>{text}</strong></span>{source && !set.completed && <button type="button" onClick={() => onUse(source)} aria-label={`Use previous values for set ${set.index + 1} of ${exercise.name}`}>Use</button>}</div>;
}
