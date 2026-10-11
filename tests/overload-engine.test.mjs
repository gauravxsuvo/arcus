import test from "node:test";
import assert from "node:assert/strict";
import { calculateProgressionTarget } from "../src/features/workouts/overload-engine.ts";

test("coach proposes both a rep and a load progression from the highest qualifying real set", () => {
  const target = calculateProgressionTarget("barbell-bench-press", [
    { weight: 80, reps: 8 }, { weight: 90, reps: 4 }, { weight: 75, reps: 10 },
  ]);
  assert.deepEqual(target?.previous, { weight: 80, reps: 8 });
  assert.deepEqual(target?.repProgression, { weight: 80, reps: 9 });
  assert.deepEqual(target?.weightProgression, { weight: 82.5, minReps: 6, maxReps: 7 });
  assert.equal(target?.projectedTopSetVolumeDeltaPercent, 12.5);
});

test("lower-body targets use a five kilogram increment and invalid history yields no target", () => {
  assert.equal(calculateProgressionTarget("back-squat", [{ weight: 100, reps: 6 }])?.weightProgression.weight, 105);
  assert.equal(calculateProgressionTarget("back-squat", [{ weight: 100, reps: 4 }]), null);
});
